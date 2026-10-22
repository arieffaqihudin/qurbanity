import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, SearchBox, NativeSelect, Pager, DataTable, Empty, Tag, RowActions } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="audit.view"><Page /></Guard>,
});

function Page() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin", "audit", search, source, entity, from, page, pageSize], placeholderData: keepPreviousData,
    queryFn: async () => {
      let r = supabase.from("audit_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
      if (search.trim()) r = r.or(`action.ilike.%${search.trim().replace(/[%,()]/g, "")}%,reason.ilike.%${search.trim().replace(/[%,()]/g, "")}%`);
      if (source) r = r.eq("source", source);
      if (entity) r = r.eq("entity", entity);
      if (from) r = r.gte("created_at", `${from}T00:00:00+07:00`);
      const res = await r;
      if (res.error) throw new Error(res.error.message);
      const ids = Array.from(new Set((res.data ?? []).map((x) => x.actor_id).filter(Boolean))) as string[];
      const names = ids.length ? (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [] : [];
      return { rows: res.data ?? [], total: res.count ?? 0, names: new Map(names.map((n) => [n.id, n.full_name])) };
    },
  });
  const reset = (fn: () => void) => { fn(); setPage(0); };
  const filtersActive = !!(search || source || entity || from);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHead to="/admin/audit" count={q.data?.total}><p className="mt-1 text-xs text-muted-foreground">Catatan audit tidak dapat diubah atau dihapus oleh siapa pun melalui aplikasi.</p></PageHead>
      {q.isPending ? <Panel><Loading /></Panel> : q.isError ? <Panel><Failure error={q.error} onRetry={() => q.refetch()} /></Panel> : (
        <>
          <DataTable rows={q.data.rows} rowKey={(r) => r.id} empty={<Empty title="Tidak ada catatan" text="Coba ubah kata kunci atau filter." />}
            toolbar={<>
              <SearchBox value={search} onChange={(v) => reset(() => setSearch(v))} placeholder="Cari aksi atau alasan" />
              <NativeSelect label="Sumber" value={source} onChange={(v) => reset(() => setSource(v))}><option value="">Semua sumber</option><option value="admin">Admin</option><option value="participant">Peserta</option><option value="system">Sistem</option><option value="app">Aplikasi</option></NativeSelect>
              <NativeSelect label="Entitas" value={entity} onChange={(v) => reset(() => setEntity(v))}>
                <option value="">Semua entitas</option>
                {["profiles", "programs", "animal_categories", "animal_prices", "contract_versions", "animal_units", "allocations", "announcements", "journey_stages", "documents", "ledger_entries", "app_settings", "admin_members", "qurban_commitment", "qurban_shares", "report"].map((e) => <option key={e} value={e}>{e}</option>)}
              </NativeSelect>
              <Input type="date" aria-label="Sejak tanggal" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="h-9 w-auto" />
              {filtersActive && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => reset(() => { setSearch(""); setSource(""); setEntity(""); setFrom(""); })}>Reset filter</button>}
            </>}
            footer={<Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0); }} />}
            cols={[
              { label: "Waktu", primary: true, cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "medium" }) },
              { label: "Pelaku", cell: (r) => (r.actor_id ? q.data.names.get(r.actor_id) ?? r.actor_id.slice(0, 8) : "Sistem") },
              { label: "Aksi", cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
              { label: "Entitas", cell: (r) => <span className="text-xs">{r.entity}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}</span> },
              { label: "Sumber", cell: (r) => <Tag>{r.source}</Tag> },
              { label: "Alasan", hideOnMobile: true, cell: (r) => <span className="text-xs">{r.reason ?? "—"}</span> },
              { label: "Aksi", cell: (r) => (r.old_values || r.new_values || Object.keys((r.metadata as object) ?? {}).length) ? (
                <RowActions label="Aksi catatan audit" items={[{ label: open === r.id ? "Tutup detail" : "Lihat detail", onSelect: () => setOpen(open === r.id ? null : r.id) }]} />) : null },
            ]} />
          {open && (() => { const r = q.data.rows.find((x) => x.id === open); if (!r) return null; return (
            <Panel title="Detail catatan" className="mt-3">
              <div className="grid gap-2 md:grid-cols-2">
                <div><p className="text-xs font-bold">Nilai sebelumnya</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(r.old_values, null, 2) ?? "—"}</pre></div>
                <div><p className="text-xs font-bold">Nilai baru</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(r.new_values ?? r.metadata, null, 2)}</pre></div>
                {r.ip_address && <p className="text-xs text-muted-foreground">IP: {r.ip_address}</p>}
              </div>
            </Panel>); })()}
        </>
      )}
    </div>
  );
}
