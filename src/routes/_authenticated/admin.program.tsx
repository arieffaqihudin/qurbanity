import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, Tag, Field, ConfirmAction, Empty, NativeSelect } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { rpc, useAdmin, programsQuery, PROGRAM_STATUS_LABEL } from "@/lib/admin";
import { formatRupiah, formatDate } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/program")({
  head: () => ({ meta: [{ title: "Program & Akad | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="program.view"><Page /></Guard>,
});

type Program = Database["public"]["Tables"]["programs"]["Row"];
type Contract = Database["public"]["Tables"]["contract_versions"]["Row"];
const TYPE_LABEL: Record<string, string> = { akad_1: "PURCHASE (Akad 1)", akad_2a: "EXCESS_ALLOCATION (Akad 2A)", akad_2b: "SEDEKAH_TRANSFER (Akad 2B)" };
const toLocal = (s: string | null) => (s ? new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : "");
const fromLocal = (s: string) => (s ? `${s}:00+07:00` : "");

function Page() {
  const { can } = useAdmin();
  const q = useQuery(programsQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Program | "new" | null>(null);
  const [selected, setSelected] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const current = selected || q.data?.find((p) => p.status === "open")?.id || q.data?.[0]?.id || "";
  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageHead to="/admin/program" actions={can("program.manage") && <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> Periode baru</Button>} />
      {editing && <ProgramForm program={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <Panel title="Periode program">
        {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} /> : q.data.length === 0 ? <Empty title="Belum ada periode" /> : (
          <ul className="divide-y divide-border">
            {q.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <button type="button" onClick={() => setSelected(p.id)} className={`font-bold ${current === p.id ? "text-primary underline" : "text-burgundy-dark"}`}>{p.name}</button>
                <Tag tone={p.status === "open" ? "success" : "muted"}>{PROGRAM_STATUS_LABEL[p.status]}</Tag>
                <span className="text-muted-foreground">Iduladha {formatDate(new Date(p.iduladha_date), { dateStyle: "medium" })} ({p.date_status === "official" ? "RESMI" : "PERKIRAAN"}) · batas {formatDate(new Date(p.payment_deadline), { dateStyle: "medium" })} · min. {formatRupiah(p.minimum_payment)} · H-{p.announcement_days}</span>
                {can("program.manage") && (
                  <div className="ml-auto flex gap-2">
                    <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setEditing(p)}>Ubah</button>
                    <StatusChanger program={p} onDone={refresh} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {current && <Contracts programId={current} />}
    </div>
  );
}

function StatusChanger({ program, onDone }: { program: Program; onDone: () => void }) {
  const [to, setTo] = useState<Program["status"]>(program.status);
  return (
    <ConfirmAction title={`Ubah status ${program.name}?`} minReason={5} confirmLabel="Ubah status"
      description={<div className="space-y-2"><p>Hanya satu periode boleh berstatus Dibuka. Komitmen baru hanya diterima saat Dibuka dan sebelum batas pelunasan.</p>
        <NativeSelect label="Status baru" value={to} onChange={(v) => setTo(v as Program["status"])}>{Object.entries(PROGRAM_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>}
      onConfirm={async (reason) => { await rpc("admin_set_program_status", { p_id: program.id, p_status: to, p_reason: reason }); toast.success("Status periode diperbarui"); onDone(); }}
      trigger={(o) => <button type="button" className="text-xs font-semibold text-primary underline" onClick={o}>Status</button>} />
  );
}

function ProgramForm({ program, onClose, onSaved }: { program: Program | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    hijri_year: String(program?.hijri_year ?? ""), name: program?.name ?? "", iduladha_date: program?.iduladha_date ?? "", date_status: program?.date_status ?? "estimated",
    registration_opens_at: toLocal(program?.registration_opens_at ?? null), payment_deadline: toLocal(program?.payment_deadline ?? null),
    minimum_payment: String(program?.minimum_payment ?? 10000), announcement_days: String(program?.announcement_days ?? 7),
  });
  const [err, setErr] = useState<Partial<Record<keyof typeof f, string>>>({});
  const validate = () => {
    const e: Partial<Record<keyof typeof f, string>> = {};
    if (!program && !/^1[4-5]\d\d$/.test(f.hijri_year)) e.hijri_year = "Tahun Hijriah 4 digit, mis. 1449";
    if (f.name.trim().length < 5) e.name = "Nama minimal 5 karakter";
    if (!f.iduladha_date) e.iduladha_date = "Wajib diisi";
    if (!f.payment_deadline) e.payment_deadline = "Wajib diisi";
    else if (f.iduladha_date && f.payment_deadline.slice(0, 10) >= f.iduladha_date) e.payment_deadline = "Harus sebelum tanggal Iduladha";
    if (f.registration_opens_at && f.payment_deadline && f.registration_opens_at >= f.payment_deadline) e.registration_opens_at = "Harus sebelum batas pelunasan";
    if (!/^\d+$/.test(f.minimum_payment)) e.minimum_payment = "Bilangan bulat rupiah";
    const d = Number(f.announcement_days); if (!(d >= 1 && d <= 60)) e.announcement_days = "1–60 hari";
    setErr(e); return !Object.keys(e).length;
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel title={program ? `Ubah ${program.name}` : "Periode baru"}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!program && <Field label="Tahun Hijriah" htmlFor="p-y" error={err.hijri_year}><Input id="p-y" inputMode="numeric" value={f.hijri_year} onChange={set("hijri_year")} /></Field>}
        <Field label="Nama program" htmlFor="p-n" error={err.name}><Input id="p-n" value={f.name} onChange={set("name")} /></Field>
        <Field label="Tanggal Iduladha" htmlFor="p-i" error={err.iduladha_date}><Input id="p-i" type="date" value={f.iduladha_date} onChange={set("iduladha_date")} /></Field>
        <Field label="Status tanggal" htmlFor="p-ds"><select id="p-ds" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.date_status} onChange={set("date_status")}><option value="estimated">ESTIMATED (perkiraan)</option><option value="official">OFFICIAL (resmi)</option></select></Field>
        <Field label="Pembukaan pendaftaran (WIB)" htmlFor="p-r" error={err.registration_opens_at}><Input id="p-r" type="datetime-local" value={f.registration_opens_at} onChange={set("registration_opens_at")} /></Field>
        <Field label="Batas pelunasan (WIB)" htmlFor="p-d" error={err.payment_deadline}><Input id="p-d" type="datetime-local" value={f.payment_deadline} onChange={set("payment_deadline")} /></Field>
        <Field label="Minimum pembayaran (Rp)" htmlFor="p-m" error={err.minimum_payment}><Input id="p-m" inputMode="numeric" value={f.minimum_payment} onChange={set("minimum_payment")} /></Field>
        <Field label="Pengumuman H- (hari)" htmlFor="p-a" error={err.announcement_days}><Input id="p-a" inputMode="numeric" value={f.announcement_days} onChange={set("announcement_days")} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Batal</Button>
        <ConfirmAction title="Simpan periode?" description={program ? "Perubahan dicatat di audit log." : "Periode baru dibuat sebagai Draf dan harus setelah periode sebelumnya."} confirmLabel="Simpan"
          onConfirm={async () => { await rpc("admin_save_program", { p_id: program?.id ?? null, p: { ...f, registration_opens_at: fromLocal(f.registration_opens_at), payment_deadline: fromLocal(f.payment_deadline) } }); toast.success("Periode tersimpan"); onSaved(); onClose(); }}
          trigger={(o) => <Button size="sm" onClick={() => validate() && o()}>Simpan</Button>} />
      </div>
    </Panel>
  );
}

function Contracts({ programId }: { programId: string }) {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "contracts", programId],
    queryFn: async () => { const r = await supabase.from("contract_versions").select("*").eq("program_id", programId).order("contract_code").order("created_at", { ascending: false }); if (r.error) throw new Error(r.error.message); return r.data as Contract[]; },
  });
  const re = useQuery({ queryKey: ["admin", "reconsent", programId], queryFn: () => rpc<{ contract_code: string; active_version: string; requires_reconsent: boolean; affected_commitments: number }[]>("admin_reconsent_candidates", { p_program_id: programId }) });
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  const [preview, setPreview] = useState<Contract | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
  return (
    <Panel title="Versi akad" action={can("program.manage") && <Button size="sm" variant="outline" onClick={() => setEditing("new")}><Plus className="size-4" /> Draf baru</Button>}>
      <p className="mb-2 text-xs text-muted-foreground">Draf tidak pernah dianggap disetujui. Versi yang sudah disetujui atau sudah disepakati peserta tidak dapat diubah — buat versi baru.</p>
      {editing && <ContractForm programId={programId} contract={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {re.data?.some((r) => r.affected_commitments > 0) && (
        <div className="mb-2 rounded-lg bg-warning/15 p-2 text-xs text-burgundy-dark">
          {re.data.filter((r) => r.affected_commitments > 0).map((r) => <p key={r.contract_code}>{TYPE_LABEL[r.contract_code]} v{r.active_version}: {r.affected_commitments} komitmen disepakati pada versi lama{r.requires_reconsent ? " — perlu persetujuan ulang (alur notifikasi peserta disiapkan untuk fase berikutnya)." : "."}</p>)}
        </div>
      )}
      {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} /> : (
        <ul className="divide-y divide-border text-sm">
          {q.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-semibold">{TYPE_LABEL[c.contract_code]}</span><span className="text-muted-foreground">v{c.version}</span>
              {c.status === "approved" ? <Tag tone="success">Disetujui</Tag> : c.status === "draft" ? <Tag tone="warning">Draf</Tag> : <Tag>Pensiun</Tag>}
              {c.is_active && <Tag tone="primary">Aktif</Tag>}
              {c.status === "approved" && <span className="text-xs text-muted-foreground">Syariah: {c.sharia_reviewer} · Hukum: {c.legal_reviewer} · {c.approved_at && formatDate(new Date(c.approved_at), { dateStyle: "medium", timeStyle: "short" })}</span>}
              <div className="ml-auto flex gap-2">
                <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setPreview(preview?.id === c.id ? null : c)}>Pratinjau</button>
                {can("program.manage") && c.status === "draft" && <>
                  <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setEditing(c)}>Ubah</button>
                  <Approve contract={c} onDone={refresh} />
                </>}
              </div>
              {preview?.id === c.id && <div className="w-full whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs"><p className="font-bold">{c.title}</p><p className="italic">{c.summary}</p><p className="mt-2">{c.body}</p></div>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Approve({ contract, onDone }: { contract: Contract; onDone: () => void }) {
  const [sharia, setSharia] = useState("");
  const [legal, setLegal] = useState("");
  return (
    <ConfirmAction title="Setujui versi akad?" confirmLabel="Setujui & aktifkan"
      description={<div className="space-y-2"><p>Versi aktif sebelumnya untuk jenis akad yang sama akan dinonaktifkan (tetap tersimpan). Isi akad terkunci setelah disetujui.</p>
        <Input aria-label="Nama peninjau syariah" placeholder="Nama peninjau syariah (DPS)" value={sharia} onChange={(e) => setSharia(e.target.value)} />
        <Input aria-label="Nama peninjau hukum" placeholder="Nama peninjau hukum" value={legal} onChange={(e) => setLegal(e.target.value)} /></div>}
      minReason={5}
      onConfirm={async (notes) => { await rpc("admin_approve_contract", { p_id: contract.id, p_sharia_reviewer: sharia, p_legal_reviewer: legal, p_notes: notes }); toast.success("Akad disetujui"); onDone(); }}
      trigger={(o) => <button type="button" className="text-xs font-semibold text-primary underline" onClick={o}>Setujui</button>} />
  );
}

function ContractForm({ programId, contract, onClose, onSaved }: { programId: string; contract: Contract | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ contract_code: contract?.contract_code ?? "akad_1", version: contract?.version ?? "", title: contract?.title ?? "", summary: contract?.summary ?? "", body: contract?.body ?? "", requires_reconsent: contract?.requires_reconsent ?? false });
  const [err, setErr] = useState<string | null>(null);
  const validate = () => {
    const e = !f.version.trim() ? "Versi wajib diisi" : f.title.trim().length < 5 ? "Judul minimal 5 karakter" : f.summary.trim().length < 10 ? "Ringkasan minimal 10 karakter" : f.body.trim().length < 20 ? "Isi akad minimal 20 karakter" : null;
    setErr(e); return !e;
  };
  return (
    <div className="mb-3 space-y-2 rounded-lg bg-muted/50 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Jenis akad" htmlFor="c-type"><select id="c-type" disabled={!!contract} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.contract_code} onChange={(e) => setF({ ...f, contract_code: e.target.value })}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Versi" htmlFor="c-ver"><Input id="c-ver" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} placeholder="1.0" /></Field>
        <Field label="Judul" htmlFor="c-title"><Input id="c-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      </div>
      <Field label="Ringkasan" htmlFor="c-sum"><Input id="c-sum" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field>
      <Field label="Isi akad" htmlFor="c-body"><Textarea id="c-body" rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.requires_reconsent} onCheckedChange={(v) => setF({ ...f, requires_reconsent: v === true })} />Perubahan memengaruhi komitmen yang ada (perlu persetujuan ulang)</label>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>Batal</Button>
        <Button size="sm" onClick={async () => {
          if (!validate()) return;
          try { await rpc("admin_save_contract_draft", { p_id: contract?.id ?? null, p: { ...f, program_id: programId } }); toast.success("Draf akad tersimpan"); onSaved(); onClose(); }
          catch (e) { setErr((e as Error).message); }
        }}>Simpan draf</Button>
      </div>
    </div>
  );
}
