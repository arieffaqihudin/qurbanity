import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, CheckCircle2, Circle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, Tag, Field, ConfirmAction, Empty, NativeSelect } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { rpc, useAdmin, STAGES, DOC_CATEGORY_LABEL } from "@/lib/admin";
import { useDefaultProgram } from "@/lib/admin-hooks";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/penyaluran")({
  head: () => ({ meta: [{ title: "Perjalanan & Dokumentasi | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms={["journey.view", "docs.upload"]}><Page /></Guard>,
});

export const DOC_RULES = { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "application/pdf"] } as const;

function Page() {
  const { can } = useAdmin();
  const [program, setProgram] = useDefaultProgram();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "journey", program], enabled: !!program,
    queryFn: async () => {
      const [s, d] = await Promise.all([
        supabase.from("journey_stages").select("*").eq("program_id", program).order("stage"),
        supabase.from("documents").select("*").eq("program_id", program).order("created_at", { ascending: false }),
      ]);
      if (s.error) throw new Error(s.error.message);
      if (d.error) throw new Error(d.error.message);
      return { stages: s.data ?? [], docs: d.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "journey"] });
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageHead to="/admin/penyaluran" actions={<ProgramFilter value={program} onChange={setProgram} allowAll={false} />} />
      {q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : q.data && (
        <>
          <Panel title="Tahapan program">
            <ol className="grid gap-2 md:grid-cols-4">
              {STAGES.map((name, i) => {
                const s = q.data.stages.find((x) => x.stage === i + 1);
                const prevOk = i === 0 || q.data.stages.some((x) => x.stage === i && x.status === "verified");
                const done = s?.status === "verified";
                const docs = q.data.docs.filter((d) => d.stage === i + 1).length;
                return (
                  <li key={name} className="rounded-lg border border-border p-3 text-sm">
                    <p className="flex items-center gap-1.5 font-bold text-burgundy-dark">{done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}{i + 1}. {name}</p>
                    {done ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <p>{formatDate(new Date(s.stage_date!), { dateStyle: "medium" })} · {s.location}</p>
                        <p>Diverifikasi {s.verified_at && formatDate(new Date(s.verified_at), { dateStyle: "medium", timeStyle: "short" })}</p>
                        {s.notes && <p>{s.notes}</p>}
                      </div>
                    ) : <p className="mt-1 text-xs text-muted-foreground">{prevOk ? "Siap diverifikasi" : "Menunggu tahap sebelumnya"}</p>}
                    <p className="mt-1 text-xs">{docs} dokumen</p>
                    {!done && prevOk && can("journey.manage") && <VerifyStage programId={program} stage={i + 1} today={today} onDone={refresh} />}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Tahap harus berurutan, butuh tanggal (tidak boleh di masa depan) dan lokasi. Laporan Dampak membutuhkan dokumentasi distribusi yang sudah dipublikasikan.</p>
          </Panel>
          {can("docs.upload") && <UploadDoc programId={program} onDone={refresh} />}
          <Panel title={`Dokumentasi (${q.data.docs.length})`}>
            {q.data.docs.length === 0 ? <Empty title="Belum ada dokumentasi" /> : (
              <ul className="divide-y divide-border text-sm">
                {q.data.docs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                    <FileText className="size-4 text-muted-foreground" /><span className="font-semibold">{d.title}</span>
                    <Tag>{DOC_CATEGORY_LABEL[d.category]}</Tag>{d.stage && <Tag>Tahap {d.stage}</Tag>}
                    {d.visibility === "published" ? <Tag tone="success">Dipublikasikan</Tag> : <Tag tone="warning">Draf</Tag>}
                    <span className="text-xs text-muted-foreground">{(d.size_bytes / 1024 / 1024).toFixed(2)} MB · {formatDate(new Date(d.created_at), { dateStyle: "medium" })}</span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" className="text-xs font-semibold text-primary underline" onClick={async () => {
                        const { data, error } = await supabase.storage.from("documentation").createSignedUrl(d.storage_path, 300);
                        if (error || !data) return toast.error("Pratinjau tidak dapat dibuka");
                        window.open(data.signedUrl, "_blank", "noopener");
                      }}>Pratinjau</button>
                      {can("docs.publish") && (
                        <ConfirmAction title={d.visibility === "published" ? "Kembalikan ke draf?" : "Publikasikan dokumen?"} confirmLabel="Ya, lanjutkan"
                          description={d.visibility === "published" ? "Peserta tidak lagi dapat melihat dokumen ini." : "Dokumen akan terlihat oleh peserta program ini. Pastikan tidak ada data pribadi tanpa izin."}
                          onConfirm={async () => { await rpc("admin_set_document_visibility", { p_id: d.id, p_visibility: d.visibility === "published" ? "draft" : "published" }); toast.success("Visibilitas diperbarui"); refresh(); }}
                          trigger={(o) => <button type="button" className="text-xs font-semibold text-primary underline" onClick={o}>{d.visibility === "published" ? "Jadikan draf" : "Publikasikan"}</button>} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function VerifyStage({ programId, stage, today, onDone }: { programId: string; stage: number; today: string; onDone: () => void }) {
  const [date, setDate] = useState(today);
  const [loc, setLoc] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <ConfirmAction title={`Verifikasi tahap ${stage}: ${STAGES[stage - 1]}`} confirmLabel="Verifikasi"
      description={<div className="space-y-2">
        <Field label="Tanggal" htmlFor={`v-d-${stage}`}><Input id={`v-d-${stage}`} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Lokasi" htmlFor={`v-l-${stage}`}><Input id={`v-l-${stage}`} value={loc} onChange={(e) => setLoc(e.target.value)} /></Field>
        <Field label="Catatan (opsional)" htmlFor={`v-n-${stage}`}><Input id={`v-n-${stage}`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>}
      onConfirm={async () => {
        if (!date || loc.trim().length < 3) throw new Error("Tanggal dan lokasi (min. 3 karakter) wajib diisi");
        if (date > today) throw new Error("Tanggal tidak boleh di masa depan");
        await rpc("admin_verify_stage", { p_program_id: programId, p_stage: stage, p_date: date, p_location: loc, p_notes: notes || null });
        toast.success("Tahap diverifikasi"); onDone();
      }}
      trigger={(o) => <Button size="sm" className="mt-2" onClick={o}>Verifikasi</Button>} />
  );
}

function UploadDoc({ programId, onDone }: { programId: string; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("preparation");
  const [stage, setStage] = useState("1");
  const [privacy, setPrivacy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pick = (f: File | null) => {
    setErr(null); setFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null);
    if (!f) return;
    if (!(DOC_RULES.types as readonly string[]).includes(f.type)) return setErr("Format harus JPEG, PNG, WebP, atau PDF");
    if (f.size > DOC_RULES.maxBytes) return setErr("Ukuran maksimal 10 MB");
    setFile(f); if (f.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(f));
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };
  const submit = async () => {
    if (!file) return setErr("Pilih berkas");
    if (title.trim().length < 3) return setErr("Judul minimal 3 karakter");
    if (!privacy) return setErr("Centang konfirmasi privasi");
    setErr(null); setProgress(10);
    const ext = file.name.split(".").pop()!.toLowerCase();
    const path = `${programId}/${crypto.randomUUID()}.${ext}`;
    const tick = setInterval(() => setProgress((p) => (p !== null && p < 85 ? p + 5 : p)), 200);
    const up = await supabase.storage.from("documentation").upload(path, file, { contentType: file.type, upsert: false });
    clearInterval(tick);
    if (up.error) { setProgress(null); return setErr(/row-level|403|Unauthorized/i.test(up.error.message) ? "Akses ditolak: peranmu tidak boleh mengunggah dokumentasi" : up.error.message); }
    setProgress(95);
    try {
      await rpc("admin_register_document", { p_program_id: programId, p_stage: stage ? Number(stage) : null, p_category: category, p_title: title, p_path: path, p_mime: file.type, p_size: file.size, p_privacy: privacy });
      setProgress(100); toast.success("Dokumentasi terunggah sebagai draf");
      setFile(null); setTitle(""); setPrivacy(false); if (input.current) input.current.value = ""; onDone();
    } catch (e) { setErr((e as Error).message); }
    finally { setTimeout(() => setProgress(null), 600); }
  };
  return (
    <Panel title="Unggah dokumentasi">
      <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Berkas (JPEG, PNG, WebP, PDF · maks. 10 MB)" htmlFor="doc-file"><Input id="doc-file" ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} /></Field>
          <Field label="Judul" htmlFor="doc-title"><Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Kategori" htmlFor="doc-cat"><NativeSelect label="Kategori" value={category} onChange={setCategory} className="w-full">{Object.entries(DOC_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
          <Field label="Tahap" htmlFor="doc-stage"><NativeSelect label="Tahap" value={stage} onChange={setStage} className="w-full"><option value="">Tanpa tahap</option>{STAGES.map((s, i) => <option key={s} value={String(i + 1)}>{i + 1}. {s}</option>)}</NativeSelect></Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><Checkbox checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} className="mt-0.5" />Saya memastikan berkas ini tidak memuat data pribadi atau wajah penerima manfaat tanpa izin.</label>
        </div>
        <div className="grid place-items-center rounded-lg border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
          {previewUrl ? <img src={previewUrl} alt="Pratinjau berkas" className="max-h-40 rounded object-contain" /> : file ? <span className="flex items-center gap-1"><FileText className="size-4" />{file.name}</span> : "Pratinjau berkas"}
        </div>
      </div>
      {progress !== null && <Progress value={progress} className="mt-3" aria-label="Progres unggah" />}
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
      <Button size="sm" className="mt-3" onClick={submit} disabled={progress !== null}><Upload className="size-4" /> Unggah sebagai draf</Button>
    </Panel>
  );
}
