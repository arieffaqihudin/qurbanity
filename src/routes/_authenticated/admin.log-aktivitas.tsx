import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, SearchBox, NativeSelect, Pager, DataTable, Empty, Tag, RowActions } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rpc, useAdmin, toCsv, download } from "@/lib/admin";
import { formatDate } from "@/lib/format";
import type { AccessGroup } from "./admin.hak-akses";

export const Route = createFileRoute("/_authenticated/admin/log-aktivitas")({
  head: () => ({ meta: [{ title: "Log Aktivitas | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="audit.view"><Page /></Guard>,
});

interface AuditRow {
  id: string; created_at: string; action: string; entity: string; entity_id: string | null;
  result: string; source: string; reason: string | null; ip_address: string | null;
  actor_name: string | null; actor_email: string | null; group_name: string | null; has_detail: boolean;
}

const ENTITY_LABEL: Record<string, string> = {
  profiles: "Profil", profile: "Profil", programs: "Program", animal_categories: "Kategori Hewan", animal_prices: "Harga",
  contract_versions: "Akad", animal_units: "Unit Hewan", allocations: "Alokasi", announcements: "Pengumuman",
  journey_stages: "Pelaksanaan", documents: "Dokumentasi", ledger_entries: "Ledger", app_settings: "Pengaturan",
  admin_members: "Pengguna Admin", access_groups: "Hak Akses", qurban_commitment: "Komitmen", qurban_shares: "Shahibul", report: "Laporan",
};

function Page() {
  const { can } = useAdmin();
  const [search, setSearch] = useState("");
  const [user, setUser] = useState("");
  const [groupId, setGroupId] = useState("");
  const [entity, setEntity] = useState("");
  const [source, setSource] = useState("");
  const [result, setResult] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [openId, setOpenId] = useState<string | null>(null);

  const groups = useQuery({ queryKey: ["admin", "access-groups"], queryFn: () => rpc<AccessGroup[]>("admin_list_groups").catch(() => [] as AccessGroup[]) });

  const args = {
    p_search: search.trim(), p_entity: entity, p_source: source, p_result: result, p_user: user.trim(),
    p_group: groupId || null,
    p_from: from ? `${from}T00:00:00+07:00` : null,
    p_to: to ? `${to}T00:00:00+07:00` : null,
  };
  const q = useQuery({
    queryKey: ["admin", "audit-log", args, page, pageSize], placeholderData: keepPreviousData,
    queryFn: () => rpc<{ total: number; rows: AuditRow[] }>("admin_list_audit", { ...args, p_limit: pageSize, p_offset: page * pageSize }),
  });
  const detail = useQuery({
    queryKey: ["admin", "audit-detail", openId], enabled: !!openId,
    queryFn: async () => {
      const r = await supabase.from("audit_logs").select("*").eq("id", openId!).single();
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });

  const reset = (fn: () => void) => { fn(); setPage(0); };
  const filtersActive = !!(search || user || groupId || entity || source || result || from || to);

  const exportCsv = async () => {
    const res = await rpc<{ total: number; rows: AuditRow[] }>("admin_list_audit", { ...args, p_limit: 1000, p_offset: 0 });
    const rows = res.rows.map((r) => ({
      waktu: formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "medium" }),
      pengguna: r.actor_name ?? "Sistem", email: r.actor_email ?? "", grup: r.group_name ?? "",
      modul: ENTITY_LABEL[r.entity] ?? r.entity, aktivitas: r.action, objek: r.entity_id ?? "",
      hasil: r.result, sumber: r.source, alasan: r.reason ?? "",
    }));
    download(`log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv");
    toast.success(`${rows.length} catatan diekspor (maks. 1000)`);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead to="/admin/log-aktivitas" count={q.data?.total}
        actions={can("audit.export") ? <Button size="sm" variant="outline" onClick={() => void exportCsv()}><Download className="size-4" /> Ekspor CSV</Button> : undefined}>
        <p className="mt-1 text-xs text-muted-foreground">Catatan dibuat oleh operasi backend tepercaya, bersifat append-only, dan tidak dapat diubah atau dihapus melalui aplikasi. Kredensial tidak pernah dicatat.</p>
      </PageHead>
      {q.isPending ? <Panel><Loading /></Panel> : q.isError ? <Panel><Failure error={q.error} onRetry={() => q.refetch()} /></Panel> : (
        <DataTable rows={q.data.rows} rowKey={(r) => r.id} empty={<Empty title="Tidak ada catatan" text="Coba ubah kata kunci atau filter." />}
          toolbar={<>
            <SearchBox value={search} onChange={(v) => reset(() => setSearch(v))} placeholder="Cari aksi atau alasan" />
            <SearchBox value={user} onChange={(v) => reset(() => setUser(v))} placeholder="Cari pengguna" />
            <NativeSelect label="Grup" value={groupId} onChange={(v) => reset(() => setGroupId(v))}>
              <option value="">Semua grup</option>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </NativeSelect>
            <NativeSelect label="Modul" value={entity} onChange={(v) => reset(() => setEntity(v))}>
              <option value="">Semua modul</option>
              {Object.entries(ENTITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </NativeSelect>
            <NativeSelect label="Sumber" value={source} onChange={(v) => reset(() => setSource(v))}>
              <option value="">Semua sumber</option><option value="admin">Admin</option><option value="participant">Peserta</option><option value="system">Sistem</option><option value="app">Aplikasi</option>
            </NativeSelect>
            <NativeSelect label="Hasil" value={result} onChange={(v) => reset(() => setResult(v))}>
              <option value="">Semua hasil</option><option value="SUCCESS">Berhasil</option><option value="FAILED">Gagal</option>
            </NativeSelect>
            <Input type="date" aria-label="Dari tanggal" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="h-9 w-auto" />
            <Input type="date" aria-label="Sampai tanggal" value={to} onChange={(e) => reset(() => setTo(e.target.value))} className="h-9 w-auto" />
            {filtersActive && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => reset(() => { setSearch(""); setUser(""); setGroupId(""); setEntity(""); setSource(""); setResult(""); setFrom(""); setTo(""); })}>Reset filter</button>}
          </>}
          footer={<Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0); }} />}
          cols={[
            { label: "Waktu", primary: true, sort: (r) => r.created_at, cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "medium" }) },
            { label: "Pengguna", cell: (r) => <span>{r.actor_name ?? "Sistem"}{r.group_name && <span className="block text-xs text-muted-foreground">{r.group_name}</span>}</span> },
            { label: "Modul", cell: (r) => ENTITY_LABEL[r.entity] ?? r.entity },
            { label: "Aktivitas", cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
            { label: "Objek", hideOnMobile: true, cell: (r) => <span className="text-xs">{r.entity_id ? `${r.entity_id.slice(0, 8)}…` : "—"}</span> },
            { label: "Hasil", cell: (r) => <Tag tone={r.result === "SUCCESS" ? "success" : "danger"}>{r.result === "SUCCESS" ? "Berhasil" : "Gagal"}</Tag> },
            { label: "Aksi", cell: (r) => (
              <RowActions label="Aksi catatan" items={[{ label: "Lihat Detail", onSelect: () => setOpenId(r.id) }]} />
            ) },
          ]} />
      )}
      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detail Aktivitas</SheetTitle>
            <SheetDescription>{openId}</SheetDescription>
          </SheetHeader>
          {detail.isPending ? <Loading /> : detail.isError ? <Failure error={detail.error} /> : detail.data && (() => {
            const r = detail.data;
            const row = q.data?.rows.find((x) => x.id === r.id);
            return (
              <div className="mt-4 space-y-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div><dt className="text-xs font-bold text-muted-foreground">Waktu (Asia/Jakarta)</dt><dd>{formatDate(new Date(r.created_at), { dateStyle: "full", timeStyle: "medium" })}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Hasil</dt><dd><Tag tone={r.result === "SUCCESS" ? "success" : "danger"}>{r.result}</Tag></dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Pelaku</dt><dd>{row?.actor_name ?? "Sistem"}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Email Pelaku</dt><dd className="break-all">{row?.actor_email ?? "—"}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Grup Saat Ini</dt><dd>{row?.group_name ?? "—"}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Sumber</dt><dd>{r.source}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Modul / Entitas</dt><dd>{ENTITY_LABEL[r.entity] ?? r.entity}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">ID Objek</dt><dd className="break-all">{r.entity_id ?? "—"}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Aksi</dt><dd className="font-mono text-xs">{r.action}</dd></div>
                  <div><dt className="text-xs font-bold text-muted-foreground">Alamat IP</dt><dd>{r.ip_address ?? "—"}</dd></div>
                  {r.reason && <div className="col-span-2"><dt className="text-xs font-bold text-muted-foreground">Alasan</dt><dd>{r.reason}</dd></div>}
                </dl>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold">Nilai sebelumnya</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 text-[11px]">{r.old_values ? JSON.stringify(r.old_values, null, 2) : "—"}</pre>
                  </div>
                  <div>
                    <p className="text-xs font-bold">Nilai baru</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 text-[11px]">{r.new_values ? JSON.stringify(r.new_values, null, 2) : (Object.keys((r.metadata as object) ?? {}).length ? JSON.stringify(r.metadata, null, 2) : "—")}</pre>
                  </div>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
