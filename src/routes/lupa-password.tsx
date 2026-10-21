import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, FormAlert } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/validation";

export const Route = createFileRoute("/lupa-password")({
  head: () => ({ meta: [{ title: "Lupa Kata Sandi | qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Format email tidak valid.");
    setState("loading");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` });
    if (error) { setState("idle"); return setError(authErrorMessage(error.message)); }
    setState("sent");
  };
  return (
    <AuthShell title="Lupa kata sandi" subtitle="Kami akan mengirim tautan untuk membuat kata sandi baru.">
      {state === "sent" ? (
        <div className="space-y-4">
          <FormAlert kind="success">Jika email terdaftar, tautan atur ulang kata sandi sudah dikirim. Cek kotak masuk dan folder spam.</FormAlert>
          <Button asChild variant="outline" className="w-full"><Link to="/auth">Kembali ke halaman masuk</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <FormAlert kind="error">{error}</FormAlert>}
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1.5 h-11" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button type="submit" size="lg" className="w-full" disabled={state === "loading"}>{state === "loading" && <Loader2 className="animate-spin" />} Kirim tautan</Button>
          <p className="text-center text-sm"><Link to="/auth" className="font-semibold text-primary hover:underline">Kembali ke halaman masuk</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
