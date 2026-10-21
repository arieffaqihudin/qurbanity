import { Link } from "@tanstack/react-router";
import { Scale, ArrowRight } from "lucide-react";
import { type AnimalCategory, isAvailable, pricePerShare } from "@/lib/pricing";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CategoryCard({ c, featured }: { c: AnimalCategory; featured?: boolean }) {
  const avail = isAvailable(c);
  return (
    <article className={cn("group flex flex-col rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift", featured ? "border-gold ring-2 ring-gold/40" : "border-border")}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <h3 className="text-lg font-extrabold text-burgundy-dark">{c.name}</h3>
        {featured && <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-foreground">Populer</span>}
        {!avail && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">Segera</span>}
      </div>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Scale className="size-4" /> {c.weightRange}</p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{c.description}</p>
      <div className="mt-5 border-t border-border pt-4">
        {avail ? (
          <>
            <p className="text-2xl font-extrabold tabular-nums text-primary">{formatRupiah(pricePerShare(c)!)}</p>
            <p className="text-xs text-muted-foreground">per {c.kind === "sapi" ? "bagian (1/7)" : "ekor"} · contoh harga</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold text-muted-foreground">Harga belum ditetapkan</p>
            <p className="text-xs text-muted-foreground">Belum dapat dipilih</p>
          </>
        )}
      </div>
      {avail && (
        <Link to="/simulasi" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-2 transition-all">
          Simulasikan <ArrowRight className="size-4" />
        </Link>
      )}
    </article>
  );
}
