import { Link } from "@tanstack/react-router";
import wordmark from "@/assets/qurbanity-wordmark.png";
import wordmarkIvory from "@/assets/qurbanity-wordmark-ivory.png";
import { cn } from "@/lib/utils";

/**
 * Official qurbanity wordmark (custom lettering — never retype it with a font).
 * Signature line set in Plus Jakarta Sans SemiBold, aligned under the "u".
 */
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("group inline-flex flex-col leading-none", className)} aria-label="qurbanity by Manfaat Mengalir — beranda">
      <img
        src={light ? wordmarkIvory : wordmark}
        alt=""
        width={1200}
        height={306}
        className="h-7 w-auto transition-transform duration-300 group-hover:-translate-y-0.5 md:h-8"
      />
      <span className={cn("mt-1 whitespace-nowrap pl-[19%] text-[10px] font-semibold tracking-wide md:text-[11px]", light ? "text-rose" : "text-muted-foreground")}>
        by Manfaat Mengalir
      </span>
    </Link>
  );
}
