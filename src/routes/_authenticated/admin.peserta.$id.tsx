import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Guard, Panel, Loading, Failure, Empty, Tag, Field, ConfirmAction } from "@/components/admin/ui";
import { PaymentBadge, ExecutionBadge } from "@/components/portal/StatusUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc, useAdmin, LEDGER_LABEL } from "@/lib/admin";
import { normalizeWhatsapp } from "@/lib/validation";
import { formatRupiah, formatDate } from "@/lib/format";

import { z } from "zod";

// Same filter keys as the participant list, carried so "back" restores the list exactly.
const listSearch = z.object({ q: z.string().optional(), status: z.string().optional(), program: z.string().optional(), page: z.coerce.number().int().min(0).optional() });

export const Route = createFileRoute("/_authenticated/admin/peserta/$id")({
  validateSearch: listSearch,
  head: () => ({ meta: [{ title: "Detail Peserta | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="participants.view"><Page /></Guard>,
});

const PUB: Record<string, string> = { full: "Nama lengkap", masked: "Disamarkan", private: "Privat (hanya diri sendiri)" };
const dt = (s: string) => formatDate(new Date(s), { dateStyle: "medium", timeStyle: "short" });

function Page() {
  const { id } = Route.useParams();
  const back = Route.useSearch();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "participant", id],
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("qurban_commitments").select("*, qurban_shares(id, position, shahibul_name), contract_consents(*), participant_publication_consents(preference, created_at)").eq("user_id", id).order("created_at", { ascending: false }),
      ]);
      if (p.error) throw new Error(p.error.message);
      if (c.error) throw new Error(c.error.message);
      return { profile: p.data, commitments: c.data ?? [] };
    },
  });
  const ids = q.data?.commitments.map((c) => c.id) ?? [];
  const ledger = useQuery({
    queryKey: ["admin", "participant-ledger", id, ids.join()], enabled: can("finance.view") && ids.length > 0,
    queryFn: async () => { const r = await supabase.from("ledger_entries").select("*").in("commitment_id", ids).order("created_at", { ascending: false }); if (r.error) throw new Error(r.error.message); return r.data; },
  });
  const audit = useQuery({
    queryKey: ["admin", "participant-audit", id, ids.join()], enabled: can("audit.view"),
    queryFn: async () => { const r = await supabase.from("audit_logs").select("*").in("entity_id", [id, ...ids]).order("created_at", { ascending: false }).limit(50); if (r.error) throw new Error(r.error.message); return r.data; },
  });

  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure error={q.error} onRetry={() => q.refetch()} />;
  const { profile, commitments } = q.data;
  if (!profile) return <Empty title="Peserta tidak ditemukan" />;
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "participant", id] }); qc.invalidateQueries({ queryKey: ["admin", "participants"] }); };

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <Link to="/admin/peserta" search={back} className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> Peserta</Link>
      <h1 className="text-xl font-extrabold text-burgundy-dark md:text-2xl">{profile.full_name}</h1>
      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="Profil & Kontak">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted-foreground">Email</dt><dd className="break-all">{profile.email}</dd>
            <dt className="text-muted-foreground">WhatsApp</dt><dd>{profile.whatsapp} {profile.whatsapp_consent ? <Tag tone="success">Izin WA</Tag> : <Tag>Tanpa izin WA</Tag>}</dd>
            <dt className="text-muted-foreground">Tanggal lahir</dt><dd>{formatDate(new Date(profile.birth_date), { dateStyle: "medium" })}</dd>
            <dt className="text-muted-foreground">Alamat</dt><dd>{profile.address}</dd>
            <dt className="text-muted-foreground">Bergabung</dt><dd>{dt(profile.created_at)}</dd>
          </dl>
          {can("participants.edit") && <CorrectProfile profile={profile} onDone={refresh} />}
        </Panel>
        <Panel title={`Komitmen (${commitments.length})`}>
          {commitments.length === 0 ? <Empty title="Belum ada komitmen" /> : (
            <ul className="space-y-3">
              {commitments.map((c) => {
                const pub = [...(c.participant_publication_consents ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                return (
                  <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{c.code}</span><span className="text-muted-foreground">{c.category_name_snapshot} · {c.shares}/{c.animal_kind_snapshot === "sapi" ? 7 : 1}</span>
                      <span className="ml-auto flex gap-1"><PaymentBadge status={c.payment_status} /><ExecutionBadge status={c.execution_status} /></span></div>
                    <p className="mt-1 tabular-nums">Terverifikasi {formatRupiah(c.verified_paid_amount)} dari {formatRupiah(c.total_amount)} <span className="text-xs text-muted-foreground">(harga terkunci; hewan {formatRupiah(c.animal_cost_snapshot)} + operasional {formatRupiah(c.operational_cost_snapshot)})</span></p>
                    <p className="text-xs text-muted-foreground">Publikasi nama: {pub ? PUB[pub.preference] : "—"}{c.animal_label ? ` · Unit ${c.animal_label}` : ""}</p>
                    <p className="mt-2 text-xs font-bold text-muted-foreground">Shahibul kurban</p>
                    <ul className="mt-1 space-y-1">{[...c.qurban_shares].sort((a, b) => a.position - b.position).map((s) => (
                      <li key={s.id} className="flex items-center gap-2"><span className="w-5 text-xs text-muted-foreground">{s.position}.</span>{s.shahibul_name}
                        {can("participants.edit") && <CorrectShahibul shareId={s.id} current={s.shahibul_name} onDone={refresh} />}</li>))}</ul>
                    <p className="mt-2 text-xs font-bold text-muted-foreground">Persetujuan akad</p>
                    <ul className="mt-1 space-y-0.5 text-xs">{c.contract_consents.map((k) => (
                      <li key={k.id}>{k.contract_code.toUpperCase()} v{k.contract_version} ({k.contract_status_at_consent === "draft" ? "draf" : "disetujui"}) — <b>{k.decision === "accepted" ? "Setuju" : "Tidak setuju"}</b> · {dt(k.consented_at)}</li>))}</ul>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Riwayat Pembayaran">
          {!can("finance.view") ? <p className="text-sm text-muted-foreground">Riwayat pembayaran hanya untuk peran keuangan/auditor.</p>
            : ledger.isPending && ids.length ? <Loading /> : ledger.isError ? <Failure error={ledger.error} />
            : !(ledger.data?.length) ? <Empty title="Belum ada pembayaran terverifikasi" text="Integrasi pembayaran belum aktif." />
            : <ul className="divide-y divide-border text-sm">{ledger.data.map((e) => <li key={e.id} className="flex flex-wrap gap-2 py-1.5"><span>{LEDGER_LABEL[e.source_account]} → {LEDGER_LABEL[e.dest_account]}</span><span className="ml-auto tabular-nums">{formatRupiah(e.amount)}</span><span className="w-full text-xs text-muted-foreground">{e.reference} · {dt(e.created_at)}</span></li>)}</ul>}
        </Panel>
        <Panel title="Riwayat Aktivitas">
          {!can("audit.view") ? <p className="text-sm text-muted-foreground">Riwayat aktivitas hanya untuk peran dengan akses audit.</p>
            : audit.isPending ? <Loading /> : audit.isError ? <Failure error={audit.error} />
            : !(audit.data?.length) ? <Empty title="Belum ada aktivitas" />
            : <ul className="divide-y divide-border text-sm">{audit.data.map((a) => <li key={a.id} className="py-1.5"><span className="font-mono text-xs">{a.action}</span> <span className="text-xs text-muted-foreground">· {dt(a.created_at)}</span>{a.reason && <p className="text-xs">Alasan: {a.reason}</p>}</li>)}</ul>}
        </Panel>
      </div>
    </div>
  );
}

function CorrectProfile({ profile, onDone }: { profile: { id: string; full_name: string; whatsapp: string; address: string; birth_date: string }; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: profile.full_name, whatsapp: profile.whatsapp, address: profile.address, birth_date: profile.birth_date });
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}><Pencil className="size-3.5" /> Koreksi data</Button>;
  const changes = () => {
    const out: Partial<Record<"full_name" | "whatsapp" | "address" | "birth_date", string>> = {};
    if (f.full_name.trim() !== profile.full_name) out.full_name = f.full_name.trim();
    if (f.address.trim() !== profile.address) out.address = f.address.trim();
    if (f.birth_date !== profile.birth_date) out.birth_date = f.birth_date;
    if (f.whatsapp !== profile.whatsapp) { const n = normalizeWhatsapp(f.whatsapp); if (!n) throw new Error("Nomor WhatsApp tidak valid"); out.whatsapp = n; }
    if (!Object.keys(out).length) throw new Error("Belum ada perubahan");
    return out;
  };
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">Hanya data diri yang boleh dikoreksi. Harga, akad, dan snapshot komitmen tidak dapat diubah.</p>
      <Field label="Nama lengkap" htmlFor="c-name"><Input id="c-name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="WhatsApp" htmlFor="c-wa"><Input id="c-wa" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
      <Field label="Tanggal lahir" htmlFor="c-bd"><Input id="c-bd" type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></Field>
      <Field label="Alamat" htmlFor="c-addr"><Input id="c-addr" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
        <ConfirmAction title="Simpan koreksi data peserta?" description="Nilai lama dan baru akan dicatat di audit log." minReason={5} confirmLabel="Simpan koreksi"
          onConfirm={async (reason) => { await rpc("admin_correct_profile", { p_user_id: profile.id, p_changes: changes(), p_reason: reason }); toast.success("Koreksi tersimpan"); setOpen(false); onDone(); }}
          trigger={(o) => <Button size="sm" onClick={() => { try { changes(); setErr(null); o(); } catch (e) { setErr((e as Error).message); } }}>Simpan</Button>} />
      </div>
    </div>
  );
}

function CorrectShahibul({ shareId, current, onDone }: { shareId: string; current: string; onDone: () => void }) {
  const [name, setName] = useState(current);
  return (
    <ConfirmAction title="Koreksi nama shahibul" minReason={5} confirmLabel="Simpan"
      description={<div className="space-y-1"><p>Koreksi tidak mengubah harga atau akad. Tidak bisa dilakukan setelah alokasi dikunci.</p><Input aria-label="Nama shahibul baru" value={name} onChange={(e) => setName(e.target.value)} /></div>}
      onConfirm={async (reason) => { await rpc("admin_correct_shahibul", { p_share_id: shareId, p_name: name, p_reason: reason }); toast.success("Nama shahibul dikoreksi"); onDone(); }}
      trigger={(o) => <button type="button" onClick={o} className="ml-auto text-xs font-semibold text-primary underline">Koreksi</button>} />
  );
}
