import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell, FieldError, FormAlert } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, passwordSchema } from "@/lib/validation";

export const Route = createFileRoute("/aktivasi-akun")({
  ssr: false,
  head: () => ({ meta: [{ title: "Aktivasi Akun Admin | qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

type Ready = "checking" | "ok" | "invalid" | "done";

function isSetupLink() {
  const h = window.location.hash;
  return /type=(invite|recovery|signup|email_change)/.test(h) || window.location.search.includes("code=");
}

function Page() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<Ready>("checking");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Tautan aktivasi (invite/recovery) membuka sesi; status setup diverifikasi
    // ke database sehingga tautan kedaluwarsa/terpakai tidak menampilkan formulir.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") void checkPending();
    });
    async function checkPending() {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return setReady(isSetupLink() ? "checking" : "invalid");
      const { data: state, error } = await supabase.rpc("my_admin_setup_state");
      if (error) return setReady("invalid");
      setReady(state === "menunggu_aktivasi" ? "ok" : "invalid");
    }
    void checkPending();
    const t = setTimeout(() => setReady((r) => (r === "checking" ? "invalid" : r)), 6000);
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
    if (error) {
      setLoading(false);
      return setErr(authErrorMessage(error.message));
    }
    const { error: doneErr } = await supabase.rpc("complete_admin_setup");
    setLoading(false);
    if (doneErr) return setErr(doneErr.message);
    await supabase.auth.signOut();
    setReady("done");
    setTimeout(() => navigate({ to: "/auth", search: { activated: true }, replace: true }), 2500);
  };

  return (
    <AuthShell title="Aktivasi akun admin" subtitle="Atur kata sandi untuk menyelesaikan aktivasi akunmu.">
      {ready === "checking" && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memeriksa tautan aktivasi…</p>}
      {ready === "invalid" && (
        <div className="space-y-4">
          <FormAlert kind="error">Tautan aktivasi tidak valid, sudah kedaluwarsa, atau sudah digunakan. Minta Superadmin mengaktifkan ulang akunmu.</FormAlert>
          <Button asChild className="w-full"><Link to="/auth">Ke halaman masuk</Link></Button>
        </div>
      )}
      {ready === "done" && (
        <div className="space-y-4">
          <FormAlert kind="success">Akun berhasil diaktifkan. Silakan masuk menggunakan email dan kata sandi Anda.</FormAlert>
          <Button asChild className="w-full"><Link to="/auth" search={{ activated: true }}>Masuk sekarang</Link></Button>
        </div>
      )}
      {ready === "ok" && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <FormAlert kind="error">{err}</FormAlert>}
          <div><Label htmlFor="pw">Kata Sandi Baru</Label><div className="mt-1.5"><PasswordInput id="pw" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); setFieldErr(undefined); }} /></div><p className="mt-1 text-xs text-muted-foreground">Min. 10 karakter, berisi huruf dan angka</p></div>
          <div><Label htmlFor="cf">Konfirmasi Kata Sandi</Label><div className="mt-1.5"><PasswordInput id="cf" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setFieldErr(undefined); }} /></div><FieldError id="pw-err" msg={fieldErr} /></div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Aktifkan akun</Button>
        </form>
      )}
    </AuthShell>
  );
}
