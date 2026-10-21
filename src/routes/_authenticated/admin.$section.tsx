import { useEffect, useState } from "react";
import { createFileRoute, notFound, useBlocker } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, Field, ConfirmAction, PendingIntegration } from "@/components/admin/ui";
import { LedgerTable } from "@/components/admin/finance";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { rpc, useAdmin } from "@/lib/admin";
import { ADMIN_ITEMS } from "@/lib/navigation";

type FieldDef = { key: string; label: string; kind?: "text" | "textarea" | "number" | "bool"; hint?: string };
const SETTINGS: Record<string, { key: string; perm: string; fields: FieldDef[]; note?: string }> = {
  identitas: { key: "organization", perm: "settings.manage", note: "Dokumen yang sudah terbit menyimpan snapshot penerbitnya sendiri; perubahan di sini hanya berlaku untuk dokumen baru.", fields: [
    { key: "name", label: "Nama organisasi" }, { key: "logo_url", label: "URL logo" }, { key: "email", label: "Email" }, { key: "whatsapp", label: "WhatsApp" },
    { key: "address", label: "Alamat", kind: "textarea" }, { key: "legal_entity", label: "Informasi legal (badan hukum, nomor izin)", kind: "textarea" },
    { key: "issuer_name", label: "Nama penerbit dokumen" }, { key: "issuer_title", label: "Jabatan penerbit" }] },
  konten: { key: "website_content", perm: "content.manage", note: "Disimpan untuk dipakai halaman publik; menghubungkan halaman publik ke konten ini dijadwalkan pada fase berikutnya.", fields: [
    { key: "hero_title", label: "Judul beranda" }, { key: "hero_subtitle", label: "Subjudul beranda", kind: "textarea" },
    { key: "contact_email", label: "Email kontak" }, { key: "contact_whatsapp", label: "WhatsApp kontak" }, { key: "program_info", label: "Informasi program publik", kind: "textarea" }] },
  notifikasi: { key: "notifications", perm: "notifications.manage", note: "Templat disimpan; pengiriman notifikasi belum aktif. Variabel: {nama}, {kode}, {nominal}.", fields: [
    { key: "payment_reminder", label: "Pengingat setoran", kind: "textarea" }, { key: "payment_verified", label: "Pembayaran terverifikasi", kind: "textarea" },
    { key: "h7_announcement", label: "Pengumuman H-7", kind: "textarea" }, { key: "channels_email", label: "Kanal email", kind: "bool" }, { key: "channels_whatsapp", label: "Kanal WhatsApp", kind: "bool" }] },
  "karakter-hewan": { key: "animal_characters", perm: "characters.manage", note: "Hanya tampilan Padang Kurban; tidak memengaruhi catatan keuangan.", fields: [
    { key: "cow_names", label: "Nama karakter sapi (pisahkan koma)" }, { key: "goat_names", label: "Nama karakter kambing (pisahkan koma)" }, { key: "show_names", label: "Tampilkan nama karakter", kind: "bool" }] },
  "nominal-pembayaran": { key: "payment_config", perm: "payments.config", note: "Konfigurasi disiapkan. Pemrosesan pembayaran nyata tidak dapat diaktifkan dari sini.", fields: [
    { key: "minimum_payment", label: "Minimum pembayaran (Rp)", kind: "number" }, { key: "maximum_payment", label: "Maksimum pembayaran (Rp)", kind: "number" },
    { key: "presets", label: "Nominal cepat (pisahkan koma)" }, { key: "methods", label: "Metode pembayaran (pisahkan koma)" }, { key: "service_fee", label: "Biaya layanan (Rp)", kind: "number" }] },
  "pengaturan-website": { key: "website", perm: "settings.manage", fields: [
    { key: "maintenance_mode", label: "Mode pemeliharaan", kind: "bool" }, { key: "show_countdown", label: "Tampilkan hitung mundur", kind: "bool" }, { key: "show_impact_samples", label: "Tampilkan data contoh dampak", kind: "bool" }] },
};
const PENDING = ["transaksi", "verifikasi", "pembatalan", "pemulihan-akun"];

