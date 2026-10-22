import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Copy, Pencil, ShieldAlert, Trash2 } from "lucide-react";
import { PageHead, Panel, Guard, Loading, Failure, Tag, Field, Empty, DataTable, RowActions, ConfirmAction, NativeSelect } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rpc } from "@/lib/admin";
import { permissionSections, isViewPerm, type PermSection } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/hak-akses")({
  head: () => ({ meta: [{ title: "Hak Akses | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="access.manage"><Page /></Guard>,
});

export interface AccessGroup {
  id: string; slug: string; name: string; description: string; role: string | null;
  is_system: boolean; is_active: boolean; updated_at: string; members: number; permissions: string[];
}

function Page() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AccessGroup | "new" | null>(null);
  const q = useQuery({
    queryKey: ["admin", "access-groups"],
    queryFn: () => rpc<AccessGroup[]>("admin_list_groups"),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "access-groups"] });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHead to="/admin/hak-akses" count={q.data?.length}
        actions={<Button size="sm" onClick={() => setEditing("new")}>Tambah Grup</Button>}>
        <p className="mt-1 text-xs text-muted-foreground">Grup bawaan sistem tidak dapat dihapus. Grup Superadmin terkunci demi keamanan. Setiap perubahan tercatat di Log Aktivitas.</p>
      </PageHead>
      {q.isPending ? <Panel><Loading /></Panel> : q.isError ? <Panel><Failure error={q.error} onRetry={() => q.refetch()} /></Panel> : (
        <DataTable rows={q.data} rowKey={(r) => r.id} empty={<Empty title="Belum ada grup" />} cols={[
          { label: "Nama Grup", primary: true, sort: (r) => r.name.toLowerCase(), cell: (r) => (
            <span className="font-semibold">{r.name}{r.is_system && <Tag tone="primary">Bawaan</Tag>}</span>
          ) },
          { label: "Deskripsi", hideOnMobile: true, cell: (r) => <span className="text-xs text-muted-foreground">{r.description || "—"}</span> },
          { label: "Pengguna", sort: (r) => r.members, cell: (r) => <span className="tabular-nums">{r.members}</span> },
          { label: "Hak Akses", sort: (r) => r.permissions.length, cell: (r) => <span className="tabular-nums">{r.permissions.includes("*") ? "Semua" : r.permissions.length}</span> },
          { label: "Status", cell: (r) => (r.is_active ? <Tag tone="success">Aktif</Tag> : <Tag tone="muted">Nonaktif</Tag>) },
          { label: "Diperbarui", hideOnMobile: true, sort: (r) => r.updated_at, cell: (r) => formatDate(new Date(r.updated_at), { dateStyle: "medium" }) },
          { label: "Aksi", cell: (r) => (
            <RowActions label={`Aksi untuk grup ${r.name}`} items={[
              { label: "Lihat / Edit", onSelect: () => setEditing(r) },
              { label: "Duplikasi", confirm: { title: `Duplikasi grup ${r.name}?`, description: "Grup baru berisi salinan hak akses grup ini.", confirmLabel: "Duplikasi", minReason: 5 },
                onConfirm: async (reason) => { await rpc("admin_duplicate_group", { p_id: r.id, p_reason: reason }); toast.success("Grup diduplikasi"); refresh(); } },
              r.slug !== "superadmin" && {
                label: r.is_active ? "Nonaktifkan" : "Aktifkan",
                confirm: { title: `${r.is_active ? "Nonaktifkan" : "Aktifkan"} grup ${r.name}?`, description: r.is_active ? "Pengguna dalam grup ini kehilangan hak akses dari grup sampai diaktifkan kembali." : undefined, confirmLabel: r.is_active ? "Nonaktifkan" : "Aktifkan", minReason: 5, destructive: r.is_active },
                onConfirm: async (reason) => { await rpc("admin_save_group", { p_id: r.id, p: { name: r.name, description: r.description, is_active: !r.is_active, permissions: r.permissions }, p_reason: reason }); toast.success("Status grup diperbarui"); refresh(); },
              },
              !r.is_system && {
                label: "Hapus", destructive: true, separatorBefore: true,
                confirm: { title: `Hapus grup ${r.name}?`, description: "Hanya grup tanpa pengguna aktif yang dapat dihapus. Tindakan ini tidak dapat dibatalkan.", confirmLabel: "Hapus grup", minReason: 5, destructive: true },
                onConfirm: async (reason) => { await rpc("admin_delete_group", { p_id: r.id, p_reason: reason }); toast.success("Grup dihapus"); refresh(); },
              },
            ]} />
          ) },
        ]} />
      )}
      {editing && <GroupDialog group={editing === "new" ? null : editing} onClose={(saved) => { setEditing(null); if (saved) refresh(); }} />}
    </div>
  );
}

