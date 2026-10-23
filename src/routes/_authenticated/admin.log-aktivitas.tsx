import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PageHead,
  Panel,
  Guard,
  Loading,
  Failure,
  SearchBox,
  NativeSelect,
  Pager,
  DataTable,
  Empty,
  Tag,
  RowActions,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  rpc,
  useAdmin,
  toCsv,
  download,
  displayAuditAction,
  displayAdminField,
  displayAdminLabel,
} from "@/lib/admin";
import { formatDate } from "@/lib/format";
import type { AccessGroup } from "./admin.hak-akses";

export const Route = createFileRoute("/_authenticated/admin/log-aktivitas")({
  head: () => ({
    meta: [{ title: "Log Aktivitas | Admin qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <Guard perms="audit.view">
      <Page />
    </Guard>
  ),
});

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  result: string;
  source: string;
  reason: string | null;
  ip_address: string | null;
  actor_name: string | null;
  actor_email: string | null;
  group_name: string | null;
  has_detail: boolean;
}

const ENTITY_LABEL: Record<string, string> = {
  profiles: "Profil",
  profile: "Profil",
  programs: "Program",
  animal_categories: "Kategori Hewan",
  animal_prices: "Harga",
  contract_versions: "Akad",
  animal_units: "Unit Hewan",
  allocations: "Alokasi",
  announcements: "Pengumuman",
  journey_stages: "Pelaksanaan",
  documents: "Dokumentasi",
  ledger_entries: "Catatan dana",
  app_settings: "Pengaturan",
  admin_members: "Pengguna Admin",
  access_groups: "Hak Akses",
  qurban_commitment: "Komitmen",
  qurban_shares: "Nama peserta kurban",
  report: "Laporan",
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

  const groups = useQuery({
    queryKey: ["admin", "access-groups"],
    queryFn: () => rpc<AccessGroup[]>("admin_list_groups").catch(() => [] as AccessGroup[]),
  });

  const args = {
    p_search: search.trim(),
    p_entity: entity,
    p_source: source,
    p_result: result,
    p_user: user.trim(),
    p_group: groupId || null,
    p_from: from ? `${from}T00:00:00+07:00` : null,
    p_to: to ? `${to}T00:00:00+07:00` : null,
  };
  const q = useQuery({
    queryKey: ["admin", "audit-log", args, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: () =>
      rpc<{ total: number; rows: AuditRow[] }>("admin_list_audit", {
        ...args,
        p_limit: pageSize,
        p_offset: page * pageSize,
      }),
  });
  const detail = useQuery({
    queryKey: ["admin", "audit-detail", openId],
    enabled: !!openId,
    queryFn: async () => {
      const r = await supabase.from("audit_logs").select("*").eq("id", openId!).single();
      if (r.error) throw new Error(r.error.message);
      return r.data;
    },
  });

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };
  const filtersActive = !!(search || user || groupId || entity || source || result || from || to);

  const exportCsv = async () => {
    const res = await rpc<{ total: number; rows: AuditRow[] }>("admin_list_audit", {
      ...args,
      p_limit: 1000,
      p_offset: 0,
    });
    const rows = res.rows.map((r) => ({
      waktu: formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "medium" }),
      pengguna: r.actor_name ?? "Sistem",
      email: r.actor_email ?? "",
      grup: r.group_name ?? "",
      modul: ENTITY_LABEL[r.entity] ?? "Bagian lain",
      aktivitas: displayAuditAction(r.action),
      objek: r.entity_id ? "Tercatat" : "",
      hasil: displayAdminLabel(r.result, "Tidak diketahui"),
      sumber: displayAdminLabel(r.source, "Aplikasi"),
      alasan: r.reason ?? "",
    }));
    download(`log-aktivitas-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv");
    toast.success(`${rows.length} catatan diekspor (maks. 1000)`);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead
        to="/admin/log-aktivitas"
        count={q.data?.total}
        actions={
          can("audit.export") ? (
            <Button size="sm" variant="outline" onClick={() => void exportCsv()}>
              <Download className="size-4" /> Ekspor CSV
            </Button>
          ) : undefined
        }
      >
        <p className="mt-1 text-xs text-muted-foreground">
          Catatan aktivitas tidak dapat diubah atau dihapus. Kata sandi dan rahasia akun tidak
          disimpan di sini.
        </p>
      </PageHead>
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
          empty={<Empty title="Tidak ada catatan" text="Coba ubah kata kunci atau filter." />}
          toolbar={
            <>
              <SearchBox
                value={search}
                onChange={(v) => reset(() => setSearch(v))}
                placeholder="Cari aksi atau alasan"
              />
              <SearchBox
                value={user}
                onChange={(v) => reset(() => setUser(v))}
                placeholder="Cari pengguna"
              />
              <NativeSelect
                label="Grup"
                value={groupId}
                onChange={(v) => reset(() => setGroupId(v))}
              >
                <option value="">Semua grup</option>
                {(groups.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                label="Modul"
                value={entity}
                onChange={(v) => reset(() => setEntity(v))}
              >
                <option value="">Semua modul</option>
                {Object.entries(ENTITY_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                label="Sumber"
                value={source}
                onChange={(v) => reset(() => setSource(v))}
              >
                <option value="">Semua sumber</option>
                <option value="admin">Admin</option>
                <option value="participant">Peserta</option>
                <option value="system">Sistem</option>
                <option value="app">Aplikasi</option>
              </NativeSelect>
              <NativeSelect
                label="Hasil"
                value={result}
                onChange={(v) => reset(() => setResult(v))}
              >
                <option value="">Semua hasil</option>
                <option value="SUCCESS">Berhasil</option>
                <option value="FAILED">Gagal</option>
              </NativeSelect>
              <Input
                type="date"
                aria-label="Dari tanggal"
                value={from}
                onChange={(e) => reset(() => setFrom(e.target.value))}
                className="h-9 w-auto"
              />
              <Input
                type="date"
                aria-label="Sampai tanggal"
                value={to}
                onChange={(e) => reset(() => setTo(e.target.value))}
                className="h-9 w-auto"
              />
              {filtersActive && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary underline"
                  onClick={() =>
                    reset(() => {
                      setSearch("");
                      setUser("");
                      setGroupId("");
                      setEntity("");
                      setSource("");
                      setResult("");
                      setFrom("");
                      setTo("");
                    })
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
              onPageSize={(s) => {
                setPageSize(s);
                setPage(0);
              }}
            />
          }
          cols={[
            {
              label: "Waktu",
              primary: true,
              sort: (r) => r.created_at,
              cell: (r) =>
                formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "medium" }),
            },
            {
              label: "Pengguna",
              cell: (r) => (
                <span>
                  {r.actor_name ?? "Sistem"}
                  {r.group_name && (
                    <span className="block text-xs text-muted-foreground">{r.group_name}</span>
                  )}
                </span>
              ),
            },
            { label: "Bagian", cell: (r) => ENTITY_LABEL[r.entity] ?? "Bagian lain" },
            {
              label: "Aktivitas",
              cell: (r) => <span className="text-xs">{displayAuditAction(r.action)}</span>,
            },
            {
              label: "Catatan",
              hideOnMobile: true,
              cell: (r) => <span className="text-xs">{r.entity_id ? "Tercatat" : "—"}</span>,
            },
            {
              label: "Hasil",
              cell: (r) => (
                <Tag tone={r.result === "SUCCESS" ? "success" : "danger"}>
                  {r.result === "SUCCESS" ? "Berhasil" : "Gagal"}
                </Tag>
              ),
            },
            {
              label: "Aksi",
              cell: (r) => (
                <RowActions
                  label="Aksi catatan"
                  items={[{ label: "Lihat Detail", onSelect: () => setOpenId(r.id) }]}
                />
              ),
            },
          ]}
        />
      )}
      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detail Aktivitas</SheetTitle>
            <SheetDescription>Ringkasan perubahan dan pelakunya.</SheetDescription>
          </SheetHeader>
          {detail.isPending ? (
            <Loading />
          ) : detail.isError ? (
            <Failure error={detail.error} />
          ) : (
            detail.data &&
            (() => {
              const r = detail.data;
              const row = q.data?.rows.find((x) => x.id === r.id);
              return (
                <div className="mt-4 space-y-4 text-sm">
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">
                        Waktu (Asia/Jakarta)
                      </dt>
                      <dd>
                        {formatDate(new Date(r.created_at), {
                          dateStyle: "full",
                          timeStyle: "medium",
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Hasil</dt>
                      <dd>
                        <Tag tone={r.result === "SUCCESS" ? "success" : "danger"}>
                          {displayAdminLabel(r.result, "Tidak diketahui")}
                        </Tag>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Pelaku</dt>
                      <dd>{row?.actor_name ?? "Sistem"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Email Pelaku</dt>
                      <dd className="break-all">{row?.actor_email ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Grup Saat Ini</dt>
                      <dd>{row?.group_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Sumber</dt>
                      <dd>{displayAdminLabel(r.source, "Aplikasi")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Bagian</dt>
                      <dd>{ENTITY_LABEL[r.entity] ?? "Bagian lain"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Catatan terkait</dt>
                      <dd>{r.entity_id ? "Tercatat" : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">Aktivitas</dt>
                      <dd>{displayAuditAction(r.action)}</dd>
                    </div>
                    {r.reason && (
                      <div className="col-span-2">
                        <dt className="text-xs font-bold text-muted-foreground">Alasan</dt>
                        <dd>{r.reason}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="grid gap-3 md:grid-cols-2">
                    <AuditValues
                      title="Sebelum perubahan"
                      values={r.old_values as Record<string, unknown> | null}
                    />
                    <AuditValues
                      title="Sesudah perubahan"
                      values={(r.new_values ?? r.metadata) as Record<string, unknown> | null}
                    />
                  </div>
                </div>
              );
            })()
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AuditValues({ title, values }: { title: string; values: Record<string, unknown> | null }) {
  if (!values || !Object.keys(values).length)
    return (
      <section>
        <h3 className="text-xs font-bold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Tidak ada rincian.</p>
      </section>
    );
  const entries = Object.entries(values).filter(
    ([key]) => displayAdminField(key) !== "Detail lainnya",
  );
  if (!entries.length)
    return (
      <section>
        <h3 className="text-xs font-bold">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Rincian tersedia.</p>
      </section>
    );
  return (
    <section>
      <h3 className="text-xs font-bold">{title}</h3>
      <dl className="mt-1 divide-y divide-border rounded-lg border border-border px-2">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[minmax(7rem,1fr)_2fr] gap-2 py-1.5 text-xs">
            <dt className="text-muted-foreground">{displayAdminField(key)}</dt>
            <dd className="break-words">{auditValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function auditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") return new Intl.NumberFormat("id-ID").format(value);
  if (typeof value !== "string") return "Rincian tersedia";
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) return "Tercatat";
  const label = displayAdminLabel(value, "");
  if (label) return label;
  if (/^[A-Z][A-Z0-9_.:-]*$/.test(value) || value.includes(".")) return "Tercatat";
  return value;
}
