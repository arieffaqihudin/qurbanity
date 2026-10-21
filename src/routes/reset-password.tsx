import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell, FieldError, FormAlert } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, passwordSchema } from "@/lib/validation";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Atur Ulang Kata Sandi | qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setReady("ok"); });
    const isRecovery = window.location.hash.includes("type=recovery") || window.location.search.includes("code=");
    supabase.auth.getSession().then(({ data: s }) => setReady(s.session && isRecovery ? "ok" : s.session ? "ok" : isRecovery ? "checking" : "invalid"));
    const t = setTimeout(() => setReady((r) => (r === "checking" ? "invalid" : r)), 4000);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const p = passwordSchema.safeParse(pw);
    if (!p.success) return setFieldErr(p.error.issues[0]?.message);
    if (pw !== confirm) return setFieldErr("Konfirmasi kata sandi tidak sama");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setErr(authErrorMessage(error.message));
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <AuthShell title="Buat kata sandi baru">
      {ready === "checking" && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memeriksa tautan…</p>}
      {ready === "invalid" && (
        <div className="space-y-4">
          <FormAlert kind="error">Tautan tidak valid atau sudah kedaluwarsa.</FormAlert>
          <Button asChild className="w-full"><Link to="/lupa-password">Minta tautan baru</Link></Button>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <FormAlert kind="error">{err}</FormAlert>}
          <div><Label htmlFor="pw">Kata sandi baru</Label><div className="mt-1.5"><PasswordInput id="pw" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setFieldErr(undefined); }} /></div><p className="mt-1 text-xs text-muted-foreground">Min. 10 karakter, berisi huruf dan angka</p></div>
          <div><Label htmlFor="cf">Konfirmasi kata sandi</Label><div className="mt-1.5"><PasswordInput id="cf" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setFieldErr(undefined); }} /></div><FieldError id="pw-err" msg={fieldErr} /></div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Simpan kata sandi</Button>
        </form>
      )}
    </AuthShell>
  );
}