export const Route = createFileRoute("/_authenticated/admin/$section")({
  loader: ({ params }) => {
    if (!SETTINGS[params.section] && !PENDING.includes(params.section)) throw notFound();
    return { section: params.section };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${ADMIN_ITEMS.find((i) => i.to === `/admin/${loaderData?.section}`)?.label ?? "Admin"} | Admin qurbanity` }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const { section } = Route.useLoaderData();
  const to = `/admin/${section}`;
  const item = ADMIN_ITEMS.find((i) => i.to === to)!;
  return (
    <Guard perms={item.perms}>
      <div className="mx-auto max-w-5xl space-y-3">
        <PageHead to={to} />
        {section === "transaksi" && <>
          <PendingIntegration title="Pembayaran belum terhubung">Daftar di bawah menampilkan entri ledger asli. Belum ada pembayaran masuk karena integrasi pembayaran belum aktif.</PendingIntegration>
          <LedgerTable program="" account="EXTERNAL" title="Dana masuk & keluar" />
        </>}
        {section === "verifikasi" && <PendingIntegration title="Antrian verifikasi pembayaran">Pembayaran baru masuk antrian setelah gateway atau unggah bukti transfer aktif. Verifikasi akan memposting EXTERNAL → COMMITMENT di ledger dan memperbarui progres peserta.</PendingIntegration>}
        {section === "pembatalan" && <PendingIntegration title="Pengajuan pembatalan">Pembatalan memerlukan dana terverifikasi untuk menghitung biaya pembatalan (CANCEL_COST) dan pengembalian (REFUND). Ketentuan pembatalan menunggu teks akad resmi.</PendingIntegration>}
        {section === "pemulihan-akun" && (
          <Panel title="Pemulihan akun">
            <p className="text-sm text-muted-foreground">Saat ini peserta memulihkan akses melalui tautan atur ulang kata sandi via email. Kode pemulihan khusus sesuai PRD <b>belum dibangun</b>.</p>
          </Panel>
        )}
        {SETTINGS[section] && <SettingsEditor def={SETTINGS[section]} />}
      </div>
    </Guard>
  );
}

function SettingsEditor({ def }: { def: (typeof SETTINGS)[string] }) {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const editable = can(def.perm);
  const q = useQuery({
    queryKey: ["admin", "setting", def.key],
    queryFn: async () => { const r = await supabase.from("app_settings").select("*").eq("key", def.key).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data; },
  });
  const [val, setVal] = useState<Record<string, unknown>>({});
  useEffect(() => { if (q.data) setVal((q.data.value as Record<string, unknown>) ?? {}); }, [q.data]);
  const saved = JSON.stringify((q.data?.value as Record<string, unknown>) ?? {});
  const dirty = q.isSuccess && JSON.stringify(val) !== saved;
  useBlocker({ shouldBlockFn: () => dirty && !window.confirm("Perubahan belum disimpan. Tinggalkan halaman ini?"), enableBeforeUnload: () => dirty });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Panel>
      {def.note && <p className="mb-3 rounded bg-muted/60 p-2 text-xs text-muted-foreground">{def.note}</p>}
      {!editable && <p className="mb-3 text-xs text-muted-foreground">Mode baca saja untuk peranmu.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {def.fields.map((f) => {
          const id = `s-${f.key}`;
          const v = val[f.key];
          if (f.kind === "bool") return <label key={f.key} className="flex items-center gap-2 text-sm"><Switch id={id} disabled={!editable} checked={!!v} onCheckedChange={(c) => setVal({ ...val, [f.key]: c })} />{f.label}</label>;
          return (
            <div key={f.key} className={f.kind === "textarea" ? "sm:col-span-2" : ""}>
              <Field label={f.label} htmlFor={id}>
                {f.kind === "textarea"
                  ? <Textarea id={id} rows={3} disabled={!editable} value={String(v ?? "")} onChange={(e) => setVal({ ...val, [f.key]: e.target.value })} />
                  : <Input id={id} disabled={!editable} inputMode={f.kind === "number" ? "numeric" : undefined} value={String(v ?? "")}
                      onChange={(e) => setVal({ ...val, [f.key]: f.kind === "number" ? Number(e.target.value.replace(/\D/g, "") || 0) : e.target.value })} />}
              </Field>
            </div>
          );
        })}
      </div>
      {editable && (
        <ConfirmAction title="Simpan pengaturan?" description="Nilai lama dan baru dicatat di audit log." confirmLabel="Simpan"
          onConfirm={async () => { await rpc("admin_set_setting", { p_key: def.key, p_value: val }); toast.success("Pengaturan tersimpan"); qc.invalidateQueries({ queryKey: ["admin", "setting", def.key] }); }}
          trigger={(o) => (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button size="sm" onClick={o} disabled={!dirty}>Simpan perubahan</Button>
              {dirty && <><Button size="sm" variant="ghost" onClick={() => setVal(JSON.parse(saved))}>Batalkan</Button><span className="text-xs font-semibold text-warning">Ada perubahan yang belum disimpan</span></>}
            </div>
          )} />
      )}
    </Panel>
  );
}
