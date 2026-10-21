import { z } from "zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHead, Panel, Guard, Loading, Failure, SearchBox, NativeSelect, ProgramFilter, Pager, DataTable, Tag, Empty } from "@/components/admin/ui";
import { rpc } from "@/lib/admin";
import { formatRupiah, formatDate } from "@/lib/format";

const searchSchema = z.object({ q: z.string().optional(), status: z.string().optional(), program: z.string().optional(), page: z.coerce.number().int().min(0).optional() });

export const Route = createFileRoute("/_authenticated/admin/peserta/")({
  validateSearch: searchSchema,
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
  // Filters live in the URL so returning from a participant detail keeps the same list.
  const sp = Route.useSearch();
  const nav = useNavigate({ from: Route.fullPath });
  const search = sp.q ?? "", status = sp.status ?? "", program = sp.program ?? "", page = sp.page ?? 0;
  const set = (patch: z.infer<typeof searchSchema>) => nav({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const setPage = (p: number) => set({ page: p || undefined });
  const q = useQuery({
    queryKey: ["admin", "participants", search, status, program, page],
    queryFn: () => rpc<{ total: number; rows: Row[] }>("admin_participants", { p_search: search || null, p_status: status || null, p_program_id: program || null, p_limit: PAGE, p_offset: page * PAGE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead to="/admin/peserta" />
      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
          <SearchBox value={search} onChange={(v) => set({ q: v || undefined, page: undefined })} placeholder="Cari nama, email, WhatsApp" />
          <NativeSelect label="Status komitmen" value={status} onChange={(v) => set({ status: v || undefined, page: undefined })}>
            <option value="">Semua status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </NativeSelect>
          <ProgramFilter value={program} onChange={(v) => set({ program: v || undefined, page: undefined })} />
        </div>
        {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : (
          <>
            <DataTable rows={q.data.rows} rowKey={(r) => r.id} onRowClick={(r) => nav({ to: "/admin/peserta/$id", params: { id: r.id }, search: { back: JSON.stringify(sp) } as never })} empty={<Empty title="Tidak ada peserta" text="Coba ubah kata kunci atau filter." />} cols={[
              { label: "Nama Peserta", primary: true, sort: (r) => r.full_name.toLowerCase(), cell: (r) => <Link to="/admin/peserta/$id" params={{ id: r.id }} className="font-semibold text-primary hover:underline">{r.full_name}</Link> },
              { label: "Email", hideOnMobile: true, cell: (r) => <span className="break-all">{r.email}</span> },
              { label: "WhatsApp", cell: (r) => r.whatsapp },
              { label: "Komitmen", sort: (r) => r.commitments, className: "text-right", cell: (r) => r.commitments },
              { label: "Nilai Komitmen", sort: (r) => r.total, className: "text-right tabular-nums", cell: (r) => formatRupiah(r.total) },
              { label: "Terverifikasi", sort: (r) => r.paid, className: "text-right tabular-nums", cell: (r) => formatRupiah(r.paid) },
              { label: "Status", cell: (r) => <Tag tone={STATUS[r.status]?.tone ?? "muted"}>{STATUS[r.status]?.label ?? r.status}</Tag> },
              { label: "Bergabung", sort: (r) => r.created_at, hideOnMobile: true, cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium" }) },
              { label: "Aksi", hideOnMobile: true, cell: (r) => <Link to="/admin/peserta/$id" params={{ id: r.id }} className="text-xs font-semibold text-primary underline">Detail</Link> },
            ]} />
            <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
