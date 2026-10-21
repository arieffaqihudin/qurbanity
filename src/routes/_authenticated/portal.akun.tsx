import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, ErrorState, LoadingState, PaymentBadge } from "@/components/portal/StatusUI";
import { FieldError } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { commitmentsQuery, consentsQuery, latestPublicationQuery, notifQuery, profileQuery, type PublicationPref } from "@/lib/portal-data";
import { normalizeWhatsapp, profileSchema } from "@/lib/validation";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/portal/akun")({
  head: () => ({ meta: [{ title: "Akun & Profil | Portal Peserta qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const profile = useQuery(profileQuery);
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />;
  if (!profile.data) return <ErrorState message="Profil tidak ditemukan." />;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">Akun & Profil</h1><p className="text-muted-foreground">Kelola data diri, notifikasi, dan persetujuanmu.</p></div>
      <ProfileForm p={profile.data} />
      <Preferences whatsappConsent={profile.data.whatsapp_consent} />
      <Publication />
      <History />
      <Consents />
    </div>
  );
}

function ProfileForm({ p }: { p: Database["public"]["Tables"]["profiles"]["Row"] }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: p.full_name, whatsapp: p.whatsapp, address: p.address });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = profileSchema.safeParse(f);
    if (!r.success) { const m: Record<string, string> = {}; r.error.issues.forEach((i) => { m[String(i.path[0])] ??= i.message; }); { setErrs(m); return; } }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: r.data.full_name, whatsapp: normalizeWhatsapp(r.data.whatsapp)!, address: r.data.address }).eq("id", p.id);
    setSaving(false);
    if (error) { toast.error("Profil gagal disimpan."); return; }
    toast.success("Profil tersimpan.");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  return (
    <Card title="Data diri">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div><Label htmlFor="full_name">Nama lengkap</Label><Input id="full_name" className="mt-1.5 h-11" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} aria-invalid={!!errs["full_name"]} /><FieldError id="fn-err" msg={errs["full_name"]} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="whatsapp">Nomor WhatsApp</Label><Input id="whatsapp" type="tel" className="mt-1.5 h-11" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} aria-invalid={!!errs["whatsapp"]} /><FieldError id="wa-err" msg={errs["whatsapp"]} /></div>
          <div><Label htmlFor="email" className="flex items-center gap-1">Email <Lock className="size-3" /></Label><Input id="email" className="mt-1.5 h-11" value={p.email} disabled /></div>
        </div>
        <div><Label htmlFor="birth" className="flex items-center gap-1">Tanggal lahir <Lock className="size-3" /></Label><Input id="birth" className="mt-1.5 h-11" value={formatDate(new Date(`${p.birth_date}T00:00:00+07:00`))} disabled /><p className="mt-1 text-xs text-muted-foreground">Email dan tanggal lahir hanya dapat diubah melalui tim kami.</p></div>
        <div><Label htmlFor="address">Alamat</Label><Textarea id="address" rows={3} className="mt-1.5" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} aria-invalid={!!errs["address"]} /><FieldError id="ad-err" msg={errs["address"]} /></div>
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />} Simpan profil</Button>
      </form>
    </Card>
  );
}

