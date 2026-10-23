import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell, FieldError, FormAlert, LegalNotice } from "@/components/auth/AuthShell";
import { AuthDivider, GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, normalizeWhatsapp, registerSchema } from "@/lib/validation";

export const Route = createFileRoute("/daftar")({
  head: () => ({
    meta: [
      { title: "Daftar | qurbanity" },
      {
        name: "description",
        content: "Buat akun peserta qurbanity untuk memulai komitmen kurban bertahap.",
      },
    ],
  }),
  component: RegisterPage,
});

type Form = {
  full_name: string;
  email: string;
  whatsapp: string;
  birth_date: string;
  address: string;
  password: string;
  confirm: string;
  terms: boolean;
};
const empty: Form = {
  full_name: "",
  email: "",
  whatsapp: "",
  birth_date: "",
  address: "",
  password: "",
  confirm: "",
  terms: false,
};

function RegisterPage() {
  const [f, setF] = useState<Form>(empty);
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF({ ...f, [k]: v });
    setErrs({ ...errs, [k]: undefined });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = registerSchema.safeParse(f);
    if (!parsed.success) {
      const map: typeof errs = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof Form;
        if (!map[k]) map[k] = i.message;
      }
      setErrs(map);
      document.getElementById(Object.keys(map)[0] ?? "")?.focus();
      return;
    }
    const v = parsed.data;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?verified=1`,
        data: {
          full_name: v.full_name,
          whatsapp: normalizeWhatsapp(v.whatsapp),
          birth_date: v.birth_date,
          address: v.address,
          terms_accepted: true,
        },
      },
    });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.message));
    // Existing email: auth returns a user with no identities (no email is sent)
    if (data.user && (data.user.identities?.length ?? 0) === 0)
      return setErrs({
        email: "Email sudah terdaftar. Silakan masuk atau gunakan Lupa kata sandi.",
      });
    setSentTo(v.email);
  };

  if (sentTo) {
    return (
      <AuthShell title="Cek email kamu" subtitle="Satu langkah lagi untuk mengaktifkan akun.">
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto size-12 text-primary" />
          <p>
            Kami mengirim tautan verifikasi ke <strong>{sentTo}</strong>. Klik tautan itu untuk
            mengaktifkan akun, lalu masuk.
          </p>
          <p className="text-sm text-muted-foreground">
            Tidak menerima email? Periksa folder spam.
          </p>
          <Button asChild className="w-full">
            <Link to="/auth">Ke halaman masuk</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const field = (k: keyof Form, label: string, input: ReactNode, hint?: string) => (
    <div>
      <Label htmlFor={k}>{label}</Label>
      <div className="mt-1.5">{input}</div>
      {hint && !errs[k] && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <FieldError id={`${k}-err`} msg={errs[k]} />
    </div>
  );
  const aria = (k: keyof Form) => ({
    id: k,
    "aria-invalid": !!errs[k],
    "aria-describedby": errs[k] ? `${k}-err` : undefined,
  });

  return (
    <AuthShell
      title="Mulai Perjalanan Kurbanmu"
      subtitle="Buat akun untuk merencanakan kurban dengan lebih mudah."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <FormAlert kind="error">{error}</FormAlert>}
        {field(
          "full_name",
          "Nama Lengkap *",
          <Input placeholder="Contoh: Ahmad Fauzi"
            {...aria("full_name")}
            autoComplete="name"
            className="h-11"
            value={f.full_name}
            onChange={(e) => set("full_name", e.target.value)}
          />,
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "email",
            "Email *",
            <Input placeholder="nama@email.com"
              {...aria("email")}
              type="email"
              autoComplete="email"
              className="h-11"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
            />,
          )}
          {field(
            "whatsapp",
            "Nomor WhatsApp *",
            <Input
              {...aria("whatsapp")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              className="h-11"
              value={f.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
            />,
            f.whatsapp && normalizeWhatsapp(f.whatsapp)
              ? `Disimpan sebagai ${normalizeWhatsapp(f.whatsapp)}`
              : undefined,
          )}
        </div>
        {field(
          "birth_date",
          "Tanggal Lahir *",
          <Input
            {...aria("birth_date")}
            type="date"
            autoComplete="bday"
            className="h-11"
            value={f.birth_date}
            onChange={(e) => set("birth_date", e.target.value)}
          />,
          "Usia minimal 17 tahun",
        )}
        {field(
          "address",
          "Alamat *",
          <Textarea placeholder="Masukkan alamat lengkap"
            {...aria("address")}
            autoComplete="street-address"
            rows={2}
            value={f.address}
            onChange={(e) => set("address", e.target.value)}
          />,
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "password",
            "Kata Sandi *",
            <PasswordInput placeholder="Buat kata sandi"
              {...aria("password")}
              autoComplete="new-password"
              value={f.password}
              onChange={(e) => set("password", e.target.value)}
            />,
            "Minimal 10 karakter, berisi huruf dan angka",
          )}
          {field(
            "confirm",
            "Konfirmasi Kata Sandi *",
            <PasswordInput placeholder="Ulangi kata sandi"
              {...aria("confirm")}
              autoComplete="new-password"
              value={f.confirm}
              onChange={(e) => set("confirm", e.target.value)}
            />,
          )}
        </div>
        <div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={f.terms}
              onCheckedChange={(c) => set("terms", c === true)}
              aria-invalid={!!errs.terms}
              className="mt-0.5"
            />
            <div className="text-sm leading-relaxed">
              <Label htmlFor="terms" className="font-normal">
                Saya menyetujui
              </Label>{" "}
              <Link
                to="/syarat-ketentuan"
                target="_blank"
                className="font-semibold text-primary underline underline-offset-2"
              >
                Syarat dan Ketentuan
              </Link>{" "}
              serta{" "}
              <Link
                to="/kebijakan-privasi"
                target="_blank"
                className="font-semibold text-primary underline underline-offset-2"
              >
                Kebijakan Privasi
              </Link>
              . *
            </div>
          </div>
          <FieldError id="terms-err" msg={errs.terms} />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin" />} Daftar
        </Button>
        <AuthDivider />
        <GoogleAuthButton label="Daftar dengan Google" onError={setError} />
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/auth" className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </form>
      <div className="mt-5">
        <LegalNotice />
      </div>
    </AuthShell>
  );
}
