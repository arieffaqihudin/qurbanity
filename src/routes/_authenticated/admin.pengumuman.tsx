import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, Tag, Empty, DataTable, RowActions } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc, useAdmin } from "@/lib/admin";
import { useDefaultProgram } from "@/lib/admin-hooks";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pengumuman")({
  head: () => ({ meta: [{ title: "Pengumuman H-7 | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="announcement.view"><Page /></Guard>,
});

const LABEL = { draft: "DRAFT", approved: "APPROVED", scheduled: "SCHEDULED", published: "PUBLISHED", withdrawn: "WITHDRAWN" } as const;
const TONE = { draft: "muted", approved: "primary", scheduled: "warning", published: "success", withdrawn: "danger" } as const;
type Snap = { unit_code: string; category: string; names: string[] }[];
const dt = (s: string) => formatDate(new Date(s), { dateStyle: "medium", timeStyle: "short" });

function Page() {
  const { can } = useAdmin();
  const [program, setProgram] = useDefaultProgram();
  const qc = useQueryClient();
  const [title, setTitle] = useState("Pengumuman Kelompok Hewan Kurban");
  const [preview, setPreview] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin", "announcements", program], enabled: !!program,
    queryFn: async () => {
      const [a, u] = await Promise.all([
        supabase.from("announcements").select("*").eq("program_id", program).order("version", { ascending: false }),
        supabase.from("animal_units").select("status").eq("program_id", program),
      ]);
      if (a.error) throw new Error(a.error.message);
      if (u.error) throw new Error(u.error.message);
      return { list: a.data ?? [], unlocked: (u.data ?? []).filter((x) => x.status !== "locked").length, locked: (u.data ?? []).filter((x) => x.status === "locked").length };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
  const move = (id: string, to: string, extra: Record<string, unknown> = {}) => async (reason: string) => {
    await rpc("admin_announcement_transition", { p_id: id, p_to: to, p_reason: reason || null, p_scheduled_at: null, ...extra });
    toast.success(`Status menjadi ${LABEL[to as keyof typeof LABEL]}`); refresh();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageHead to="/admin/pengumuman" actions={<ProgramFilter value={program} onChange={setProgram} allowAll={false} />}>
        <p className="mt-1 text-xs text-muted-foreground">Alur: DRAFT → APPROVED → SCHEDULED → PUBLISHED, atau WITHDRAWN dengan alasan. Nama ditampilkan sesuai izin publikasi peserta: lengkap, disamarkan, atau privat (hanya terlihat oleh peserta sendiri di portal).</p>
      </PageHead>
      {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : q.data && (
        <>
          {can("announcement.manage") && (
            <Panel title="Buat snapshot baru">
              {q.data.unlocked > 0 && <p className="mb-2 rounded bg-warning/15 p-2 text-xs text-burgundy-dark">Peringatan: {q.data.unlocked} unit hewan belum dikunci dan tidak akan masuk snapshot.</p>}
              {q.data.locked === 0 && <p className="mb-2 text-xs text-muted-foreground">Belum ada unit terkunci; snapshot akan kosong dan tidak dapat disetujui.</p>}
              <div className="flex flex-wrap gap-2">
                <Input aria-label="Judul pengumuman" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 max-w-md" />
                <Button size="sm" onClick={async () => { try { await rpc("admin_generate_announcement", { p_program_id: program, p_title: title }); toast.success("Snapshot draf dibuat"); refresh(); } catch (e) { toast.error((e as Error).message); } }}>Buat dari alokasi terkunci</Button>
              </div>
            </Panel>
          )}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riwayat versi</p>
          {q.data.list.length === 0 ? <Panel><Empty title="Belum ada pengumuman" /></Panel> : (
            <DataTable rows={q.data.list} rowKey={(a) => a.id} cols={[
              { label: "Versi", primary: true, sort: (a) => a.version, cell: (a) => <span><span className="font-bold">v{a.version}</span> <span className="text-muted-foreground">· {a.title}</span></span> },
              { label: "Status", cell: (a) => <Tag tone={TONE[a.status]}>{LABEL[a.status]}</Tag> },
              { label: "Unit", className: "text-right tabular-nums", cell: (a) => ((a.snapshot as unknown as Snap) ?? []).length },
              { label: "Waktu", hideOnMobile: true, cell: (a) => <span className="text-xs text-muted-foreground">dibuat {dt(a.created_at)}{a.scheduled_at ? ` · jadwal ${dt(a.scheduled_at)}` : ""}{a.published_at ? ` · terbit ${dt(a.published_at)}` : ""}{a.withdrawn_reason ? ` · ditarik: ${a.withdrawn_reason}` : ""}</span> },
              { label: "Aksi", cell: (a) => <RowActions label={`Aksi untuk pengumuman v${a.version}`} items={[
                { label: preview === a.id ? "Tutup pratinjau" : "Pratinjau", onSelect: () => setPreview(preview === a.id ? null : a.id) },
                can("announcement.manage") && a.status === "draft" && {
                  label: "Setujui snapshot",
                  confirm: { title: "Setujui snapshot?", confirmLabel: "Setujui", description: "Setelah disetujui, isi snapshot dibekukan." },
                  onConfirm: move(a.id, "approved"),
                },
                can("announcement.manage") && a.status === "approved" && {
                  label: "Jadwalkan publikasi",
                  confirm: { title: "Jadwalkan publikasi", confirmLabel: "Jadwalkan", description: "Pengumuman otomatis terlihat publik pada waktu ini (WIB).",
                    fields: [{ key: "at", label: "Waktu publikasi (WIB)", type: "datetime-local" }] },
                  onConfirm: async (_r, v) => { if (!v["at"]) throw new Error("Pilih waktu publikasi"); await move(a.id, "scheduled", { p_scheduled_at: `${v["at"]}:00+07:00` })(""); },
                },
                can("announcement.manage") && ["approved", "scheduled"].includes(a.status) && {
                  label: "Publikasikan sekarang",
                  confirm: { title: "Publikasikan sekarang?", confirmLabel: "Publikasikan", description: "Pengumuman langsung terlihat publik. Versi terbit sebelumnya akan ditarik otomatis." },
                  onConfirm: move(a.id, "published"),
                },
                can("announcement.manage") && ["approved", "scheduled", "published"].includes(a.status) && {
                  label: "Tarik pengumuman", destructive: true, separatorBefore: true,
                  confirm: { title: "Tarik pengumuman?", confirmLabel: "Tarik", minReason: 5 },
                  onConfirm: move(a.id, "withdrawn"),
                },
              ]} /> },
            ]} />
          )}
          {preview && (() => { const a = q.data.list.find((x) => x.id === preview); if (!a) return null; const snap = (a.snapshot as unknown as Snap) ?? []; return (
            <Panel title={`Pratinjau v${a.version} · ${a.title}`}>
              {snap.length === 0 ? <p className="text-xs text-muted-foreground">Snapshot kosong.</p> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {snap.map((s) => (
                    <div key={s.unit_code} className="rounded border border-border bg-card p-2 text-xs"><p className="font-bold">{s.unit_code} · {s.category}</p><ol className="mt-1 list-decimal pl-4">{s.names.map((n, i) => <li key={i}>{n}</li>)}</ol></div>
                  ))}
                </div>
              )}
            </Panel>); })()}
        </>
      )}
    </div>
  );
}
