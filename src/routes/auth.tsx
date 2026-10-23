import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, FormAlert, LegalNotice } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/validation";

const search = z.object({
  redirect: z.string().optional(),
  verified: z.coerce.boolean().optional(),
  activated: z.coerce.boolean().optional(),
  oauth: z.coerce.boolean().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  activationRequired: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  beforeLoad: async ({ search }) => {
    // Already signed in (fresh login, refresh, or direct visit): route by role immediately.
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: await resolveDestination(search.redirect) });
  },
  head: () => ({
    meta: [
      { title: "Masuk | qurbanity" },
      { name: "description", content: "Masuk ke portal peserta qurbanity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function safePath(p?: string) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/portal";
}

/** Role-aware post-login destination. Admin roles land on /admin; everyone else on /portal.
 * Resolves from the server-side admin_members mapping (never from editable profile fields).
 * Fails closed: if the admin check cannot be verified, the user is treated as a participant. */
async function resolveDestination(redirect?: string): Promise<string> {
  const dest = safePath(redirect);
  const { data: admin, error: accessError } = await supabase.rpc("my_admin_access");
  if (accessError) {
    await supabase.auth.signOut();
    return "/auth?error=role_check";
  }
  if (admin) return dest.startsWith("/admin") ? dest : "/admin";
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const membership = await supabase
      .from("admin_members")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (membership.error) {
      await supabase.auth.signOut();
      return "/auth?error=role_check";
    }
    if (membership.data) {
      await supabase.auth.signOut();
      return "/auth?activationRequired=1";
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("whatsapp, birth_date, address, terms_accepted_at")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (
      error ||
      !profile ||
      !profile.terms_accepted_at ||
      profile.whatsapp === "+620000000000" ||
      profile.address === "Belum dilengkapi" ||
      profile.birth_date === "1970-01-01"
    ) {
      return "/lengkapi-profil";
    }
  }
  return dest.startsWith("/admin") ? "/portal" : dest;
}

function LoginPage() {
  const {
    redirect: dest,
    verified,
    activated,
    activationRequired,
    error: oauthError,
    error_description: oauthErrorDescription,
  } = Route.useSearch();
  const navigate = useNavigate();
  // SSR renders this page before the browser session is readable; re-check on the client
  // so an already-signed-in user (refresh or direct visit) is routed by role.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hash.has("error") || hash.has("error_description")) {
      setError("Google tidak dapat digunakan. Silakan coba lagi atau masuk dengan email.");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (active && data.user) navigate({ to: await resolveDestination(dest), replace: true });
    });
    return () => {
      active = false;
    };
  }, [dest, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    activationRequired
      ? "Akun admin belum aktif. Gunakan tautan aktivasi dari pengelola."
      : oauthError === "role_check"
        ? "Akses akun tidak dapat diverifikasi. Silakan coba lagi."
        : oauthError || oauthErrorDescription
          ? "Google tidak dapat digunakan. Silakan coba lagi atau masuk dengan email."
          : null,
  );
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return setError("Email dan kata sandi wajib diisi.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.message));
    navigate({ to: await resolveDestination(dest), replace: true });
  };

  return (
    <AuthShell title="Selamat Datang" subtitle="Masuk untuk melanjutkan perjalanan kurbanmu.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {verified && (
          <FormAlert kind="success">Email berhasil diverifikasi. Silakan masuk.</FormAlert>
        )}
        {activated && (
          <FormAlert kind="success">
            Akun berhasil diaktifkan. Silakan masuk menggunakan email dan kata sandi Anda.
          </FormAlert>
        )}
        {error && <FormAlert kind="error">{error}</FormAlert>}
        <div>
          <Label htmlFor="email">
            Email{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-11"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Kata sandi{" "}
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Link
              to="/lupa-password"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <div className="mt-1.5">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />} Masuk
        </Button>
        <AuthDivider />
        <GoogleAuthButton label="Lanjutkan dengan Google" onError={setError} />
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{" "}
          <Link to="/daftar" className="font-semibold text-primary hover:underline">
            Daftar
          </Link>
        </p>
      </form>
      <div className="mt-5">
        <LegalNotice />
      </div>
    </AuthShell>
  );
}
