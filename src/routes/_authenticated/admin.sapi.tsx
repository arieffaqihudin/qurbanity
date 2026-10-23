import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  PageHead,
  Panel,
  Guard,
  Loading,
  Failure,
  ProgramFilter,
  DataTable,
  Tag,
  Field,
  ConfirmAction,
  RowActions,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { rpc, useAdmin } from "@/lib/admin";
import { useCatalog, useDefaultProgram, type CatalogCategory } from "@/lib/admin-hooks";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/sapi")({
  head: () => ({
    meta: [{ title: "Kategori Hewan | Admin qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <Guard perms="catalog.view">
      <Page />
    </Guard>
  ),
});

type Cat = CatalogCategory;

function Page() {
  const { can } = useAdmin();
  const [program, setProgram] = useDefaultProgram();
  const q = useCatalog(program);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Cat | "new" | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "catalog"] });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead
        to="/admin/sapi"
        count={q.data?.length}
        actions={
          <>
            <ProgramFilter value={program} onChange={setProgram} allowAll={false} />
            {can("catalog.manage") && program && (
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" /> Kategori
              </Button>
            )}
          </>
        }
      />
      {editing && (
        <CategoryForm
          program={program}
          cat={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {!program ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Belum ada program.</p>
        </Panel>
      ) : q.isPending ? (
        <Panel>
          <Loading />
        </Panel>
      ) : q.isError ? (
        <Panel>
          <Failure error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : (
        <DataTable
          rows={q.data}
          rowKey={(r) => r.id}
          cols={[
            {
              label: "Kategori",
              primary: true,
              sort: (r) => r.name.toLowerCase(),
              cell: (r) => <span className="font-semibold">{r.name}</span>,
            },
            {
              label: "Jenis",
              cell: (r) => (r.kind === "sapi" ? "Sapi · 7 bagian" : "Kambing · 1 ekor"),
            },
            { label: "Perkiraan bobot", hideOnMobile: true, cell: (r) => r.weight_range ?? "—" },
            {
              label: "Harga hewan",
              className: "text-right tabular-nums",
              cell: (r) => (r.final ? formatRupiah(r.final.animal_cost) : "—"),
            },
            {
              label: "Operasional",
              className: "text-right tabular-nums",
              hideOnMobile: true,
              cell: (r) => (r.final ? formatRupiah(r.final.operational_cost) : "—"),
            },
            {
              label: "Status harga",
              cell: (r) =>
                r.final ? (
                  <Tag tone="success">Aktif</Tag>
                ) : r.latest ? (
                  <Tag tone="muted">Draf</Tag>
                ) : (
                  <Tag>Belum ada</Tag>
                ),
            },
            {
              label: "Ketersediaan",
              cell: (r) =>
                r.final && r.is_available ? (
                  <Tag tone="success">Dapat dipilih</Tag>
                ) : (
                  <Tag tone="danger">Tidak dapat dipilih</Tag>
                ),
            },
            {
              label: "Aksi",
              cell: (r) => (
                <RowActions
                  label={`Aksi untuk ${r.name}`}
                  items={[
                    can("catalog.manage") && {
                      label: "Ubah kategori",
                      onSelect: () => setEditing(r),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Peserta hanya dapat memilih kategori yang tersedia dan memiliki harga aktif.
      </p>
    </div>
  );
}

function CategoryForm({
  program,
  cat,
  onClose,
  onSaved,
}: {
  program: string;
  cat: Cat | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: cat?.name ?? "",
    code: cat?.code ?? "",
    kind: cat?.kind ?? "sapi",
    weight_range: cat?.weight_range ?? "",
    description: cat?.description ?? "",
    is_available: cat?.is_available ?? true,
    sort_order: String(cat?.sort_order ?? 10),
  });
  const [err, setErr] = useState<Partial<Record<keyof typeof f, string>>>({});
  const validate = () => {
    const e: Partial<Record<keyof typeof f, string>> = {};
    if (f.name.trim().length < 3) e.name = "Nama minimal 3 karakter";
    if (!cat && !/^[a-z0-9-]{3,40}$/.test(f.code))
      e.code = "Kode 3–40 huruf kecil, angka, atau tanda -";
    setErr(e);
    return !Object.keys(e).length;
  };
  return (
    <Panel title={cat ? `Ubah ${cat.name}` : "Kategori baru"} className="mb-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama kategori" htmlFor="k-name" error={err.name}>
          <Input placeholder="Contoh: Sapi Premium"
            id="k-name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        {!cat && (
          <Field label="Kode" htmlFor="k-code" error={err.code} hint="contoh: sapi-premium">
            <Input placeholder="Contoh: sapi-premium"
              id="k-code"
              value={f.code}
              onChange={(e) => setF({ ...f, code: e.target.value })}
            />
          </Field>
        )}
        {!cat && (
          <Field label="Jenis hewan" htmlFor="k-kind">
            <select
              id="k-kind"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={f.kind}
              onChange={(e) => setF({ ...f, kind: e.target.value as "sapi" | "kambing" })}
            >
              <option value="sapi">Sapi (7 bagian)</option>
              <option value="kambing">Kambing (1 ekor)</option>
            </select>
          </Field>
        )}
        <Field label="Perkiraan bobot" htmlFor="k-w">
          <Input
            id="k-w"
            value={f.weight_range}
            onChange={(e) => setF({ ...f, weight_range: e.target.value })}
            placeholder="± 250–300 kg"
          />
        </Field>
        <Field label="Urutan tampil" htmlFor="k-o">
          <Input placeholder="Contoh: 1"
            id="k-o"
            type="number"
            value={f.sort_order}
            onChange={(e) => setF({ ...f, sort_order: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-2 pt-5">
          <Switch
            id="k-av"
            checked={f.is_available}
            onCheckedChange={(v) => setF({ ...f, is_available: v })}
          />
          <label htmlFor="k-av" className="text-sm">
            Tersedia untuk komitmen baru
          </label>
        </div>
        <div className="sm:col-span-2">
          <Field label="Deskripsi" htmlFor="k-d">
            <Textarea placeholder="Jelaskan keunggulan hewan ini"
              id="k-d"
              rows={2}
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Batal
        </Button>
        <ConfirmAction
          title="Simpan kategori?"
          description="Perubahan tercatat di Log Aktivitas. Harga diatur di halaman Harga & Riwayat."
          confirmLabel="Simpan"
          onConfirm={async () => {
            await rpc("admin_save_category", {
              p_id: cat?.id ?? null,
              p: { ...f, program_id: program, sort_order: Number(f.sort_order) },
            });
            toast.success("Kategori tersimpan");
            onSaved();
            onClose();
          }}
          trigger={(o) => (
            <Button size="sm" onClick={() => validate() && o()}>
              Simpan
            </Button>
          )}
        />
      </div>
    </Panel>
  );
}