function GroupDialog({ group, onClose }: { group: AccessGroup | null; onClose: (saved: boolean) => void }) {
  const sections = useMemo(permissionSections, []);
  const [name, setName] = useState(group?.name ?? "");
  const [desc, setDesc] = useState(group?.description ?? "");
  const [active, setActive] = useState(group?.is_active ?? true);
  const [perms, setPerms] = useState<Set<string>>(new Set(group?.permissions.filter((p) => p !== "*") ?? []));
  const [search, setSearch] = useState("");
  const [closed, setClosed] = useState<string[]>([]);
  const locked = group?.slug === "superadmin";

  const initial = JSON.stringify({ name: group?.name ?? "", desc: group?.description ?? "", active: group?.is_active ?? true, perms: [...(group?.permissions.filter((p) => p !== "*") ?? [])].sort() });
  const dirty = JSON.stringify({ name, desc, active, perms: [...perms].sort() }) !== initial;

  const tryClose = () => {
    if (dirty && !window.confirm("Perubahan belum disimpan. Tutup tanpa menyimpan?")) return;
    onClose(false);
  };

  const toggle = (key: string) => setPerms((cur) => { const n = new Set(cur); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const setMany = (keys: string[], on: boolean) => setPerms((cur) => { const n = new Set(cur); keys.forEach((k) => (on ? n.add(k) : n.delete(k))); return n; });

  const filtered: PermSection[] = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return sections;
    return sections.map((sec) => ({
      ...sec,
      menus: sec.menus.map((m) => ({ ...m, perms: m.perms.filter((p) => p.label.toLowerCase().includes(s) || p.key.includes(s)) })).filter((m) => m.perms.length),
    })).filter((sec) => sec.menus.length);
  }, [sections, search]);

  const viewKeys = sections.flatMap((s) => s.menus.flatMap((m) => m.perms.filter((p) => isViewPerm(p.key)).map((p) => p.key)));

  return (
    <Dialog open onOpenChange={(o) => !o && tryClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{group ? `Edit Grup: ${group.name}` : "Tambah Grup Pengguna"}</DialogTitle>
          <DialogDescription>{locked ? "Grup Superadmin terkunci: nama, status, dan hak aksesnya tidak dapat diubah." : "Matriks hak akses mengikuti menu admin yang benar-benar tersedia."}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="col-span-full text-xs font-bold uppercase tracking-wide text-muted-foreground">Informasi Grup</legend>
            <Field label="Nama Grup Pengguna" htmlFor="g-name"><Input id="g-name" value={name} disabled={locked} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Status" htmlFor="g-active">
              <label className="flex h-9 items-center gap-2 text-sm"><Switch id="g-active" checked={active} disabled={locked} onCheckedChange={setActive} />{active ? "Aktif" : "Nonaktif"}</label>
            </Field>
            <div className="sm:col-span-2"><Field label="Deskripsi" htmlFor="g-desc"><Textarea id="g-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Pengaturan Hak Akses</legend>
            {locked ? (
              <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">Grup Superadmin memiliki semua hak akses dan tidak dapat dibatasi.</p>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama izin…" aria-label="Cari nama izin" className="h-9 max-w-56" />
                  <Button type="button" size="sm" variant="outline" onClick={() => setMany(viewKeys, true)}>Pilih semua izin lihat</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPerms(new Set())}>Kosongkan</Button>
                </div>
                <div className="space-y-2">
                  {filtered.map((sec) => {
                    const open = !closed.includes(sec.group);
                    return (
                      <div key={sec.group} className="rounded-xl border border-border">
                        <button type="button" onClick={() => setClosed((c) => (c.includes(sec.group) ? c.filter((x) => x !== sec.group) : [...c, sec.group]))}
                          aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-bold">
                          <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />{sec.group}
                        </button>
                        {open && (
                          <div className="space-y-2 border-t border-border px-3 py-2">
                            {sec.menus.map((m) => {
                              const keys = m.perms.map((p) => p.key);
                              const all = keys.every((k) => perms.has(k));
                              return (
                                <div key={m.label}>
                                  <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                    <Checkbox checked={all} onCheckedChange={(c) => setMany(keys, c === true)} aria-label={`Pilih semua izin ${m.label}`} />{m.label}
                                  </label>
                                  <div className="mt-1 grid gap-1 pl-6 sm:grid-cols-2">
                                    {m.perms.map((p) => (
                                      <label key={p.key} className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={perms.has(p.key)} onCheckedChange={() => toggle(p.key)} aria-label={p.label} />
                                        <span>{p.label}</span>
                                        {p.sensitive && <span className="flex items-center gap-0.5 text-[10px] font-bold text-warning"><ShieldAlert className="size-3" />Sensitif</span>}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!filtered.length && <p className="text-sm text-muted-foreground">Tidak ada izin yang cocok dengan pencarian.</p>}
                </div>
              </>
            )}
          </fieldset>
        </div>
        <DialogFooter className="gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={tryClose}>Batal</Button>
          {dirty && <span className="mr-auto text-xs font-semibold text-warning">Ada perubahan yang belum disimpan</span>}
          {!locked && (
            <ConfirmAction title={group ? "Simpan perubahan grup?" : "Buat grup baru?"} description="Perubahan hak akses berlaku setelah pengguna memuat ulang sesinya." confirmLabel="Simpan" minReason={5} disabled={name.trim().length < 3}
              onConfirm={async (reason) => {
                await rpc("admin_save_group", { p_id: group?.id ?? null, p: { name: name.trim(), description: desc.trim(), is_active: active, permissions: [...perms] }, p_reason: reason });
                toast.success(group ? "Grup diperbarui" : "Grup dibuat");
                onClose(true);
              }}
              trigger={(o) => <Button onClick={o} disabled={name.trim().length < 3 || !dirty}>{group ? "Simpan Perubahan" : "Buat Grup"}</Button>} />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
