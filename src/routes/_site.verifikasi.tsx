import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Section, Notice } from "@/components/site/primitives";
import { seo } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { SANDBOX_RECEIPT_MARK } from "@/lib/payments";
import { formatDate, formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_site/verifikasi")({
  head: () =>
    seo(
      "Verifikasi Dokumen",
      "Periksa keaslian sertifikat dan dokumen kurban yang diterbitkan qurbanity.",
    ),
  validateSearch: (s: Record<string, unknown>) => ({
    kode: typeof s["kode"] === "string" ? s["kode"] : undefined,
  }),
  component: Page,
});

const CODE_RE = /^QBN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

interface Found {
  receipt_number: string;
  amount: number;
  paid_at: string;
  commitment_code: string;
  category: string;
  environment: string;
  issuer: { name?: string; legal_entity?: string } | null;
}

function Page() {
  const { kode } = Route.useSearch();
  const [code, setCode] = useState(kode ?? "");
  const [state, setState] = useState<
    "idle" | "invalid" | "loading" | "found" | "notfound" | "error"
  >("idle");
  const [found, setFound] = useState<Found | null>(null);

  const check = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!CODE_RE.test(c)) return setState("invalid");
    setState("loading");
    const r = await supabase.rpc(
      "verify_payment_receipt" as never,
      { p_verification_code: c } as never,
    );
    if (r.error) return setState("error");
    setFound((r.data as unknown as Found | null) ?? null);
    setState(r.data ? "found" : "notfound");
  };

  useEffect(() => {
    if (kode) void check(kode);
  }, [kode]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void check(code);
  };

  return (
    <>
      <PageHeader
        eyebrow="Verifikasi"
        title="Periksa keaslian dokumen"
        intro="Masukkan kode verifikasi yang tertera pada sertifikat atau laporan kurbanmu."
      />
      <Section>
        <div className="mx-auto max-w-xl">
          <form
            onSubmit={submit}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft md:p-7"
            noValidate
          >
            <Label htmlFor="code" className="text-base font-bold">
              Kode verifikasi
            </Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setState("idle");
                }}
                placeholder="QBN-XXXX-XXXX"
                className="h-12 text-base uppercase"
                aria-describedby="code-help"
                aria-invalid={state === "invalid"}
                autoComplete="off"
              />
              <Button type="submit" size="lg" disabled={!code.trim()}>
                <Search /> Periksa
              </Button>
            </div>
            <p id="code-help" className="mt-2 text-sm text-muted-foreground">
              Format: QBN-XXXX-XXXX
            </p>
            {state === "invalid" && (
              <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                Format kode tidak sesuai. Periksa kembali kode pada dokumenmu.
              </p>
            )}
            {state === "loading" && (
              <p role="status" className="mt-4 text-sm">
                Memeriksa dokumen…
              </p>
            )}
            {state === "error" && (
              <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
                Pemeriksaan belum dapat dilakukan. Coba lagi nanti.
              </p>
            )}
            {state === "notfound" && (
              <div role="status" className="mt-4 flex gap-3 rounded-xl bg-muted p-4 text-sm">
                <ShieldQuestion className="size-5 shrink-0 text-primary" />
                <p>Kode tidak ditemukan pada dokumen yang diterbitkan.</p>
              </div>
            )}
            {state === "found" && found && (
              <div
                role="status"
                className="mt-4 rounded-xl border border-success/40 bg-success/10 p-4 text-sm"
              >
                <p className="font-bold text-success">
                  Dokumen terverifikasi — kuitansi pembayaran asli
                </p>
                <dl className="mt-2 space-y-1">
                  <div>
                    Nomor: <b>{found.receipt_number}</b>
                  </div>
                  <div>
                    Kode kurban: <b>{found.commitment_code}</b> · {found.category}
                  </div>
                  <div>
                    Jumlah: <b>{formatRupiah(found.amount)}</b>
                  </div>
                  <div>
                    Tanggal: <b>{formatDate(new Date(found.paid_at), { dateStyle: "long" })}</b>
                  </div>
                  <div>
                    Penerbit:{" "}
                    <b>{found.issuer?.legal_entity ?? found.issuer?.name ?? "Manfaat Mengalir"}</b>
                  </div>
                </dl>
                {found.environment === "sandbox" && (
                  <p className="mt-3 font-extrabold text-destructive">{SANDBOX_RECEIPT_MARK}</p>
                )}
              </div>
            )}
          </form>
          <Notice kind="info" className="mt-6">
            Hasil verifikasi tidak menampilkan data pribadi peserta.
          </Notice>
        </div>
      </Section>
    </>
  );
}
