import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, Tag, Field, ConfirmAction, Empty, NativeSelect, SearchBox } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc, useAdmin } from "@/lib/admin";
import { useCatalog, useDefaultProgram } from "@/lib/admin-hooks";

export const Route = createFileRoute("/_authenticated/admin/alokasi")({
  head: () => ({ meta: [{ title: "Alokasi & Kelompok Hewan | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="allocation.view"><Page /></Guard>,
});

const UNIT_TONE = { draft: "muted", final: "warning", locked: "success" } as const;
const UNIT_LABEL = { draft: "DRAFT", final: "FINAL", locked: "LOCKED" } as const;
const PUB: Record<string, string> = { full: "nama lengkap", masked: "disamarkan", private: "privat" };

function Page() {
  const { can } = useAdmin();
  const [program, setProgram] = useDefaultProgram();
  const cats = useCatalog(program);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["admin", "allocation", program], enabled: !!program,
    queryFn: async () => {
      const [u, a, c] = await Promise.all([
        supabase.from("animal_units").select("*").eq("program_id", program).order("code"),
        supabase.from("allocations").select("*").eq("is_active", true),
        supabase.from("qurban_commitments").select("id, code, category_id, category_name_snapshot, shares, payment_status, execution_status, user_id, qurban_shares(position, shahibul_name), participant_publication_consents(preference, created_at)").eq("program_id", program).neq("execution_status", "dibatalkan"),
      ]);
      for (const r of [u, a, c]) if (r.error) throw new Error(r.error.message);
      return { units: u.data ?? [], allocs: a.data ?? [], commitments: c.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "allocation"] });
  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const d = q.data;
  const allocated = new Set(d?.allocs.map((a) => a.commitment_id));
  const eligible = (d?.commitments ?? []).filter((c) => c.payment_status === "lunas" && !allocated.has(c.id) && (!search || c.code.toLowerCase().includes(search.toLowerCase())));
  const unpaid = (d?.commitments ?? []).filter((c) => c.payment_status !== "lunas").length;
  const totalShares = (d?.units ?? []).reduce((s, u) => s + (catMap.get(u.category_id)?.max_shares ?? 0), 0);
  const usedShares = (d?.allocs ?? []).filter((a) => d?.units.some((u) => u.id === a.unit_id)).reduce((s, a) => s + a.shares, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <PageHead to="/admin/alokasi" actions={<ProgramFilter value={program} onChange={setProgram} allowAll={false} />} />
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-burgundy-dark">
        <b>Penguncian alokasi</b> memindahkan dana komitmen terverifikasi di ledger ke akun Pembelian Hewan dan Operasional. Karena integrasi pembayaran belum aktif, belum ada dana terverifikasi — penguncian akan ditolak sistem sampai dana komitmen di ledger mencukupi.
      </div>
      {q.isPending || cats.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : d && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Unit hewan" value={d.units.length} />
            <Stat label="Slot terisi" value={`${usedShares} / ${totalShares}`} />
            <Stat label="Komitmen lunas belum dialokasikan" value={eligible.length} />
            <Stat label="Komitmen belum lunas (tidak dapat dialokasikan)" value={unpaid} />
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
            <Panel title="Unit hewan" action={can("allocation.manage") && <NewUnit program={program} cats={cats.data ?? []} onSaved={refresh} />}>
              {d.units.length === 0 ? <Empty title="Belum ada unit hewan" text="Tambahkan unit dengan kode identifikasi hewan." /> : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {d.units.map((u) => {
                    const cat = catMap.get(u.category_id);
                    const cap = cat?.max_shares ?? 0;
                    const ua = d.allocs.filter((a) => a.unit_id === u.id);
                    const used = ua.reduce((s, a) => s + a.shares, 0);
                    const candidates = eligible.filter((c) => c.category_id === u.category_id && c.shares <= cap - used);
                    return (
                      <li key={u.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{u.code}</span><span className="text-muted-foreground">{cat?.name}</span><Tag tone={UNIT_TONE[u.status]}>{UNIT_LABEL[u.status]}</Tag></div>
                        <p className="text-xs text-muted-foreground">{u.estimated_weight || "Bobot belum diisi"}{u.details ? ` · ${u.details}` : ""}</p>
                        <SlotGrid cap={cap} allocs={ua.map((a) => ({ shares: a.shares, code: d.commitments.find((x) => x.id === a.commitment_id)?.code ?? "?" }))} label={u.code} />
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span>{used} / {cap} {cat?.kind === "sapi" ? "bagian" : "ekor"} · sisa {cap - used}</span>
                          {u.status !== "locked" && (used === cap ? <Tag tone="success">Siap difinalkan</Tag> : used > cap ? <Tag tone="danger">Melebihi kapasitas</Tag> : <Tag tone="warning">Belum penuh</Tag>)}
                        </p>
                        <ul className="mt-2 space-y-1">{ua.map((a) => {
                          const c = d.commitments.find((x) => x.id === a.commitment_id);
                          const pref = [...(c?.participant_publication_consents ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at))[0]?.preference;
                          return (
                            <li key={a.id} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
                              <span className="font-semibold">{c?.code}</span><span>{a.shares} bagian</span><span className="text-muted-foreground">({PUB[pref ?? "private"]})</span>
                              {can("allocation.manage") && u.status === "draft" && (
                                <ConfirmAction title={`Lepas ${c?.code} dari ${u.code}?`} minReason={5} destructive confirmLabel="Lepas alokasi"
                                  onConfirm={async (r) => { await rpc("admin_remove_allocation", { p_allocation_id: a.id, p_reason: r }); toast.success("Alokasi dilepas"); refresh(); }}
                                  trigger={(o) => <button type="button" className="ml-auto font-semibold text-destructive underline" onClick={o}>Lepas</button>} />
                              )}
                            </li>
                          );
                        })}</ul>
                        {can("allocation.manage") && u.status === "draft" && used < cap && <AddToUnit unitId={u.id} candidates={candidates} onDone={refresh} />}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {can("allocation.manage") && u.status === "draft" && (
                            <ConfirmAction title={`Finalkan ${u.code}?`} description="Sistem memvalidasi bahwa unit terisi penuh sesuai kapasitas." confirmLabel="Finalkan"
                              onConfirm={async () => { await rpc("admin_set_unit_status", { p_unit_id: u.id, p_status: "final", p_reason: null }); toast.success("Unit difinalkan"); refresh(); }}
                              trigger={(o) => <Button size="sm" variant="outline" onClick={o}>Finalkan</Button>} />
                          )}
                          {can("allocation.manage") && u.status === "final" && (
                            <ConfirmAction title={`Kembalikan ${u.code} ke draf?`} minReason={5} confirmLabel="Kembalikan"
                              onConfirm={async (r) => { await rpc("admin_set_unit_status", { p_unit_id: u.id, p_status: "draft", p_reason: r }); toast.success("Unit kembali ke draf"); refresh(); }}
                              trigger={(o) => <Button size="sm" variant="ghost" onClick={o}>Ke draf</Button>} />
                          )}
                          {can("allocation.lock") && u.status === "final" && (
                            <ConfirmAction title={`Kunci alokasi ${u.code}?`} confirmLabel="Kunci alokasi"
                              description={<LockReview unit={u.code} cap={cap} used={used} rows={ua.map((a) => { const c = d.commitments.find((x) => x.id === a.commitment_id); return { code: c?.code ?? "?", shares: a.shares, paid: c?.payment_status === "lunas", names: (c?.qurban_shares ?? []).sort((x, y) => x.position - y.position).map((s) => s.shahibul_name) }; })} />}
                              onConfirm={async () => { await rpc("admin_lock_unit", { p_unit_id: u.id }); toast.success("Alokasi dikunci dan ledger diposting"); refresh(); }}
                              trigger={(o) => <Button size="sm" onClick={o}><Lock className="size-3.5" /> Tinjau &amp; kunci</Button>} />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel title="Komitmen lunas tersedia">
              <SearchBox value={search} onChange={setSearch} placeholder="Cari kode komitmen" />
              {eligible.length === 0 ? <Empty title="Belum ada komitmen lunas" text="Hanya komitmen yang lunas berdasarkan pembayaran terverifikasi yang dapat dialokasikan." /> : (
                <ul className="mt-2 divide-y divide-border text-sm">{eligible.map((c) => <li key={c.id} className="py-1.5"><b>{c.code}</b> · {c.category_name_snapshot} · {c.shares} bagian</li>)}</ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-extrabold tabular-nums text-burgundy-dark">{value}</p></div>;
}

function AddToUnit({ unitId, candidates, onDone }: { unitId: string; candidates: { id: string; code: string; shares: number }[]; onDone: () => void }) {
  const [sel, setSel] = useState("");
  if (!candidates.length) return <p className="mt-2 text-xs text-muted-foreground">Tidak ada komitmen lunas yang muat di unit ini.</p>;
  return (
    <div className="mt-2 flex gap-2">
      <NativeSelect label="Pilih komitmen" value={sel} onChange={setSel} className="min-w-0 flex-1">
        <option value="">Pilih komitmen lunas…</option>{candidates.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.shares} bagian</option>)}
      </NativeSelect>
      <Button size="sm" disabled={!sel} onClick={async () => {
        try { await rpc("admin_allocate", { p_unit_id: unitId, p_commitment_id: sel }); toast.success("Komitmen dialokasikan"); setSel(""); onDone(); }
        catch (e) { toast.error((e as Error).message); }
      }}>Alokasikan</Button>
    </div>
  );
}

function NewUnit({ program, cats, onSaved }: { program: string; cats: { id: string; name: string }[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", category: "", weight: "", details: "" });
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4" /> Unit</Button>;
  return (
    <div className="w-full space-y-2 rounded-lg bg-muted/50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Kode hewan" htmlFor="u-code" hint="contoh: SR-001"><Input id="u-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Kategori" htmlFor="u-cat"><select id="u-cat" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Pilih…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Perkiraan bobot" htmlFor="u-w"><Input id="u-w" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
        <Field label="Detail hewan" htmlFor="u-d"><Input id="u-d" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></Field>
      </div>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
        <Button size="sm" onClick={async () => {
          if (!/^[A-Za-z0-9-]{3,30}$/.test(f.code.trim())) return setErr("Kode 3–30 karakter (huruf, angka, tanda -)");
          if (!f.category) return setErr("Pilih kategori");
          try { await rpc("admin_create_unit", { p_program_id: program, p_category_id: f.category, p_code: f.code, p_weight: f.weight, p_details: f.details }); toast.success("Unit dibuat"); setOpen(false); setF({ code: "", category: "", weight: "", details: "" }); onSaved(); }
          catch (e) { setErr((e as Error).message); }
        }}>Simpan unit</Button>
      </div>
    </div>
  );
}

/** Visual seats: one cell per share; each commitment gets a contiguous colored block. */
function SlotGrid({ cap, allocs, label }: { cap: number; allocs: { shares: number; code: string }[]; label: string }) {
  const cells: (string | null)[] = [];
  allocs.forEach((a) => { for (let i = 0; i < a.shares; i++) cells.push(a.code); });
  while (cells.length < cap) cells.push(null);
  const over = cells.length > cap;
  return (
    <div role="img" aria-label={`Slot ${label}: ${allocs.reduce((s, a) => s + a.shares, 0)} dari ${cap} terisi`} className="mt-2 flex flex-wrap gap-1">
      {cells.map((c, i) => (
        <span key={i} title={c ?? "Slot kosong"} className={c ? (i >= cap || over ? "h-6 min-w-6 flex-1 rounded bg-destructive" : "h-6 min-w-6 flex-1 rounded bg-primary") : "h-6 min-w-6 flex-1 rounded border border-dashed border-border bg-muted/40"} />
      ))}
    </div>
  );
}

function LockReview({ unit, cap, used, rows }: { unit: string; cap: number; used: number; rows: { code: string; shares: number; paid: boolean; names: string[] }[] }) {
  const checks = [
    { ok: used === cap, text: `Kapasitas terisi penuh (${used}/${cap})` },
    { ok: rows.every((r) => r.paid), text: "Semua komitmen berstatus lunas (pembayaran terverifikasi)" },
  ];
  return (
    <div className="space-y-3 text-sm">
      <p>Tinjau isi unit <b>{unit}</b> sebelum mengunci. Penguncian bersifat final dan memposting ledger: dana komitmen → Pembelian Hewan &amp; Operasional. Sistem menolak bila dana terverifikasi belum mencukupi.</p>
      <ul className="space-y-1">{checks.map((c) => <li key={c.text} className={c.ok ? "text-success" : "font-semibold text-destructive"}>{c.ok ? "✓" : "✕"} {c.text}</li>)}</ul>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-xs"><thead className="bg-muted/40 text-left"><tr><th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Komitmen</th><th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bagian</th><th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Shahibul</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.code} className="border-t border-border/60"><td className="px-3 py-2 font-semibold">{r.code}</td><td className="px-3 py-2 tabular-nums">{r.shares}</td><td className="px-3 py-2">{r.names.join(", ") || "—"}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
