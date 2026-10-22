import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { PageHead, Panel, Guard, Loading, Failure, Tag, Field, Empty, DataTable, RowActions, ConfirmAction, NativeSelect, SearchBox, Pager } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { rpc, ROLE_LABEL, type AdminRole } from "@/lib/admin";
import { PERM_LABEL } from "@/lib/permissions";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { inviteAdminUser, resendAdminSetupEmail } from "@/lib/admin-users.functions";
import type { AccessGroup } from "./admin.hak-akses";

export const Route = createFileRoute("/_authenticated/admin/pengguna")({
  head: () => ({ meta: [{ title: "Pengguna | Admin qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <Guard perms="users.manage"><Page /></Guard>,
});

interface AdminUser {
  user_id: string; full_name: string; email: string; role: AdminRole; is_active: boolean;
  created_at: string; last_sign_in_at: string | null;
  group: { id: string; slug: string; name: string } | null;
}

function Page() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<AdminUser | null>(null);

  const groups = useQuery({ queryKey: ["admin", "access-groups"], queryFn: () => rpc<AccessGroup[]>("admin_list_groups") });
  const q = useQuery({
    queryKey: ["admin", "users", search, groupId, status, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: () => rpc<{ total: number; rows: AdminUser[] }>("admin_list_users", {
      p_search: search.trim(), p_group: groupId || null, p_status: status, p_limit: pageSize, p_offset: page * pageSize,
    }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  const reset = (fn: () => void) => { fn(); setPage(0); };
  const filtersActive = !!(search || groupId || status);
  const activeGroups = (groups.data ?? []).filter((g) => g.is_active);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHead to="/admin/pengguna" count={q.data?.total}
        actions={<Button size="sm" onClick={() => setAdding(true)}>Tambah Pengguna</Button>}>
        <p className="mt-1 text-xs text-muted-foreground">Modul ini mengelola akun admin, bukan peserta kurban. Undangan dikirim via email tanpa kata sandi awal. Menonaktifkan akses admin tidak menghapus akun peserta orang tersebut.</p>
      </PageHead>
      {q.isPending ? <Panel><Loading /></Panel> : q.isError ? <Panel><Failure error={q.error} onRetry={() => q.refetch()} /></Panel> : (
        <DataTable rows={q.data.rows} rowKey={(r) => r.user_id} empty={<Empty title="Tidak ada pengguna" text="Coba ubah kata kunci atau filter." />}
          toolbar={<>
            <SearchBox value={search} onChange={(v) => reset(() => setSearch(v))} placeholder="Cari nama atau email" />
            <NativeSelect label="Grup" value={groupId} onChange={(v) => reset(() => setGroupId(v))}>
              <option value="">Semua grup</option>
              {(groups.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </NativeSelect>
            <NativeSelect label="Status" value={status} onChange={(v) => reset(() => setStatus(v))}>
              <option value="">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option>
            </NativeSelect>
            {filtersActive && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => reset(() => { setSearch(""); setGroupId(""); setStatus(""); })}>Reset filter</button>}
          </>}
          footer={<Pager page={page} pageSize={pageSize} total={q.data.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(0); }} />}
          cols={[
            { label: "Nama Pengguna", primary: true, sort: (r) => r.full_name.toLowerCase(), cell: (r) => <span className="font-semibold">{r.full_name}</span> },
            { label: "Email", cell: (r) => <span className="break-all">{r.email}</span> },
            { label: "Grup", cell: (r) => (r.group ? <Tag tone="primary">{r.group.name}</Tag> : <Tag>{ROLE_LABEL[r.role]}</Tag>) },
            { label: "Status", cell: (r) => (r.is_active ? <Tag tone="success">Aktif</Tag> : <Tag tone="danger">Nonaktif</Tag>) },
            { label: "Login Terakhir", hideOnMobile: true, sort: (r) => r.last_sign_in_at ?? "", cell: (r) => (r.last_sign_in_at ? formatRelativeTime(r.last_sign_in_at) : "Belum pernah") },
            { label: "Dibuat", hideOnMobile: true, sort: (r) => r.created_at, cell: (r) => formatDate(new Date(r.created_at), { dateStyle: "medium" }) },
            { label: "Aksi", cell: (r) => (
              <RowActions label={`Aksi untuk ${r.full_name}`} items={[
                { label: "Lihat Detail", onSelect: () => setDetail(r) },
                { label: "Edit", onSelect: () => setEditing(r) },
                { label: "Kirim Ulang Email Pengaturan", onSelect: async () => {
                    try { await resendAdminSetupEmail({ data: { email: r.email } }); toast.success("Email pengaturan akun dikirim"); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal mengirim email"); }
                  } },
                {
                  label: r.is_active ? "Nonaktifkan Akses" : "Aktifkan Akses", destructive: r.is_active, separatorBefore: true,
                  confirm: {
                    title: `${r.is_active ? "Nonaktifkan" : "Aktifkan"} akses admin ${r.full_name}?`,
                    description: r.is_active ? "Orang ini kehilangan akses admin, tetapi akun peserta dan datanya tetap ada." : "Akses admin dipulihkan sesuai grupnya.",
                    confirmLabel: r.is_active ? "Nonaktifkan" : "Aktifkan", minReason: 5,
                  },
                  onConfirm: async (reason) => {
                    await rpc("admin_update_user", { p_user_id: r.user_id, p_full_name: null, p_group_id: r.group?.id ?? groups.data?.find((g) => g.role === r.role)?.id, p_active: !r.is_active, p_reason: reason });
                    toast.success("Status akses diperbarui"); refresh();
                  },
                },
              ]} />
            ) },
          ]} />
      )}
      {adding && <AddUserDialog groups={activeGroups} onClose={(saved) => { setAdding(false); if (saved) refresh(); }} />}
      {editing && <EditUserDialog user={editing} groups={activeGroups} onClose={(saved) => { setEditing(null); if (saved) refresh(); }} />}
      {detail && <UserDetailSheet user={detail} groups={groups.data ?? []} onClose={() => setDetail(null)} />}
    </div>
  );
}

function AddUserDialog({ groups, onClose }: { groups: AccessGroup[]; onClose: (saved: boolean) => void }) {
  const invite = useServerFn(inviteAdminUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const valid = name.trim().length >= 3 && /^\S+@\S+\.\S+$/.test(email.trim()) && !!groupId;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Pengguna Admin</DialogTitle>
          <DialogDescription>Sistem mengirim email undangan pengaturan akun. Tidak ada kata sandi awal yang dibuat atau ditampilkan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nama Lengkap" htmlFor="u-name"><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" htmlFor="u-email" error={err ?? undefined}><Input id="u-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} /></Field>
          <Field label="Grup Pengguna" htmlFor="u-group">
            <NativeSelect label="Grup Pengguna" value={groupId} onChange={setGroupId} className="w-full">
              <option value="">Pilih grup…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onClose(false)}>Batal</Button>
          <ConfirmAction title={`Undang ${email} sebagai admin?`} description="Email undangan berisi tautan pengaturan akun. Penetapan grup tercatat di Log Aktivitas." confirmLabel="Kirim Undangan" minReason={5}
            onConfirm={async (reason) => {
              const res = await invite({ data: { name: name.trim(), email: email.trim(), groupId, reason } });
              toast.success(res.invited ? "Undangan terkirim" : "Akun yang sudah ada ditautkan ke grup admin");
              onClose(true);
            }}
            trigger={(o) => <Button disabled={!valid} onClick={() => { if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Email tidak valid"); o(); }}>Kirim Undangan</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, groups, onClose }: { user: AdminUser; groups: AccessGroup[]; onClose: (saved: boolean) => void }) {
  const [name, setName] = useState(user.full_name);
  const [groupId, setGroupId] = useState(user.group?.id ?? "");
  const dirty = name.trim() !== user.full_name || groupId !== (user.group?.id ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Pengguna: {user.full_name}</DialogTitle>
          <DialogDescription>{user.email} · Perubahan grup berlaku setelah pengguna memuat ulang sesinya.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Nama Lengkap" htmlFor="e-name"><Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Grup Pengguna" htmlFor="e-group">
            <NativeSelect label="Grup Pengguna" value={groupId} onChange={setGroupId} className="w-full">
              <option value="">Pilih grup…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onClose(false)}>Batal</Button>
          <ConfirmAction title="Simpan perubahan pengguna?" confirmLabel="Simpan" minReason={5}
            onConfirm={async (reason) => {
              await rpc("admin_update_user", { p_user_id: user.user_id, p_full_name: name.trim(), p_group_id: groupId, p_active: user.is_active, p_reason: reason });
              toast.success("Pengguna diperbarui"); onClose(true);
            }}
            trigger={(o) => <Button onClick={o} disabled={!dirty || name.trim().length < 3 || !groupId}>Simpan</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailSheet({ user, groups, onClose }: { user: AdminUser; groups: AccessGroup[]; onClose: () => void }) {
  const activity = useQuery({
    queryKey: ["admin", "user-activity", user.user_id],
    queryFn: () => rpc<{ id: string; action: string; entity: string; result: string; reason: string | null; created_at: string }[]>("admin_user_activity", { p_user_id: user.user_id }),
  });
  const group = groups.find((g) => g.id === user.group?.id);
  const perms = group?.permissions ?? [];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{user.full_name}</SheetTitle>
          <SheetDescription>{user.email}</SheetDescription>
        </SheetHeader>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs font-bold text-muted-foreground">Grup</dt><dd>{user.group?.name ?? ROLE_LABEL[user.role]}</dd></div>
          <div><dt className="text-xs font-bold text-muted-foreground">Status</dt><dd>{user.is_active ? <Tag tone="success">Aktif</Tag> : <Tag tone="danger">Nonaktif</Tag>}</dd></div>
          <div><dt className="text-xs font-bold text-muted-foreground">Dibuat</dt><dd>{formatDate(new Date(user.created_at), { dateStyle: "medium" })}</dd></div>
          <div><dt className="text-xs font-bold text-muted-foreground">Login Terakhir</dt><dd>{user.last_sign_in_at ? formatDate(new Date(user.last_sign_in_at), { dateStyle: "medium", timeStyle: "short" }) : "Belum pernah"}</dd></div>
        </dl>
        <h3 className="mt-5 text-sm font-bold">Ringkasan Hak Akses</h3>
        {perms.length ? (
          <ul className="mt-1 flex flex-wrap gap-1">
            {(perms.includes("*") ? ["*"] : perms).map((p) => <li key={p}><Tag tone={p === "*" ? "primary" : "muted"}>{PERM_LABEL[p] ?? p}</Tag></li>)}
          </ul>
        ) : <p className="mt-1 text-sm text-muted-foreground">Mengikuti peran lama ({ROLE_LABEL[user.role]}); belum ada grup.</p>}
        <h3 className="mt-5 text-sm font-bold">Aktivitas Terakhir</h3>
        {activity.isPending ? <Loading /> : activity.isError ? <Failure error={activity.error} /> : !activity.data.length ? (
          <p className="mt-1 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border text-sm">
            {activity.data.map((a) => (
              <li key={a.id} className="py-1.5">
                <span className="font-mono text-xs">{a.action}</span> · {a.entity} · <Tag tone={a.result === "SUCCESS" ? "success" : "danger"}>{a.result}</Tag>
                <span className="block text-xs text-muted-foreground">{a.reason ?? "—"} · {formatDate(new Date(a.created_at), { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
