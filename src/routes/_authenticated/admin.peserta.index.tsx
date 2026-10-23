import { z } from "zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  PageHead,
  Panel,
  Guard,
  Loading,
  Failure,
  SearchBox,
  NativeSelect,
  ProgramFilter,
  Pager,
  DataTable,
  Tag,
  Empty,
  RowActions,
} from "@/components/admin/ui";
import { rpc } from "@/lib/admin";
import { formatRupiah, formatDate } from "@/lib/format";

export const searchSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  program: z.string().optional(),
  page: z.coerce.number().int().min(0).optional(),
  size: z.coerce.number().int().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/peserta/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Peserta | Admin qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <Guard perms="participants.view">
      <Page />
    </Guard>
  ),
});

interface Row {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  created_at: string;
  commitments: number;
  total: number;
  paid: number;
  status: string;
}
const STATUS: Record<string, { label: string; tone: "muted" | "primary" | "success" | "warning" }> =
  {
    tanpa_komitmen: { label: "Tanpa komitmen", tone: "muted" },
    belum_lunas: { label: "Belum Lunas", tone: "warning" },
    dalam_cicilan: { label: "Dalam Cicilan", tone: "primary" },
    lunas: { label: "Lunas", tone: "success" },
  };

function Page() {
  // Filters live in the URL so returning from a participant detail keeps the same list.
  const sp = Route.useSearch();
  const nav = useNavigate({ from: Route.fullPath });
  const search = sp.q ?? "",
    status = sp.status ?? "",
    program = sp.program ?? "",
    page = sp.page ?? 0,
    pageSize = sp.size ?? 25;
  const set = (patch: z.infer<typeof searchSchema>) =>
    nav({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const setPage = (p: number) => set({ page: p || undefined });
  const q = useQuery({
    queryKey: ["admin", "participants", search, status, program, page, pageSize],
    queryFn: () =>
      rpc<{ total: number; rows: Row[] }>("admin_participants", {
        p_search: search || null,
        p_status: status || null,
        p_program_id: program || null,
        p_limit: pageSize,
        p_offset: page * pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const filtersActive = !!(search || status || program);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead to="/admin/peserta" count={q.data?.total} />
      {q.isPending ? (
        <Panel>
          <Loading />
        </Panel>
      ) : q.isError ? (
        <Panel>
          <Failure error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : (
        <DataTable
          rows={q.data.rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav({ to: "/admin/peserta/$id", params: { id: r.id }, search: sp })}
          toolbar={
            <>
              <SearchBox
                value={search}
                onChange={(v) => set({ q: v || undefined, page: undefined })}
                placeholder="Cari nama, email, WhatsApp"
              />
              <NativeSelect
                label="Status komitmen"
                value={status}
                onChange={(v) => set({ status: v || undefined, page: undefined })}
              >
                <option value="">Semua status</option>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </NativeSelect>
              <ProgramFilter
                value={program}
                onChange={(v) => set({ program: v || undefined, page: undefined })}
              />
              {filtersActive && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary underline"
                  onClick={() =>
                    set({ q: undefined, status: undefined, program: undefined, page: undefined })
                  }
                >
                  Reset filter
                </button>
              )}
            </>
          }
          footer={
            <Pager
              page={page}
              pageSize={pageSize}
              total={q.data.total}
              onPage={setPage}
              onPageSize={(s) => set({ size: s === 25 ? undefined : s, page: undefined })}
            />
          }
          empty={<Empty title="Tidak ada peserta" text="Coba ubah kata kunci atau filter." />}
          cols={[
            {
              label: "Nama Peserta",
              primary: true,
              sort: (r) => r.full_name.toLowerCase(),
              cell: (r) => (
                <Link
                  to="/admin/peserta/$id"
                  params={{ id: r.id }}
                  search={sp}
                  className="font-semibold text-primary hover:underline"
                >
                  {r.full_name}
                </Link>
              ),
            },
            {
              label: "Email",
              hideOnMobile: true,
              className: "hidden 2xl:table-cell",
              cell: (r) => <span className="break-all">{r.email}</span>,
            },
            { label: "WhatsApp", cell: (r) => r.whatsapp },
            {
              label: "Komitmen",
              sort: (r) => r.commitments,
              className: "text-right tabular-nums",
              cell: (r) => r.commitments,
            },
            {
              label: "Nilai Komitmen",
              sort: (r) => r.total,
              className: "text-right tabular-nums",
              cell: (r) => formatRupiah(r.total),
            },
            {
              label: "Terverifikasi",
              sort: (r) => r.paid,
              className: "text-right tabular-nums",
              cell: (r) => formatRupiah(r.paid),
            },
            {
              label: "Status",
              cell: (r) => (
                <Tag tone={STATUS[r.status]?.tone ?? "muted"}>
                  {STATUS[r.status]?.label ?? "Status tidak diketahui"}
                </Tag>
              ),
            },
            {
              label: "Bergabung",
              sort: (r) => r.created_at,
              hideOnMobile: true,
              className: "hidden 2xl:table-cell",
              cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium" }),
            },
            {
              label: "Aksi",
              hideOnMobile: true,
              cell: (r) => (
                <RowActions
                  label={`Aksi untuk ${r.full_name}`}
                  items={[
                    {
                      label: "Lihat detail",
                      onSelect: () =>
                        nav({ to: "/admin/peserta/$id", params: { id: r.id }, search: sp }),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
