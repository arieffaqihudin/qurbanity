import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, FormAlert } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/validation";

const search = z.object({ redirect: z.string().optional(), verified: z.coerce.boolean().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  beforeLoad: async ({ search }) => {
    // Already signed in (fresh login, refresh, or direct visit): route by role immediately.
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: await resolveDestination(search.redirect) });
  },
  head: () => ({ meta: [{ title: "Masuk | qurbanity" }, { name: "description", content: "Masuk ke portal peserta qurbanity." }, { name: "robots", content: "noindex" }] }),
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
  let admin = false;
  try {
    const { data } = await supabase.rpc("my_admin_access");
    admin = !!data;
  } catch {
    admin = false;
  }
  if (admin) return dest.startsWith("/admin") ? dest : "/admin";
  return dest.startsWith("/admin") ? "/portal" : dest;
}

function LoginPage() {
  const { redirect: dest, verified } = Route.useSearch();
  const navigate = useNavigate();
  // SSR renders this page before the browser session is readable; re-check on the client
  // so an already-signed-in user (refresh or direct visit) is routed by role.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (active && data.user) navigate({ to: await resolveDestination(dest), replace: true });
    });
    return () => { active = false; };
  }, [dest, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return setError("Email dan kata sandi wajib diisi.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.message));
    navigate({ to: await resolveDestination(dest), replace: true });
  };

  return (
    <AuthShell title="Masuk" subtitle="Lanjutkan perjalanan kurbanmu.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {verified && <FormAlert kind="success">Email berhasil diverifikasi. Silakan masuk.</FormAlert>}
        {error && <FormAlert kind="error">{error}</FormAlert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 h-11" required />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Kata sandi</Label>
            <Link to="/lupa-password" className="text-sm font-semibold text-primary hover:underline">Lupa kata sandi?</Link>
          </div>
          <div className="mt-1.5"><PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Masuk</Button>
        <p className="text-center text-sm text-muted-foreground">Belum punya akun? <Link to="/daftar" className="font-semibold text-primary hover:underline">Daftar</Link></p>
      </form>
    </AuthShell>
  );
}
