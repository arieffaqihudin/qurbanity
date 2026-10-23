import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Panel, Loading, Failure, Field, Tag } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, type AdminRole } from "@/lib/admin";

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  group: string | null;
  setupStatus: string | null;
}

const SETUP_LABEL: Record<string, string> = {
  aktif: "Aktif",
  menunggu_aktivasi: "Menunggu Aktivasi",
  belum_diundang: "Belum Diundang",
  gagal_email: "Gagal Mengirim Email",
  dinonaktifkan: "Dinonaktifkan",
};

export const Route = createFileRoute("/_authenticated/admin/profil")({
  head: () => ({
    meta: [{ title: "Profil Saya | Admin qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: async (): Promise<AdminProfile> => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      if (!auth.user) throw new Error("Sesi admin tidak ditemukan");
      const [profile, access, setup] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("id", auth.user.id).single(),
        supabase.rpc("my_admin_access"),
        supabase.rpc("my_admin_setup_state"),
      ]);
      if (profile.error) throw new Error(profile.error.message);
      if (access.error) throw new Error(access.error.message);
      if (setup.error) throw new Error(setup.error.message);
      const member = access.data as unknown as {
        role: AdminRole;
        group?: { name: string } | null;
      } | null;
      if (!member) throw new Error("Akses administrator tidak ditemukan");
      return {
        id: profile.data.id,
        name: profile.data.full_name,
        email: auth.user.email ?? "",
        role: member.role,
        group: member.group?.name ?? null,
        setupStatus: setup.data,
      };
    },
  });

  if (query.isPending)
    return (
      <div className="mx-auto max-w-3xl">
        <Loading />
      </div>
    );
  if (query.isError)
    return (
      <div className="mx-auto max-w-3xl">
        <Failure error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  if (!query.data) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold text-burgundy-dark md:text-2xl">Profil Saya</h1>
        <p className="text-sm text-muted-foreground">
          Kelola informasi akun dan keamanan akses admin.
        </p>
      </div>
      <ProfileEditor
        profile={query.data}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["admin", "identity"] });
          void queryClient.invalidateQueries({ queryKey: ["admin", "profile"] });
        }}
      />
    </div>
  );
}

function ProfileEditor({ profile, onSaved }: { profile: AdminProfile; onSaved: () => void }) {
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length < 3 || nextName.length > 120) {
      toast.error("Nama lengkap harus terdiri dari 3 sampai 120 karakter.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: nextName })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error("Nama gagal disimpan.");
      return;
    }
    setName(nextName);
    toast.success("Profil tersimpan.");
    onSaved();
  };

  const sendPasswordLink = async () => {
    if (!profile.email) {
      toast.error("Email akun tidak tersedia.");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast.error("Tautan pengaturan kata sandi gagal dikirim.");
      return;
    }
    toast.success("Tautan aman untuk mengatur kata sandi telah dikirim ke email akun.");
  };

  return (
    <>
      <Panel title="Informasi akun">
        <form onSubmit={save} className="space-y-4">
          <Field label="Nama Lengkap" htmlFor="admin-profile-name">
            <Input placeholder="Contoh: Ahmad Fauzi"
              id="admin-profile-name"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="admin-profile-email">
            <Input id="admin-profile-email" type="email" value={profile.email} readOnly disabled />
          </Field>
          <Field label="Grup Pengguna" htmlFor="admin-profile-group">
            <Input
              id="admin-profile-group"
              value={profile.group ?? ROLE_LABEL[profile.role]}
              readOnly
              disabled
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">Status Akun</p>
            <Tag tone={profile.setupStatus === "aktif" ? "success" : "muted"}>
              {SETUP_LABEL[profile.setupStatus ?? ""] ?? "Tidak diketahui"}
            </Tag>
          </div>
          <Button type="submit" disabled={saving || name.trim() === profile.name}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{" "}
            Simpan Nama
          </Button>
        </form>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          Email, peran, dan grup hak akses tidak dapat diubah dari halaman profil.
        </p>
      </Panel>
      <Panel title="Keamanan akun">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-muted-foreground">
            Atur kata sandi melalui tautan verifikasi yang dikirim ke email akun.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void sendPasswordLink()}
            disabled={sending}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}{" "}
            Kirim Tautan Kata Sandi
          </Button>
        </div>
      </Panel>
    </>
  );
}
