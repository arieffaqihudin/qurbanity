import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHead, Panel, Guard, Loading, Failure, SearchBox, NativeSelect, ProgramFilter, Pager, DataTable, Tag, Empty } from "@/components/admin/ui";
import { rpc } from "@/lib/admin";
import { formatRupiah, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/peserta/")({
  head: () => ({ meta: [{ title: "Peserta | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="participants.view"><Page /></Guard>,
});

interface Row { id: string; full_name: string; email: string; whatsapp: string; created_at: string; commitments: number; total: number; paid: number; status: string }
const STATUS: Record<string, { label: string; tone: "muted" | "primary" | "success" | "warning" }> = {
  tanpa_komitmen: { label: "Tanpa komitmen", tone: "muted" }, belum_lunas: { label: "Belum Lunas", tone: "warning" },
  dalam_cicilan: { label: "Dalam Cicilan", tone: "primary" }, lunas: { label: "Lunas", tone: "success" },
};
const PAGE = 20;

function Page() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [program, setProgram] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["admin", "participants", search, status, program, page],
    queryFn: () => rpc<{ total: number; rows: Row[] }>("admin_participants", { p_search: search || null, p_status: status || null, p_program_id: program || null, p_limit: PAGE, p_offset: page * PAGE }),
    placeholderData: keepPreviousData,
  });
  const reset = (fn: () => void) => { fn(); setPage(0); };
  return (
    <div className="mx-auto max-w-7xl">
      <PageHead to="/admin/peserta" />
      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
          <SearchBox value={search} onChange={(v) => reset(() => setSearch(v))} placeholder="Cari nama, email, WhatsApp" />
          <NativeSelect label="Status komitmen" value={status} onChange={(v) => reset(() => setStatus(v))}>
            <option value="">Semua status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </NativeSelect>
          <ProgramFilter value={program} onChange={(v) => reset(() => setProgram(v))} />
        </div>
        {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : (
          <>
            <DataTable rows={q.data.rows} rowKey={(r) => r.id} empty={<Empty title="Tidak ada peserta" text="Coba ubah kata kunci atau filter." />} cols={[
              { label: "Nama Peserta", primary: true, cell: (r) => <Link to="/admin/peserta/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">{r.full_name}</Link> },
              { label: "Email", cell: (r) => <span className="break-all">{r.email}</span> },
              { label: "WhatsApp", cell: (r) => r.whatsapp },
              { label: "Komitmen", className: "text-right", cell: (r) => r.commitments },
              { label: "Nilai Komitmen", className: "text-right tabular-nums", cell: (r) => formatRupiah(r.total) },
              { label: "Terverifikasi", className: "text-right tabular-nums", cell: (r) => formatRupiah(r.paid) },
              { label: "Status", cell: (r) => <Tag tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Tag> },
              { label: "Bergabung", cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium" }) },
              { label: "Aksi", cell: (r) => <Link to="/admin/peserta/$id" params={{ id: r.id }} className="text-xs font-semibold text-primary underline">Detail</Link> },
            ]} />
            <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
