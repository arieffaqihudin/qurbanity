import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Section, Notice } from "@/components/site/primitives";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/verifikasi")({
  head: () => seo("Verifikasi Dokumen", "Periksa keaslian sertifikat dan dokumen kurban yang diterbitkan qurbanity."),
  component: Page,
});

const CODE_RE = /^QBN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function Page() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "invalid" | "pending">("idle");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    setState(CODE_RE.test(c) ? "pending" : "invalid");
  };

  return (
    <>
      <PageHeader eyebrow="Verifikasi" title="Periksa keaslian dokumen" intro="Masukkan kode verifikasi yang tertera pada sertifikat atau laporan kurban kamu." />
      <Section>
        <div className="mx-auto max-w-xl">
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-soft md:p-7" noValidate>
            <Label htmlFor="code" className="text-base font-bold">Kode verifikasi</Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input id="code" value={code} onChange={(e) => { setCode(e.target.value); setState("idle"); }} placeholder="QBN-XXXX-XXXX" className="h-12 text-base uppercase" aria-describedby="code-help" aria-invalid={state === "invalid"} autoComplete="off" />
              <Button type="submit" size="lg" disabled={!code.trim()}><Search /> Periksa</Button>
            </div>
            <p id="code-help" className="mt-2 text-sm text-muted-foreground">Format: QBN-XXXX-XXXX</p>
            {state === "invalid" && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">Format kode tidak sesuai. Periksa kembali kode pada dokumen kamu.</p>}
            {state === "pending" && (
              <div role="status" className="mt-4 flex gap-3 rounded-xl bg-muted p-4 text-sm">
                <ShieldQuestion className="size-5 shrink-0 text-primary" />
                <p>Format kode valid. Layanan pencocokan dokumen belum aktif, sehingga keaslian belum dapat dipastikan saat ini.</p>
              </div>
            )}
          </form>
          <Notice kind="info" className="mt-6">Layanan verifikasi akan terhubung ke basis data dokumen resmi pada tahap berikutnya.</Notice>
        </div>
      </Section>
    </>
  );
}