function Preferences({ whatsappConsent }: { whatsappConsent: boolean }) {
  const qc = useQueryClient();
  const n = useQuery(notifQuery);
  const [wa, setWa] = useState(whatsappConsent);
  useEffect(() => setWa(whatsappConsent), [whatsappConsent]);
  const update = async (patch: Record<string, boolean>) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("notification_preferences").upsert({ user_id: u.user!.id, ...(n.data ?? {}), ...patch });
    if (error) { toast.error("Preferensi gagal disimpan."); return; }
    qc.invalidateQueries({ queryKey: ["notif"] });
    toast.success("Preferensi tersimpan.");
  };
  const toggleWa = async (v: boolean) => {
    setWa(v);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ whatsapp_consent: v }).eq("id", u.user!.id);
    if (error) { setWa(!v); { toast.error("Persetujuan WhatsApp gagal disimpan."); return; } }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success(v ? "Kamu setuju dihubungi via WhatsApp." : "Persetujuan WhatsApp dicabut.");
  };
  const rows: { k: "email_enabled" | "whatsapp_enabled" | "payment_reminders" | "journey_updates"; label: string; desc: string }[] = [
    { k: "email_enabled", label: "Notifikasi email", desc: "Kabar penting melalui email." },
    { k: "whatsapp_enabled", label: "Notifikasi WhatsApp", desc: "Memerlukan persetujuan WhatsApp di atas." },
    { k: "payment_reminders", label: "Pengingat setoran", desc: "Sesuai rencana frekuensi setoranmu." },
    { k: "journey_updates", label: "Kabar perjalanan kurban", desc: "Alokasi, penyembelihan, distribusi." },
  ];
  return (
    <Card title="Notifikasi & WhatsApp">
      <div className="flex items-start justify-between gap-4 rounded-xl bg-muted p-4">
        <div><Label htmlFor="wa-consent" className="font-bold">Persetujuan dihubungi via WhatsApp</Label><p className="text-sm text-muted-foreground">Kamu dapat mencabutnya kapan saja.</p></div>
        <Switch id="wa-consent" checked={wa} onCheckedChange={toggleWa} />
      </div>
      {n.isPending ? <LoadingState /> : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.k} className="flex items-center justify-between gap-4 py-3">
              <div><Label htmlFor={r.k} className="font-semibold">{r.label}</Label><p className="text-sm text-muted-foreground">{r.desc}</p></div>
              <Switch id={r.k} checked={!!n.data?.[r.k]} disabled={r.k === "whatsapp_enabled" && !wa} onCheckedChange={(v) => update({ [r.k]: v })} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Publication() {
  const qc = useQueryClient();
  const q = useQuery(latestPublicationQuery);
  const set = async (pref: PublicationPref) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("participant_publication_consents").insert({ user_id: u.user!.id, preference: pref });
    if (error) { toast.error("Preferensi gagal disimpan."); return; }
    qc.invalidateQueries({ queryKey: ["publication"] });
    toast.success("Preferensi publikasi tersimpan.");
  };
  const opts: [PublicationPref, string][] = [["full", "Nama lengkap"], ["masked", "Disamarkan"], ["private", "Tidak dipublikasikan"]];
  return (
    <Card title="Publikasi nama (default akun)">
      <p className="mb-3 text-sm text-muted-foreground">Berlaku untuk laporan umum. Preferensi per komitmen tercatat saat akad. Setiap perubahan disimpan sebagai riwayat.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {opts.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={q.data?.preference === v} onClick={() => set(v)} className={cn("min-h-11 rounded-xl border-2 p-3 text-sm font-semibold", q.data?.preference === v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>{l}</button>
        ))}
      </div>
    </Card>
  );
}

function History() {
  const q = useQuery(commitmentsQuery);
  return (
    <Card title="Riwayat komitmen">
      {q.isPending ? <LoadingState /> : !q.data?.length ? <p className="text-sm text-muted-foreground">Belum ada komitmen.</p> : (
        <ul className="divide-y divide-border">
          {q.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <Link to="/portal/kurban-saya/$id" params={{ id: c.id }} className="font-semibold text-primary hover:underline">{c.code} · {c.category_name_snapshot}</Link>
              <span className="flex items-center gap-2 text-sm tabular-nums">{formatRupiah(c.total_amount)} <PaymentBadge status={c.payment_status} /></span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Consents() {
  const q = useQuery(consentsQuery);
  return (
    <Card title="Catatan persetujuan akad">
      <p className="mb-3 text-sm text-muted-foreground">Catatan ini bersifat permanen dan tidak dapat diubah.</p>
      {q.isPending ? <LoadingState /> : !q.data?.length ? <p className="text-sm text-muted-foreground">Belum ada catatan.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-muted-foreground"><tr><th className="py-2 font-semibold">Komitmen</th><th className="font-semibold">Akad</th><th className="font-semibold">Versi</th><th className="font-semibold">Keputusan</th><th className="font-semibold">Waktu (WIB)</th></tr></thead>
            <tbody className="divide-y divide-border">
              {q.data.map((k) => (
                <tr key={k.id}>
                  <td className="py-2 font-semibold">{k.qurban_commitments?.code}</td>
                  <td>{k.contract_versions?.title.split(" — ")[0]}</td>
                  <td>{k.contract_version}{k.contract_status_at_consent === "draft" && " (draf)"}</td>
                  <td className={k.decision === "accepted" ? "font-semibold text-success" : "text-muted-foreground"}>{k.decision === "accepted" ? "Setuju" : "Tidak setuju"}</td>
                  <td className="tabular-nums">{formatDate(new Date(k.consented_at), { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
