import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHead, Panel, Kpi, Loading, Failure, Empty, ProgramFilter, Tag, PendingIntegration } from "@/components/admin/ui";
import { rpc, useAdmin, STAGES } from "@/lib/admin";
import { ADMIN_ITEMS } from "@/lib/navigation";
import { formatRupiah, formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

interface Dash {
  participants: number; commitments: number; committed_total: number; verified_total: number; paid_off: number; not_paid_off: number;
  allocated_units: number; units: { draft: number; final: number; locked: number };
  weekly: { week: string; count: number }[]; daily: { day: string; amount: number }[]; monthly: { month: string; amount: number }[];
  progress: Record<string, number>; composition: { name: string; commitments: number; shares: number }[];
  execution: Record<string, number>;
  attention: { id: string; code: string; category_name_snapshot: string; total_amount: number; verified_paid_amount: number; full_name: string | null }[];
  recent: { action: string; entity: string; created_at: string; source: string; actor: string | null }[];
  announcement: { version: number; status: string; published_at: string | null; scheduled_at: string | null } | null;
  journey: { stage: number; status: string; date: string | null }[];
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const EXEC_LABEL: Record<string, string> = { menunggu: "Menunggu", dialokasikan: "Dialokasikan", disembelih: "Disembelih", didistribusikan: "Didistribusikan", selesai: "Selesai", dibatalkan: "Dibatalkan" };
const ANN_LABEL: Record<string, string> = { draft: "Draf", approved: "Disetujui", scheduled: "Terjadwal", published: "Terbit", withdrawn: "Ditarik" };

function Dashboard() {
  const { can } = useAdmin();
  const navigate = useNavigate();
  const allowed = can("dashboard.view");
  useEffect(() => {
    if (!allowed) {
      const first = ADMIN_ITEMS.find((i) => i.to !== "/admin" && can(i.perms));
      if (first) navigate({ to: first.to, replace: true });
    }
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [program, setProgram] = useState("");
  const q = useQuery({ queryKey: ["admin", "dashboard", program], queryFn: () => rpc<Dash>("admin_dashboard", { p_program_id: program || null }), enabled: allowed });
  if (!allowed) return <Loading label="Membuka modul yang diizinkan…" />;
  const d = q.data;
  const pct = d && d.committed_total > 0 ? Math.floor((d.verified_total / d.committed_total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHead to="/admin" actions={<ProgramFilter value={program} onChange={setProgram} />} />
      {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            <Kpi label="Total Peserta" value={formatNumber(d.participants)} hint="peserta dengan komitmen" />
            <Kpi label="Komitmen Aktif" value={formatNumber(d.commitments)} />
            <Kpi label="Dana Terverifikasi" value={formatRupiah(d.verified_total)} hint={`dari ${formatRupiah(d.committed_total)}`} />
            <Kpi label="Komitmen Lunas" value={formatNumber(d.paid_off)} />
            <Kpi label="Belum Lunas" value={formatNumber(d.not_paid_off)} />
            <Kpi label="Hewan Dialokasikan" value={formatNumber(d.allocated_units)} hint="unit terkunci" />
            <Kpi label="Pelunasan" value={`${pct}%`} hint="dana terverifikasi ÷ nilai komitmen" />
          </div>
          {d.verified_total === 0 && (
            <PendingIntegration title="Belum ada pembayaran terverifikasi">Grafik penerimaan akan terisi setelah pembayaran terverifikasi masuk ke ledger. Integrasi pembayaran belum aktif.</PendingIntegration>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Pertumbuhan Komitmen per Minggu">
              {d.weekly.length ? <ChartBar data={d.weekly.map((w) => ({ x: formatDate(new Date(w.week), { day: "numeric", month: "short" }), y: w.count }))} /> : <Empty title="Belum ada komitmen" />}
            </Panel>
            <Panel title="Distribusi Progres Pembayaran">
              {d.commitments ? <ChartBar data={["0-24", "25-49", "50-74", "75-99", "lunas"].map((k) => ({ x: k === "lunas" ? "Lunas" : `${k.replace("-", "–")}%`, y: d.progress[k] ?? 0 }))} /> : <Empty title="Belum ada komitmen" />}
            </Panel>
            <Panel title="Penerimaan Harian (30 Hari)">
              {d.daily.length ? <ChartBar money data={d.daily.map((r) => ({ x: r.day.slice(5), y: r.amount }))} /> : <Empty title="Belum ada penerimaan" text="Hanya pembayaran terverifikasi yang dihitung." />}
            </Panel>
            <Panel title="Penerimaan Bulanan">
              {d.monthly.length ? <ChartBar money data={d.monthly.map((r) => ({ x: r.month, y: r.amount }))} /> : <Empty title="Belum ada penerimaan" />}
            </Panel>
            <Panel title="Komposisi Jenis Hewan">
              {d.composition.length ? (
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div className="h-44 w-44"><ResponsiveContainer><PieChart><Pie data={d.composition} dataKey="shares" nameKey="name" innerRadius={40} outerRadius={70}>{d.composition.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                  <ul className="flex-1 space-y-1 text-sm">{d.composition.map((c, i) => <li key={c.name} className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ background: COLORS[i % 5] }} />{c.name}<span className="ml-auto tabular-nums text-muted-foreground">{c.commitments} komitmen · {c.shares} bagian</span></li>)}</ul>
                </div>
              ) : <Empty title="Belum ada komitmen" />}
            </Panel>
            <Panel title="Komitmen yang Memerlukan Perhatian">
              {d.attention.length ? (
                <ul className="divide-y divide-border text-sm">{d.attention.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-1.5"><span className="font-semibold">{a.code}</span><span className="text-muted-foreground">{a.full_name ?? "—"} · {a.category_name_snapshot}</span>
                    <span className="ml-auto tabular-nums">{formatRupiah(a.verified_paid_amount)} / {formatRupiah(a.total_amount)}</span></li>))}</ul>
              ) : <Empty title="Tidak ada" text="Komitmen dengan progres di bawah 50% menjelang 60 hari sebelum batas pelunasan muncul di sini." />}
            </Panel>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Panel title="Ringkasan Alokasi Hewan" dense>
              <div className="flex gap-2 text-sm"><Tag>Draf {d.units.draft}</Tag><Tag tone="warning">Final {d.units.final}</Tag><Tag tone="success">Terkunci {d.units.locked}</Tag></div>
              <Link to="/admin/alokasi" className="mt-2 inline-block text-xs font-semibold text-primary underline">Buka alokasi</Link>
            </Panel>
            <Panel title="Pengumuman H-7" dense>
              {d.announcement ? <p className="text-sm">Versi {d.announcement.version} · <Tag tone="primary">{ANN_LABEL[d.announcement.status]}</Tag></p> : <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>}
            </Panel>
            <Panel title="Status Pelaksanaan" dense>
              {Object.keys(d.execution).length ? <ul className="space-y-0.5 text-sm">{Object.entries(d.execution).map(([k, v]) => <li key={k} className="flex justify-between"><span>{EXEC_LABEL[k] ?? k}</span><span className="tabular-nums">{v}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Belum ada komitmen.</p>}
            </Panel>
            <Panel title="Status Periode Kurban" dense>
              <ol className="space-y-0.5 text-sm">{STAGES.map((s, i) => { const j = d.journey.find((x) => x.stage === i + 1); return <li key={s} className="flex justify-between gap-2"><span>{i + 1}. {s}</span>{j?.status === "verified" ? <Tag tone="success">Terverifikasi</Tag> : <Tag>Belum</Tag>}</li>; })}</ol>
            </Panel>
          </div>
          <Panel title="Aktivitas Terbaru">
            {d.recent.length ? (
              <ul className="divide-y divide-border text-sm">{d.recent.map((r, i) => (
                <li key={i} className="flex flex-wrap gap-2 py-1.5"><span className="font-mono text-xs">{r.action}</span><span className="text-muted-foreground">{r.actor ?? (r.source === "system" ? "Sistem" : "—")}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(new Date(r.created_at), { dateStyle: "medium", timeStyle: "short" })}</span></li>))}</ul>
            ) : <Empty title="Belum ada aktivitas" />}
          </Panel>
        </div>
      )}
    </div>
  );
}

function ChartBar({ data, money }: { data: { x: string; y: number }[]; money?: boolean }) {
  return (
    <div className="h-48">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="x" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={money ? 70 : 30} tickFormatter={(v: number) => (money ? `${Math.round(v / 1000)}rb` : String(v))} />
          <Tooltip formatter={(v: number) => (money ? formatRupiah(v) : v)} />
          <Bar dataKey="y" name={money ? "Nominal" : "Jumlah"} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
