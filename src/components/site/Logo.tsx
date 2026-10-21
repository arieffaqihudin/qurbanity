import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)} aria-label="QURBANITY beranda">
      <span className="grid size-9 place-items-center rounded-xl bg-burgundy-gradient text-rose shadow-soft transition-transform group-hover:rotate-6">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Z" />
          <path d="M12 21v-5" />
        </svg>
      </span>
      <span className="leading-none">
        <span className={cn("block text-lg font-extrabold tracking-tight", light ? "text-ivory" : "text-burgundy-dark")}>QURBANITY</span>
        <span className={cn("block text-[11px] font-semibold", light ? "text-rose" : "text-muted-foreground")}>by Manfaat Mengalir</span>
      </span>
    </Link>
  );
}
