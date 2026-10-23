import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PageHead,
  Panel,
  Guard,
  Loading,
  Failure,
  ProgramFilter,
  Tag,
  Field,
  ConfirmAction,
  Empty,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rpc, useAdmin } from "@/lib/admin";
import { quote } from "@/lib/pricing";
import { formatRupiah, formatDate } from "@/lib/format";
import { useCatalog, useDefaultProgram } from "@/lib/admin-hooks";

export const Route = createFileRoute("/_authenticated/admin/harga")({
  head: () => ({
    meta: [{ title: "Harga & Riwayat | Admin qurbanity" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <Guard perms="catalog.view">
      <Page />
    </Guard>
  ),
});

function Page() {
  const { can } = useAdmin();
  const [program, setProgram] = useDefaultProgram();
  const q = useCatalog(program);
  const qc = useQueryClient();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHead
        to="/admin/harga"
        actions={<ProgramFilter value={program} onChange={setProgram} allowAll={false} />}
      >
        <p className="mt-1 text-xs text-muted-foreground">
          Harga baru berlaku untuk komitmen berikutnya; harga saat akad tetap untuk komitmen yang
          sudah dibuat.
        </p>
      </PageHead>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <Failure error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {q.data.map((c) => (
            <Panel
              key={c.id}
              title={c.name}
              action={
                c.final ? (
                  <Tag tone="success">Harga aktif</Tag>
                ) : (
                  <Tag tone="warning">Belum ada harga aktif</Tag>
                )
              }
            >
              {c.final &&
                (() => {
                  const one = quote(c.final.animal_cost, c.final.operational_cost, 1, c.max_shares);
                  return (
                    <p className="mb-2 text-sm">
                      Per {c.kind === "sapi" ? "bagian" : "ekor"}:{" "}
                      <b className="tabular-nums">{formatRupiah(one.total)}</b>{" "}
                      <span className="text-xs text-muted-foreground">
                        (hewan {formatRupiah(one.animal)} + operasional{" "}
                        {formatRupiah(one.operational)}
                        {one.rounding ? `, termasuk pembulatan ${formatRupiah(one.rounding)}` : ""})
                      </span>
                    </p>
                  );
                })()}
              {can("catalog.manage") && (
                <PriceForm
                  categoryId={c.id}
                  defaults={c.latest}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "catalog"] })}
                />
              )}
              <p className="mb-1 mt-3 text-xs font-bold text-muted-foreground">Riwayat harga</p>
              {c.prices.length === 0 ? (
                <Empty title="Belum ada riwayat" />
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {c.prices.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="tabular-nums">
                        {formatRupiah(p.animal_cost)} + {formatRupiah(p.operational_cost)}
                      </span>
                      {p.is_final ? <Tag tone="success">Aktif</Tag> : <Tag tone="muted">Draf</Tag>}
                      {c.final?.id === p.id && <Tag tone="primary">Berlaku</Tag>}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDate(new Date(p.created_at), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      {p.note && (
                        <span className="w-full text-xs text-muted-foreground">{p.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceForm({
  categoryId,
  defaults,
  onSaved,
}: {
  categoryId: string;
  defaults: { animal_cost: number; operational_cost: number } | null;
  onSaved: () => void;
}) {
  const [animal, setAnimal] = useState(defaults ? String(defaults.animal_cost) : "");
  const [ops, setOps] = useState(defaults ? String(defaults.operational_cost) : "");
  const [err, setErr] = useState<string | null>(null);
  const valid = () => {
    if (!/^\d+$/.test(animal) || Number(animal) <= 0)
      return "Harga hewan harus bilangan bulat rupiah lebih dari 0";
    if (!/^\d+$/.test(ops)) return "Biaya operasional harus bilangan bulat rupiah";
    return null;
  };
  const submit = (final: boolean) => async (note: string) => {
    await rpc("admin_add_price", {
      p_category_id: categoryId,
      p_animal_cost: Number(animal),
      p_operational_cost: Number(ops),
      p_is_final: final,
      p_note: note,
    });
    toast.success(final ? "Harga final diaktifkan untuk komitmen baru" : "Draf harga tersimpan");
    onSaved();
  };
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Harga hewan (Rp, utuh)" htmlFor={`a-${categoryId}`}>
          <Input placeholder="Contoh: 25000000"
            id={`a-${categoryId}`}
            inputMode="numeric"
            value={animal}
            onChange={(e) => setAnimal(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Biaya operasional (Rp, utuh)" htmlFor={`o-${categoryId}`}>
          <Input placeholder="Contoh: 500000"
            id={`o-${categoryId}`}
            inputMode="numeric"
            value={ops}
            onChange={(e) => setOps(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
      {err && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {err}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <ConfirmAction
          title="Simpan harga sebagai draf?"
          description="Harga draf belum digunakan untuk komitmen."
          minReason={5}
          confirmLabel="Simpan draf"
          onConfirm={submit(false)}
          trigger={(o) => (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const e = valid();
                setErr(e);
                if (!e) o();
              }}
            >
              Simpan draf
            </Button>
          )}
        />
        <ConfirmAction
          title="Aktifkan harga ini?"
          description={
            <p>
              Harga berlaku untuk <b>komitmen baru</b>. Komitmen yang sudah dibuat tetap memakai
              harga saat akad.
            </p>
          }
          minReason={5}
          confirmLabel="Aktifkan harga"
          onConfirm={submit(true)}
          trigger={(o) => (
            <Button
              size="sm"
              onClick={() => {
                const e = valid();
                setErr(e);
                if (!e) o();
              }}
            >
              Aktifkan harga
            </Button>
          )}
        />
      </div>
    </div>
  );
}
