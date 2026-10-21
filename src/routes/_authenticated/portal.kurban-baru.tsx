import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2, Minus, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/portal/StatusUI";
import { FieldError, FormAlert } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, contractsQuery, FREQ_LABEL, FREQ_UNIT, profileQuery, programQuery, type Frequency, type PublicationPref } from "@/lib/portal-data";
import { countPeriods, sharePrice } from "@/lib/pricing";
import { shahibulSchema } from "@/lib/validation";
import { formatDate, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/portal/kurban-baru")({
  head: () => ({ meta: [{ title: "Komitmen Baru | Portal Peserta qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: Wizard,
});

const STEPS = ["Pilih Hewan", "Detail Kurban", "Rincian Harga", "Baca Akad", "Persetujuan", "Konfirmasi"];
const PUB_OPTS: { v: PublicationPref; label: string; desc: string }[] = [
  { v: "full", label: "Nama lengkap", desc: "Contoh: Ahmad Fauzi" },
  { v: "masked", label: "Disamarkan", desc: "Contoh: A***d F***i" },
  { v: "private", label: "Tidak dipublikasikan", desc: "Nama tidak tampil di laporan publik" },
];

function Wizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const program = useQuery(programQuery);
  const pid = program.data?.id ?? "";
  const cats = useQuery({ ...categoriesQuery(pid), enabled: !!pid });
  const contracts = useQuery({ ...contractsQuery(pid), enabled: !!pid });
  const profile = useQuery(profileQuery);

  const [step, setStep] = useState(0);
  const [catId, setCatId] = useState<string | null>(null);
  const [shares, setShares] = useState(1);
  const [names, setNames] = useState<string[]>([""]);
  const [freq, setFreq] = useState<Frequency>("bulanan");
  const [read, setRead] = useState<Record<string, boolean>>({});
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "declined" | undefined>>({});
  const [pub, setPub] = useState<PublicationPref | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const cat = cats.data?.find((c) => c.id === catId);
  const isFinal = (c: NonNullable<typeof cats.data>[number]) => !!c.price?.is_final;

  const pricing = useMemo(() => {
    if (!cat?.price || !program.data) return null;
    const full = cat.price.animal_cost + cat.price.operational_cost;
    const pps = sharePrice(full, cat.max_shares);
    const total = pps * shares;
    const animal = Math.round((cat.price.animal_cost * shares) / cat.max_shares);
    const ops = Math.round((cat.price.operational_cost * shares) / cat.max_shares);
    const periods = countPeriods(freq === "fleksibel" ? "bulanan" : freq, new Date(), new Date(program.data.payment_deadline));
    return { full, pps, total, animal, ops, rounding: total - animal - ops, periods, suggested: periods > 0 ? Math.ceil(total / periods / 1000) * 1000 : total };
  }, [cat, shares, freq, program.data]);

  if (program.isPending || cats.isPending || contracts.isPending) return <LoadingState />;
  if (program.isError || cats.isError || contracts.isError) return <ErrorState message="Data program tidak dapat dimuat." onRetry={() => { program.refetch(); cats.refetch(); contracts.refetch(); }} />;
  const prog = program.data;
  if (!prog || prog.status !== "open") return <EmptyState title="Program belum dibuka" text="Saat ini belum ada program kurban yang menerima komitmen baru." />;
  if (new Date() >= new Date(prog.payment_deadline)) return <EmptyState title="Pendaftaran ditutup" text="Batas pelunasan program telah lewat sehingga komitmen baru tidak dapat dibuat." />;

  const akads = contracts.data ?? [];
  const setShareCount = (n: number) => {
    setShares(n);
    setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] || (i === 0 ? profile.data?.full_name ?? "" : "")));
  };

  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0 && (!cat || !isFinal(cat))) e["cat"] = "Pilih kategori hewan yang sudah memiliki harga final.";
    if (s === 1) {
      if (!cat) e["cat"] = "Pilih kategori hewan terlebih dahulu.";
      else if (shares < 1 || shares > cat.max_shares) e["shares"] = "Jumlah bagian tidak valid.";
      names.forEach((n, i) => { const r = shahibulSchema.safeParse(n); if (!r.success) e[`name${i}`] = r.error.issues[0]!.message; });
    }
    if (s === 3) akads.forEach((a) => { if (!read[a.id]) e[`read${a.id}`] = "Tandai bahwa kamu sudah membaca akad ini."; });
    if (s === 4) {
      akads.forEach((a) => {
        const d = decisions[a.id];
        if (!d) e[`dec${a.id}`] = "Pilih keputusanmu.";
        else if (a.is_mandatory && d !== "accepted") e[`dec${a.id}`] = "Akad ini wajib disetujui untuk melanjutkan.";
      });
      if (!pub) e["pub"] = "Pilih preferensi publikasi nama.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const back = () => { setErrors({}); setStep(step - 1); };

  const save = async () => {
    if (!cat || !pub) return;
    setSaving(true);
    setSaveError(null);
    const consents = Object.fromEntries(akads.map((a) => [a.id, decisions[a.id]]));
    const { data, error } = await supabase.rpc("create_commitment", {
      p_category_id: cat.id, p_shares: shares, p_shahibul: names.map((n) => n.trim()), p_frequency: freq,
      p_consents: consents, p_publication: pub, p_user_agent: navigator.userAgent,
    });
    setSaving(false);
    if (error || !data?.[0]) { setConfirmOpen(false); { setSaveError(error?.message ?? "Komitmen gagal disimpan."); return; } }
    await qc.invalidateQueries({ queryKey: ["commitments"] });
    navigate({ to: "/portal/kurban-saya/$id", params: { id: data[0].id } });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/portal/kurban-saya" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> Kurban Saya</Link>
      <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">Komitmen kurban baru</h1>
      <p className="text-muted-foreground">{prog.name} · batas pelunasan {formatDate(new Date(prog.payment_deadline))}</p>

      <ol className="my-6 grid grid-cols-6 gap-1.5" aria-label="Langkah">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <p className={cn("mt-1.5 hidden text-xs font-semibold sm:block", i === step ? "text-primary" : "text-muted-foreground")}>{s}</p>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-bold text-primary sm:hidden">Langkah {step + 1} dari 6 · {STEPS[step]}</p>

      {saveError && <div className="mb-4"><FormAlert kind="error">{saveError}</FormAlert></div>}

      {step === 0 && (
        <Card title="1. Pilih hewan">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Kategori hewan">
            {cats.data!.map((c) => {
              const ok = isFinal(c);
              const pps = c.price ? sharePrice(c.price.animal_cost + c.price.operational_cost, c.max_shares) : null;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={catId === c.id} disabled={!ok}
                  onClick={() => { setCatId(c.id); setShareCount(c.kind === "kambing" ? 1 : Math.min(shares, 7)); setErrors({}); }}
                  className={cn("rounded-xl border-2 p-4 text-left transition-all", catId === c.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40", !ok && "cursor-not-allowed opacity-55")}>
                  <p className="font-extrabold text-burgundy-dark">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.weight_range}</p>
                  <p className="mt-2 font-bold tabular-nums text-primary">{ok && pps ? `${formatRupiah(pps)} / ${c.kind === "sapi" ? "bagian" : "ekor"}` : "Harga final belum ditetapkan"}</p>
                </button>
              );
            })}
          </div>
          <FieldError id="cat-err" msg={errors["cat"]} />
          <p className="mt-4 text-xs text-muted-foreground">Harga saat ini merupakan contoh dan akan dikunci saat komitmen dibuat.</p>
        </Card>
      )}

      {step === 1 && cat && (
        <Card title="2. Detail kurban">
          {cat.kind === "sapi" ? (
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Jumlah bagian</legend>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="icon" aria-label="Kurangi bagian" disabled={shares <= 1} onClick={() => setShareCount(shares - 1)}><Minus /></Button>
                <output aria-live="polite" className="min-w-20 text-center text-2xl font-extrabold tabular-nums">{shares}<span className="text-base text-muted-foreground"> / 7</span></output>
                <Button type="button" variant="outline" size="icon" aria-label="Tambah bagian" disabled={shares >= 7} onClick={() => setShareCount(shares + 1)}><Plus /></Button>
                <Button type="button" variant={shares === 7 ? "default" : "secondary"} size="sm" onClick={() => setShareCount(7)}>1 ekor penuh (7 bagian)</Button>
              </div>
              <FieldError id="shares-err" msg={errors["shares"]} />
            </fieldset>
          ) : <p className="rounded-xl bg-muted p-3 text-sm">Kambing berlaku untuk 1 ekor atas nama 1 shahibul.</p>}

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-bold">Nama shahibul kurban</legend>
            <div className="space-y-3">
              {names.map((n, i) => (
                <div key={i}>
                  <Label htmlFor={`name${i}`} className="text-xs text-muted-foreground">Shahibul {i + 1}</Label>
                  <Input id={`name${i}`} value={n} className="mt-1 h-11" aria-invalid={!!errors[`name${i}`]} onChange={(e) => { const c = [...names]; c[i] = e.target.value; setNames(c); }} />
                  <FieldError id={`name${i}-err`} msg={errors[`name${i}`]} />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-bold">Rencana frekuensi setoran</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                <button key={f} type="button" aria-pressed={freq === f} onClick={() => setFreq(f)} className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", freq === f ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50")}>{FREQ_LABEL[f]}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Rencana ini hanya panduan. Nominal dan waktu setoran tetap fleksibel.</p>
          </fieldset>
        </Card>
      )}

      {step === 2 && cat && pricing && (
        <Card title="3. Rincian harga">
          <dl className="space-y-2 text-sm">
            <PRow k="Harga hewan" v={formatRupiah(pricing.animal)} />
            <PRow k="Biaya operasional" v={formatRupiah(pricing.ops)} />
            {pricing.rounding !== 0 && <PRow k="Pembulatan" v={formatRupiah(pricing.rounding)} />}
            <PRow k={`Harga per ${cat.kind === "sapi" ? "bagian" : "ekor"}`} v={`${formatRupiah(pricing.pps)} × ${shares}`} />
            <div className="flex justify-between border-t border-border pt-3 text-lg font-extrabold"><dt>Total komitmen</dt><dd className="tabular-nums text-primary">{formatRupiah(pricing.total)}</dd></div>
          </dl>
          <p className="mt-3 rounded-xl bg-muted p-3 text-xs text-muted-foreground">Harga per bagian = (harga hewan + operasional) ÷ {cat.max_shares}, dibulatkan ke atas ke Rp 1.000 terdekat. Selisih pembulatan ditampilkan terpisah. Nilai akhir dihitung ulang oleh sistem saat komitmen disimpan.</p>
          <div className="mt-5 rounded-xl border border-border p-4">
            <p className="text-sm font-bold">Estimasi rencana setoran {FREQ_LABEL[freq].toLowerCase()}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">{formatRupiah(pricing.suggested)} <span className="text-base font-semibold text-muted-foreground">/ {FREQ_UNIT[freq]}</span></p>
            <p className="text-sm text-muted-foreground">± {pricing.periods} kali hingga {formatDate(new Date(prog.payment_deadline))}{freq === "fleksibel" && " (estimasi bulanan sebagai acuan)"}</p>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card title="4. Baca akad">
          {akads.some((a) => a.status !== "approved") && (
            <div className="mb-4 flex gap-3 rounded-xl border border-burgundy/25 bg-burgundy/5 p-4 text-sm text-burgundy-dark">
              <ShieldAlert className="size-5 shrink-0" /><p><strong>Teks akad masih DRAF.</strong> Belum disetujui dewan syariah dan tim hukum. Persetujuanmu dicatat bersama versi draf ini.</p>
            </div>
          )}
          <div className="space-y-5">
            {akads.map((a) => (
              <article key={a.id} className="rounded-xl border border-border">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
                  <h3 className="font-extrabold text-burgundy-dark">{a.title}</h3>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", a.status === "approved" ? "bg-success/15 text-success" : "bg-burgundy/10 text-burgundy")}>{a.status === "approved" ? "Disetujui" : "Draf"} · v{a.version}</span>
                </header>
                <div tabIndex={0} className="max-h-56 overflow-y-auto whitespace-pre-line p-4 text-sm leading-relaxed" aria-label={`Isi ${a.title}`}>{a.body}</div>
                <div className="border-t border-border p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox id={`read${a.id}`} checked={!!read[a.id]} onCheckedChange={(c) => setRead({ ...read, [a.id]: c === true })} className="mt-0.5" />
                    <Label htmlFor={`read${a.id}`} className="text-sm font-normal">Saya sudah membaca {a.title.split(" — ")[0]}</Label>
                  </div>
                  <FieldError id={`read${a.id}-err`} msg={errors[`read${a.id}`]} />
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card title="5. Persetujuan">
          <div className="space-y-5">
            {akads.map((a) => (
              <fieldset key={a.id} className="rounded-xl border border-border p-4">
                <legend className="px-1 font-bold text-burgundy-dark">{a.title.split(" — ")[0]} {a.is_mandatory ? <span className="text-xs text-destructive">(wajib)</span> : <span className="text-xs text-muted-foreground">(opsional)</span>}</legend>
                <p className="mb-3 text-sm text-muted-foreground">{a.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {(["accepted", "declined"] as const).map((d) => (
                    <button key={d} type="button" aria-pressed={decisions[a.id] === d} onClick={() => setDecisions({ ...decisions, [a.id]: d })} className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", decisions[a.id] === d ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50")}>
                      {d === "accepted" ? "Saya setuju" : "Saya tidak setuju"}
                    </button>
                  ))}
                </div>
                <FieldError id={`dec${a.id}-err`} msg={errors[`dec${a.id}`]} />
              </fieldset>
            ))}
            <fieldset className="rounded-xl border border-border p-4">
              <legend className="px-1 font-bold text-burgundy-dark">Publikasi nama di laporan</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PUB_OPTS.map((o) => (
                  <button key={o.v} type="button" aria-pressed={pub === o.v} onClick={() => setPub(o.v)} className={cn("rounded-xl border-2 p-3 text-left", pub === o.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                    <p className="text-sm font-bold">{o.label}</p><p className="text-xs text-muted-foreground">{o.desc}</p>
                  </button>
                ))}
              </div>
              <FieldError id="pub-err" msg={errors["pub"]} />
            </fieldset>
          </div>
        </Card>
      )}

      {step === 5 && cat && pricing && (
        <Card title="6. Konfirmasi komitmen">
          <dl className="space-y-2 text-sm">
            <PRow k="Kategori" v={cat.name} />
            <PRow k="Jumlah" v={cat.kind === "sapi" ? (shares === 7 ? "1 ekor penuh (7 bagian)" : `${shares}/7 bagian`) : "1 ekor"} />
            <PRow k="Shahibul" v={names.join(", ")} />
            <PRow k="Rencana setoran" v={`${FREQ_LABEL[freq]} · ± ${formatRupiah(pricing.suggested)} / ${FREQ_UNIT[freq]}`} />
            {akads.map((a) => <PRow key={a.id} k={a.title.split(" — ")[0]!} v={decisions[a.id] === "accepted" ? "Disetujui" : "Tidak disetujui"} />)}
            <PRow k="Publikasi nama" v={PUB_OPTS.find((o) => o.v === pub)?.label ?? "-"} />
            <div className="flex justify-between border-t border-border pt-3 text-lg font-extrabold"><dt>Total komitmen</dt><dd className="tabular-nums text-primary">{formatRupiah(pricing.total)}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">Setelah disimpan, harga dan isi akad terkunci dan tidak dapat diubah.</p>
        </Card>
      )}

      <div className="mt-6 flex justify-between gap-3">
        {step > 0 ? <Button variant="outline" onClick={back}><ArrowLeft /> Kembali</Button> : <span />}
        {step < 5 ? <Button onClick={next}>Lanjut <ArrowRight /></Button> : <Button onClick={() => setConfirmOpen(true)}><Check /> Buat komitmen</Button>}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunci komitmen kurban?</AlertDialogTitle>
            <AlertDialogDescription>Total {pricing && formatRupiah(pricing.total)} akan dikunci beserta persetujuan akadmu. Data ini tidak dapat diubah setelah disimpan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Periksa lagi</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void save(); }} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Ya, kunci komitmen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PRow({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>;
}
