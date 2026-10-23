import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthShell, FieldError, FormAlert, LegalNotice } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ageOn, normalizeWhatsapp, profileSchema } from "@/lib/validation";

export const Route = createFileRoute("/lengkapi-profil")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Lengkapi Profil | Qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: access, error: accessError } = await supabase.rpc("my_admin_access");
    if (accessError) throw new Error("Akses akun tidak dapat diperiksa. Coba lagi.");
    if (access) throw redirect({ to: "/admin" });
    const membership = await supabase
      .from("admin_members")
      .select("user_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (membership.error) throw new Error("Akses akun tidak dapat diperiksa. Coba lagi.");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("whatsapp, birth_date, address, terms_accepted_at")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) throw new Error("Profil akun tidak dapat diperiksa. Coba lagi.");
    const complete =
      !!profile?.terms_accepted_at &&
      profile.whatsapp !== "+620000000000" &&
      profile.birth_date !== "1970-01-01" &&
      profile.address !== "Belum dilengkapi";
    if (complete && !membership.data) throw redirect({ to: "/portal" });
    return { user: auth.user, isAdminAccount: !!membership.data };
  },
  component: Page,
});

type Fields = { full_name: string; whatsapp: string; birth_date: string; address: string };
type FieldKey = keyof Fields | "terms";

function Page() {
  const { user, isAdminAccount } = Route.useRouteContext();
  const navigate = useNavigate();
  const profile = useQuery({
    queryKey: ["google-profile-onboarding", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, whatsapp, birth_date, address")
        .eq("id", user.id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const [fields, setFields] = useState<Fields>({
    full_name: user.user_metadata?.["full_name"] ?? user.user_metadata?.["name"] ?? "",
    whatsapp: "",
    birth_date: "",
    address: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (profile.isPending) {
    return (
      <AuthShell title="Menyiapkan profil" subtitle="Mohon tunggu sebentar.">
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" /> Memuat data akun…
        </p>
      </AuthShell>
    );
  }
  if (profile.isError) {
    return (
      <AuthShell title="Profil belum dapat dimuat" subtitle="Periksa koneksi lalu coba kembali.">
        <FormAlert kind="error">Profil akun tidak dapat dibuka saat ini.</FormAlert>
      </AuthShell>
    );
  }

  if (isAdminAccount) {
    return (
      <AuthShell
        title="Aktivasi akun admin"
        subtitle="Akun admin harus diaktifkan melalui undangan pengelola."
      >
        <FormAlert kind="error">
          Gunakan tautan aktivasi dari pengelola untuk melanjutkan. Formulir peserta tidak tersedia
          untuk akun admin.
        </FormAlert>
      </AuthShell>
    );
  }

  const stored = profile.data;
  const initial = {
    full_name: stored.full_name === "Peserta Qurbanity" ? fields.full_name : stored.full_name,
    whatsapp: stored.whatsapp === "+620000000000" ? fields.whatsapp : stored.whatsapp,
    birth_date: stored.birth_date.startsWith("1970-") ? fields.birth_date : stored.birth_date,
    address: stored.address === "Belum dilengkapi" ? fields.address : stored.address,
  };
  const current = {
    full_name: fields.full_name || initial.full_name,
    whatsapp: fields.whatsapp || initial.whatsapp,
    birth_date: fields.birth_date || initial.birth_date,
    address: fields.address || initial.address,
  };
  const set = (key: keyof Fields, value: string) => {
    setFields((old) => ({ ...old, [key]: value }));
    setErrors((old) => {
      const next = { ...old };
      delete next[key];
      return next;
    });
  };
  const props = (key: keyof Fields) => ({
    id: key,
    value: current[key],
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    const normalizedPhone = normalizeWhatsapp(current.whatsapp);
    const validated = profileSchema.safeParse({
      full_name: current.full_name,
      whatsapp: normalizedPhone ?? current.whatsapp,
      address: current.address,
    });
    if (!validated.success) {
      for (const issue of validated.error.issues) {
        const key = issue.path[0] as keyof Fields;
        nextErrors[key] ??= issue.message;
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(current.birth_date)) {
      nextErrors.birth_date = "Tanggal lahir wajib diisi.";
    } else {
      const age = ageOn(current.birth_date);
      if (age < 17) nextErrors.birth_date = "Usia minimal peserta adalah 17 tahun.";
      else if (age > 120) nextErrors.birth_date = "Tanggal lahir tidak valid.";
    }
    if (!accepted) nextErrors.terms = "Persetujuan wajib diberikan untuk membuat akun peserta.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("complete_participant_google_profile", {
      p_full_name: validated.data!.full_name,
      p_whatsapp: normalizedPhone!,
      p_birth_date: current.birth_date,
      p_address: validated.data!.address,
      p_accept_terms: accepted,
    });
    setSaving(false);
    if (error) {
      setFormError(
        error.message.includes("sudah dilengkapi")
          ? "Profil sudah dilengkapi. Silakan masuk kembali."
          : error.message.includes("Usia minimal")
            ? "Usia minimal peserta adalah 17 tahun."
            : "Profil tidak dapat disimpan saat ini. Periksa data lalu coba lagi.",
      );
      return;
    }
    await navigate({ to: "/portal", replace: true });
  };

  return (
    <AuthShell
      title="Lengkapi profil"
      subtitle="Beberapa data diperlukan sebelum kamu dapat membuat komitmen kurban."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <FormAlert kind="error">{formError}</FormAlert>}
        <div>
          <Label htmlFor="full_name">Nama Lengkap *</Label>
          <Input placeholder="Contoh: Ahmad Fauzi" {...props("full_name")} autoComplete="name" className="mt-1.5 h-11" />
          <FieldError id="full_name-error" msg={errors.full_name} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user.email ?? ""}
            disabled
            readOnly
            className="mt-1.5 h-11"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="whatsapp">Nomor WhatsApp *</Label>
            <Input
              {...props("whatsapp")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              className="mt-1.5 h-11"
            />
            <FieldError id="whatsapp-error" msg={errors.whatsapp} />
          </div>
          <div>
            <Label htmlFor="birth_date">Tanggal Lahir *</Label>
            <Input
              {...props("birth_date")}
              type="date"
              autoComplete="bday"
              className="mt-1.5 h-11"
            />
            <FieldError id="birth_date-error" msg={errors.birth_date} />
          </div>
        </div>
        <div>
          <Label htmlFor="address">Alamat *</Label>
          <Textarea placeholder="Masukkan alamat lengkap"
            {...props("address")}
            autoComplete="street-address"
            rows={2}
            className="mt-1.5"
          />
          <FieldError id="address-error" msg={errors.address} />
        </div>
        <div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={accepted}
              onCheckedChange={(checked) => {
                setAccepted(checked === true);
                setErrors((old) => {
                  const next = { ...old };
                  delete next.terms;
                  return next;
                });
              }}
              aria-invalid={!!errors.terms}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="text-sm font-normal leading-relaxed">
              Saya telah membaca dan menyetujui Syarat dan Ketentuan serta Kebijakan Privasi. *
            </Label>
          </div>
          <FieldError id="terms-error" msg={errors.terms} />
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Simpan dan lanjutkan
        </Button>
      </form>
      <div className="mt-5">
        <LegalNotice />
      </div>
    </AuthShell>
  );
}
