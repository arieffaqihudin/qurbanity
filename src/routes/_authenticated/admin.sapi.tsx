import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHead, Panel, Guard, Loading, Failure, ProgramFilter, DataTable, Tag, Field, ConfirmAction } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { rpc, useAdmin, programsQuery } from "@/lib/admin";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/sapi")({
  head: () => ({ meta: [{ title: "Kategori Hewan | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="catalog.view"><Page /></Guard>,
});

type Cat = { id: string; program_id: string; code: string; name: string; kind: "sapi" | "kambing"; max_shares: number; weight_range: string | null; description: string | null; is_available: boolean; sort_order: number };
type Price = { id: string; category_id: string; animal_cost: number; operational_cost: number; is_final: boolean; effective_from: string; created_at: string };

export function useCatalog(program: string) {
  return useQuery({
    queryKey: ["admin", "catalog", program], enabled: !!program,
    queryFn: async () => {
      const c = await supabase.from("animal_categories").select("*").eq("program_id", program).order("sort_order");
      if (c.error) throw new Error(c.error.message);
      const p = await supabase.from("animal_prices").select("*").in("category_id", (c.data ?? []).map((x) => x.id)).order("effective_from", { ascending: false }).order("created_at", { ascending: false });
      if (p.error) throw new Error(p.error.message);
      const now = Date.now();
      return (c.data as Cat[]).map((cat) => {
        const prices = (p.data as Price[]).filter((x) => x.category_id === cat.id);
        const final = prices.find((x) => x.is_final && new Date(x.effective_from).getTime() <= now) ?? null;
        const latest = prices[0] ?? null;
        return { ...cat, prices, final, latest };
      });
    },
  });
}

export function useDefaultProgram() {
  const programs = useQuery(programsQuery);
  const [program, setProgram] = useState("");
  const value = program || programs.data?.find((p) => p.status === "open")?.id || programs.data?.[0]?.id || "";
  return [value, setProgram] as const;
}

function Page() {
  const { can } = useAdmin();
  const [program, setProgram] = useDefaultProgram();
  const q = useCatalog(program);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead to="/admin/sapi" actions={<>
        <ProgramFilter value={program} onChange={setProgram} allowAll={false} />
        {can("catalog.manage") && program && <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> Kategori</Button>}
      </>} />
      {editing && <CategoryForm program={program} cat={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <Panel>
        {!program ? <p className="text-sm text-muted-foreground">Belum ada program.</p> : q.isPending ? <Loading /> : q.isError ? <Failure error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable rows={q.data} rowKey={(r) => r.id} cols={[
            { label: "Kategori", primary: true, cell: (r) => <span className="font-semibold">{r.name}</span> },
            { label: "Jenis", cell: (r) => (r.kind === "sapi" ? "Sapi · 7 bagian" : "Kambing · 1 ekor") },
            { label: "Perkiraan bobot", cell: (r) => r.weight_range ?? "—" },
            { label: "Harga hewan", className: "text-right tabular-nums", cell: (r) => (r.final ? formatRupiah(r.final.animal_cost) : "—") },
            { label: "Operasional", className: "text-right tabular-nums", cell: (r) => (r.final ? formatRupiah(r.final.operational_cost) : "—") },
            { label: "Status harga", cell: (r) => r.final ? <Tag tone="success">FINAL</Tag> : r.latest ? <Tag tone="warning">DRAFT</Tag> : <Tag>Belum ada</Tag> },
            { label: "Ketersediaan", cell: (r) => (r.final && r.is_available ? <Tag tone="success">Dapat dipilih</Tag> : <Tag tone="danger">Tidak dapat dipilih</Tag>) },
            { label: "Aksi", cell: (r) => can("catalog.manage") ? <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setEditing(r)}>Ubah</button> : null },
          ]} />
        )}
        <p className="mt-3 text-xs text-muted-foreground">Kategori tanpa harga FINAL, atau yang dinonaktifkan, tidak bisa dipilih peserta. Harga diatur di menu Harga &amp; Riwayat.</p>
      </Panel>
    </div>
  );
}

function CategoryForm({ program, cat, onClose, onSaved }: { program: string; cat: Cat | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: cat?.name ?? "", code: cat?.code ?? "", kind: cat?.kind ?? "sapi", weight_range: cat?.weight_range ?? "", description: cat?.description ?? "", is_available: cat?.is_available ?? true, sort_order: String(cat?.sort_order ?? 10) });
  const [err, setErr] = useState<Record<string, string>>({});
  const validate = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Nama minimal 3 karakter";
    if (!cat && !/^[a-z0-9-]{3,40}$/.test(f.code)) e.code = "Kode 3–40 huruf kecil, angka, atau tanda -";
    setErr(e); return !Object.keys(e).length;
  };
  return (
    <Panel title={cat ? `Ubah ${cat.name}` : "Kategori baru"} className="mb-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama kategori" htmlFor="k-name" error={err.name}><Input id="k-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {!cat && <Field label="Kode" htmlFor="k-code" error={err.code} hint="contoh: sapi-premium"><Input id="k-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>}
        {!cat && <Field label="Jenis hewan" htmlFor="k-kind"><select id="k-kind" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "sapi" | "kambing" })}><option value="sapi">Sapi (7 bagian)</option><option value="kambing">Kambing (1 ekor)</option></select></Field>}
        <Field label="Perkiraan bobot" htmlFor="k-w"><Input id="k-w" value={f.weight_range} onChange={(e) => setF({ ...f, weight_range: e.target.value })} placeholder="± 250–300 kg" /></Field>
        <Field label="Urutan tampil" htmlFor="k-o"><Input id="k-o" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: e.target.value })} /></Field>
        <div className="flex items-center gap-2 pt-5"><Switch id="k-av" checked={f.is_available} onCheckedChange={(v) => setF({ ...f, is_available: v })} /><label htmlFor="k-av" className="text-sm">Tersedia untuk komitmen baru</label></div>
        <div className="sm:col-span-2"><Field label="Deskripsi" htmlFor="k-d"><Textarea id="k-d" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>Batal</Button>
        <ConfirmAction title="Simpan kategori?" description="Perubahan dicatat di audit log. Harga tidak berubah dari sini." confirmLabel="Simpan"
          onConfirm={async () => { await rpc("admin_save_category", { p_id: cat?.id ?? null, p: { ...f, program_id: program, sort_order: Number(f.sort_order) } }); toast.success("Kategori tersimpan"); onSaved(); onClose(); }}
          trigger={(o) => <Button size="sm" onClick={() => validate() && o()}>Simpan</Button>} />
      </div>
    </Panel>
  );
}
