import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Panel,
  Loading,
  Failure,
  Tag,
  Empty,
  Pager,
  DataTable,
  RowActions,
} from "@/components/admin/ui";
import { rpc, useAdmin, LEDGER_LABEL } from "@/lib/admin";
import { formatRupiah, formatDate } from "@/lib/format";

export function LedgerTable({
  program,
  account,
  title,
}: {
  program: string;
  account: string;
  title: string;
}) {
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const q = useQuery({
    queryKey: ["admin", "ledger", program, account, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let r = supabase
        .from("ledger_entries")
        .select("*, qurban_commitments(code)", { count: "exact" })
        .eq("is_fixture", false)
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (program) r = r.eq("program_id", program);
      if (account) r = r.or(`source_account.eq.${account},dest_account.eq.${account}`);
      const res = await r;
      if (res.error) throw new Error(res.error.message);
      return { rows: res.data ?? [], total: res.count ?? 0 };
    },
  });
  return (
    <Panel title={title}>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          rows={q.data.rows}
          rowKey={(r) => r.id}
          empty={
            <Empty
              title="Belum ada catatan dana"
              text="Catatan muncul setelah pembayaran terverifikasi atau alokasi dikunci."
            />
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
              cell: (r) =>
                formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "short" }),
            },
            {
              label: "Dari → Ke",
              cell: (r) => (
                <span className="text-xs">
                  {LEDGER_LABEL[r.source_account]} → {LEDGER_LABEL[r.dest_account]}
                </span>
              ),
            },
            {
              label: "Nominal",
              className: "text-right tabular-nums",
              cell: (r) => formatRupiah(r.amount),
            },
            {
              label: "Referensi",
              cell: (r) => (
                <span className="text-xs">
                  {r.reference}
                  {r.qurban_commitments?.code ? ` · ${r.qurban_commitments.code}` : ""}
                </span>
              ),
            },
            {
              label: "Dasar",
              hideOnMobile: true,
              cell: (r) => <span className="text-xs">{r.basis}</span>,
            },
            {
              label: "Sumber",
              cell: (r) => <span className="text-xs">{r.actor_id ? "Admin" : "Otomatis"}</span>,
            },
            {
              label: "Aksi",
              cell: (r) =>
                can("finance.manage") && !r.reverses_id ? (
                  <RowActions
                    label="Aksi entri ledger"
                    items={[
                      {
                        label: "Koreksi catatan dana",
                        separatorBefore: true,
                        confirm: {
                          title: "Koreksi catatan dana ini?",
                          confirmLabel: "Buat koreksi",
                          minReason: 5,
                          description:
                            "Catatan awal tetap tersimpan. Sistem menambahkan catatan berlawanan dan memeriksa saldo sebelum menyimpan.",
                        },
                        onConfirm: async (reason) => {
                          await rpc("admin_reverse_entry", { p_entry_id: r.id, p_reason: reason });
                          toast.success("Koreksi catatan dana dibuat");
                          qc.invalidateQueries({ queryKey: ["admin", "ledger"] });
                          qc.invalidateQueries({ queryKey: ["admin", "balances"] });
                        },
                      },
                    ]}
                  />
                ) : r.reverses_id ? (
                  <Tag>Pembalik</Tag>
                ) : null,
            },
          ]}
        />
      )}
    </Panel>
  );
}

export function Balances({ program, only }: { program: string; only?: string[] }) {
  const q = useQuery({
    queryKey: ["admin", "balances", program],
    queryFn: () =>
      rpc<{ account: string; balance: number; entries: number }[]>("admin_ledger_balances", {
        p_program_id: program || null,
      }),
  });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failure error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data.filter((r) => !only || only.includes(r.account));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map((r) => (
        <div key={r.account} className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs font-bold text-muted-foreground">
            {LEDGER_LABEL[r.account] ?? "Akun dana lainnya"}
          </p>
          <p
            className={`mt-1 font-extrabold tabular-nums ${r.account !== "EXTERNAL" && r.balance < 0 ? "text-destructive" : "text-burgundy-dark"}`}
          >
            {formatRupiah(r.balance)}
          </p>
          <p className="text-[11px] text-muted-foreground">{r.entries} catatan</p>
        </div>
      ))}
    </div>
  );
}
