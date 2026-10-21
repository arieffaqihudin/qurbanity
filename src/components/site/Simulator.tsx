import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORIES, FREQUENCY_LABEL, FREQUENCY_UNIT, PAYMENT_DEADLINE, isAvailable, pricePerShare, simulate,
  type CategoryId, type Frequency,
} from "@/lib/pricing";
import { formatDate, formatRupiah, formatNumber } from "@/lib/format";
import { Notice } from "./primitives";

export function Simulator({ compact }: { compact?: boolean }) {
  const [catId, setCatId] = useState<CategoryId>("sapi-reguler");
  const [shares, setShares] = useState(1);
  const [freq, setFreq] = useState<Frequency>("mingguan");
  const cat = CATEGORIES.find((c) => c.id === catId)!;
  const result = useMemo(() => simulate(cat, shares, freq), [cat, shares, freq]);

  const pickCat = (id: CategoryId) => {
    setCatId(id);
    const c = CATEGORIES.find((x) => x.id === id)!;
    setShares((s) => Math.min(s, c.maxShares));
  };

  return (
    <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-soft lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-6 p-5 md:p-8">
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-burgundy-dark">1. Pilih kategori hewan</legend>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => {
              const avail = isAvailable(c);
              const active = c.id === catId;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!avail}
                  aria-pressed={active}
                  onClick={() => pickCat(c.id)}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-all",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    !avail && "cursor-not-allowed opacity-60",
                  )}
                >
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {avail ? `${formatRupiah(pricePerShare(c)!)} / ${c.kind === "sapi" ? "bagian" : "ekor"}` : "Harga belum ditetapkan"}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-bold text-burgundy-dark">2. Jumlah bagian</legend>
          {cat.kind === "kambing" ? (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Kambing berlaku untuk 1 ekor atas nama 1 shahibul.</p>
          ) : (
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" aria-label="Kurangi bagian" disabled={shares <= 1} onClick={() => setShares(shares - 1)}><Minus /></Button>
              <output className="min-w-24 text-center text-2xl font-extrabold tabular-nums" aria-live="polite">{shares}<span className="text-base font-semibold text-muted-foreground"> / 7</span></output>
              <Button type="button" variant="outline" size="icon" aria-label="Tambah bagian" disabled={shares >= cat.maxShares} onClick={() => setShares(shares + 1)}><Plus /></Button>
              {shares === 7 && <span className="text-sm font-semibold text-success">1 ekor penuh</span>}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-bold text-burgundy-dark">3. Frekuensi pembayaran</legend>
          <div role="radiogroup" className="inline-flex rounded-full bg-muted p-1">
            {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={freq === f}
                onClick={() => setFreq(f)}
                className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-all", freq === f ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground")}
              >
                {FREQUENCY_LABEL[f]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="relative flex flex-col justify-between gap-6 bg-burgundy-gradient p-5 text-ivory md:p-8">
        <div className="pattern-dots absolute inset-0 opacity-30" aria-hidden />
        <div className="relative" aria-live="polite">
          <p className="text-sm font-semibold text-gold">Estimasi cicilan {FREQUENCY_LABEL[freq].toLowerCase()}</p>
          {result ? (
            <>
              <p className="mt-1 text-4xl font-extrabold tabular-nums md:text-5xl">{formatRupiah(result.perPeriod)}</p>
              <p className="mt-1 text-sm text-cream/80">selama ± {formatNumber(result.periods)} {FREQUENCY_UNIT[freq]}</p>
              <dl className="mt-6 space-y-3 border-t border-ivory/15 pt-5 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-cream/75">Total harga terkunci</dt><dd className="font-bold tabular-nums">{formatRupiah(result.total)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-cream/75">Batas pelunasan</dt><dd className="font-bold">{formatDate(PAYMENT_DEADLINE)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="flex items-center gap-1.5 text-cream/75"><CalendarClock className="size-4" />Sisa waktu</dt><dd className="font-bold tabular-nums">{formatNumber(result.daysLeft)} hari</dd></div>
              </dl>
            </>
          ) : (
            <p className="mt-2 text-lg">Kategori ini belum tersedia karena harga final belum ditetapkan.</p>
          )}
        </div>
        <div className="relative space-y-3">
          <Button variant="gold" size="lg" className="w-full" asChild>
            <Link to="/portal">Mulai Komitmen <ArrowRight /></Link>
          </Button>
          <p className="text-xs text-cream/70">Nominal setoran tetap fleksibel. Estimasi ini hanya panduan.</p>
        </div>
      </div>
      {!compact && (
        <div className="lg:col-span-2 border-t border-border p-4 md:px-8">
          <Notice kind="sample">Harga mengikuti contoh PRD dan belum final. Harga resmi dikunci saat akad dibuat.</Notice>
        </div>
      )}
    </div>
  );
}
