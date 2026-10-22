import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, Tag, Field, ConfirmAction, Empty, NativeSelect, DataTable, RowActions } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc, ROLE_LABEL, type AdminRole } from "@/lib/admin";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/manajemen-admin")({
  head: () => ({ meta: [{ title: "Manajemen Admin | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="admins.manage"><Page /></Guard>,
});

const ROLE_DESC: Record<AdminRole, string> = {
  superadmin: "Akses penuh, termasuk manajemen admin dan konfigurasi sistem.",
  finance: "Transaksi, verifikasi, rekonsiliasi, konfigurasi pembayaran, pengembalian, ekspor keuangan.",
  program: "Kategori & harga, periode & akad, alokasi, pengumuman H-7, pelaksanaan, dokumentasi, koreksi peserta.",
  field_officer: "Hanya unggah dokumentasi yang diizinkan.",
  auditor: "Hanya baca laporan keuangan, operasional, dan audit (termasuk ekspor).",
  content: "Konten perjalanan, dokumentasi, laporan dampak, dan notifikasi (kompatibilitas).",
};

function Page() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "members"],
    queryFn: async () => {
      const r = await supabase.from("admin_members").select("*").order("created_at");
      if (r.error) throw new Error(r.error.message);
      const p = await supabase.from("profiles").select("id, full_name, email").in("id", (r.data ?? []).map((m) => m.user_id));
      const map = new Map((p.data ?? []).map((x) => [x.id, x]));
      return (r.data ?? []).map((m) => ({ ...m, profile: map.get(m.user_id) }));
    },
  });
  const activity = useQuery({
    queryKey: ["admin", "member-activity"],
    queryFn: async () => { const r = await supabase.from("audit_logs").select("*").eq("action", "admin.role_change").order("created_at", { ascending: false }).limit(30); if (r.error) throw new Error(r.error.message); return r.data; },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "members"] }); qc.invalidateQueries({ queryKey: ["admin", "member-activity"] }); };
  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageHead to="/admin/manajemen-admin"><p className="mt-1 text-xs text-muted-foreground">Calon admin harus mendaftar akun terlebih dahulu. Kamu tidak dapat mengubah peranmu sendiri, dan minimal satu SUPERADMIN harus tetap aktif. Semua perubahan tercatat di audit log.</p></PageHead>
      <MemberForm onDone={refresh} />
      <Panel title="Daftar admin">
        {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} /> : (
          <DataTable rows={q.data} rowKey={(r) => r.user_id} empty={<Empty title="Belum ada admin" />} cols={[
            { label: "Nama", primary: true, cell: (r) => r.profile?.full_name ?? "—" },
            { label: "Email", cell: (r) => <span className="break-all">{r.profile?.email}</span> },
            { label: "Peran", cell: (r) => <Tag tone="primary">{ROLE_LABEL[r.role]}</Tag> },
            { label: "Status", cell: (r) => (r.is_active ? <Tag tone="success">Aktif</Tag> : <Tag tone="danger">Nonaktif</Tag>) },
            { label: "Sejak", cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium" }) },
            { label: "Aksi", cell: (r) => r.profile && (
              <ConfirmAction title={r.is_active ? `Nonaktifkan ${r.profile.full_name}?` : `Aktifkan ${r.profile.full_name}?`} minReason={5} destructive={r.is_active} confirmLabel={r.is_active ? "Nonaktifkan" : "Aktifkan"}
                onConfirm={async (reason) => { await rpc("admin_set_member", { p_email: r.profile!.email, p_role: r.role, p_active: !r.is_active, p_reason: reason }); toast.success("Status admin diperbarui"); refresh(); }}
                trigger={(o) => <button type="button" className="text-xs font-semibold text-primary underline" onClick={o}>{r.is_active ? "Nonaktifkan" : "Aktifkan"}</button>} />
            ) },
          ]} />
        )}
      </Panel>
      <Panel title="Aktivitas perubahan peran">
        {activity.isPending ? <Loading /> : activity.isError ? <Failure error={activity.error} /> : !activity.data.length ? <Empty title="Belum ada perubahan" /> : (
          <ul className="divide-y divide-border text-sm">{activity.data.map((a) => {
            const n = a.new_values as { email?: string; role?: string; is_active?: boolean } | null;
            const o = a.old_values as { role?: string; is_active?: boolean } | null;
            return <li key={a.id} className="py-1.5"><b>{n?.email}</b>: {o ? `${o.role}${o.is_active ? "" : " (nonaktif)"} → ` : "baru → "}{n?.role}{n?.is_active ? "" : " (nonaktif)"} <span className="text-xs text-muted-foreground">· {a.reason} · {formatDate(new Date(a.created_at), { dateStyle: "medium", timeStyle: "short" })}</span></li>;
          })}</ul>
        )}
      </Panel>
    </div>
  );
}

function MemberForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("program");
  const [err, setErr] = useState<string | null>(null);
  return (
    <Panel title="Tambah / ubah peran admin">
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <Field label="Email akun terdaftar" htmlFor="m-email" error={err ?? undefined}><Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Peran" htmlFor="m-role"><NativeSelect label="Peran" value={role} onChange={(v) => setRole(v as AdminRole)} className="w-full">{(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</NativeSelect></Field>
        <ConfirmAction title={`Tetapkan ${ROLE_LABEL[role]} untuk ${email}?`} description={ROLE_DESC[role]} minReason={5} confirmLabel="Tetapkan peran"
          onConfirm={async (reason) => { await rpc("admin_set_member", { p_email: email, p_role: role, p_active: true, p_reason: reason }); toast.success("Peran admin ditetapkan"); setEmail(""); onDone(); }}
          trigger={(o) => <Button onClick={() => { if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Email tidak valid"); setErr(null); o(); }}>Tetapkan</Button>} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{ROLE_DESC[role]}</p>
    </Panel>
  );
}
