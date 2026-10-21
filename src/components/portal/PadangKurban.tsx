import { useParallax } from "@/components/site/motion";

/**
 * Symbolic farm scene. Purely visual: driven by verified progress (0–100),
 * never writes data and never implies the animal has been slaughtered.
 */
export function PadangKurban({ kind, pct, name, code }: { kind: "sapi" | "kambing"; pct: number; name: string; code: string }) {
  const grass = Math.round(6 + (pct / 100) * 18); // tufts grow with progress
  const flowers = Math.floor(pct / 20);
  const msg =
    pct >= 100 ? "Alhamdulillah, pembayaran lunas. Pelaksanaan kurban tetap mengikuti jadwal Iduladha."
    : pct >= 50 ? "Lebih dari separuh jalan. Terus konsisten, ya!"
    : pct > 0 ? "Langkah kecil yang konsisten akan sampai."
    : "Padangmu siap. Mulai setoran pertama untuk menumbuhkan rumputnya.";

  // Layered depth: far layers drift with the page, near layers against it. Visual only.
  const clouds = useParallax<SVGGElement>(0.05);
  const far = useParallax<SVGGElement>(0.025);
  const near = useParallax<SVGGElement>(-0.03);
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[16/9] w-full">
        <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" role="img" aria-label={`Ilustrasi padang kurban: ${kind === "sapi" ? "sapi" : "kambing"} ${name}, progres simbolis ${pct}%`}>
          <defs>
            <linearGradient id="pk-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--color-ivory)" /><stop offset="1" stopColor="var(--color-cream)" /></linearGradient>
          </defs>
          <rect width="320" height="180" fill="url(#pk-sky)" />
          <circle cx="262" cy="38" r="16" fill="var(--color-rose)" opacity="0.55" className="pk-sun" />
          <g ref={clouds} opacity="0.9">
            <g className="pk-cloud"><ellipse cx="70" cy="34" rx="22" ry="7" fill="var(--color-ivory)" /><ellipse cx="84" cy="29" rx="13" ry="7" fill="var(--color-ivory)" /></g>
            <g className="pk-cloud pk-cloud-2"><ellipse cx="190" cy="22" rx="18" ry="5" fill="var(--color-ivory)" /><ellipse cx="200" cy="18" rx="10" ry="5" fill="var(--color-ivory)" /></g>
          </g>
          <g ref={far}><path d="M0 110 Q60 80 120 100 T240 92 T320 98 V200 H0Z" fill="var(--color-beige)" opacity="0.7" /></g>
          <path d="M0 128 Q80 110 160 124 T320 120 V180 H0Z" fill="oklch(0.7 0.09 135)" />
          <g ref={near}><path d="M0 150 Q100 138 200 148 T320 146 V200 H0Z" fill="oklch(0.62 0.1 140)" />
          </g>
          {/* fence */}
          {Array.from({ length: 9 }).map((_, i) => <rect key={i} x={14 + i * 36} y="112" width="3" height="18" rx="1" fill="var(--color-burgundy-dark)" opacity="0.35" />)}
          <rect x="10" y="117" width="300" height="2" fill="var(--color-burgundy-dark)" opacity="0.3" />
          {/* grass tufts */}
          {Array.from({ length: grass }).map((_, i) => {
            const x = (i * 53) % 310 + 5, y = 150 + ((i * 17) % 22);
            return <path key={i} d={`M${x} ${y} l3 -9 l2 9 l3 -7 l1 7`} stroke="oklch(0.48 0.11 140)" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
          })}
          {Array.from({ length: flowers }).map((_, i) => <circle key={i} cx={40 + i * 60} cy={160 + (i % 2) * 8} r="3" fill="var(--color-rose)" />)}
          {/* animal */}
          <g className="pk-animal" transform={kind === "sapi" ? "translate(118 92)" : "translate(132 104)"}>
            {kind === "sapi" ? <Cow /> : <Goat />}
          </g>
        </svg>
      </div>
      <figcaption className="flex flex-col gap-1 border-t border-border p-4">
        <p className="font-extrabold text-burgundy-dark">{name} <span className="font-semibold text-muted-foreground">· {code}</span></p>
        <p className="text-sm text-muted-foreground">{msg}</p>
        <p className="text-xs text-muted-foreground">Ilustrasi simbolis. Hewan sebenarnya ditetapkan saat alokasi (sekitar H-7).</p>
      </figcaption>
      <style>{`
        @keyframes pk-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        @keyframes pk-tail { 0%,100% { transform: rotate(0) } 50% { transform: rotate(14deg) } }
        @keyframes pk-drift { 0%,100% { transform: translateX(0) } 50% { transform: translateX(8px) } }
        .pk-cloud { animation: pk-drift 14s ease-in-out infinite; }
        .pk-cloud-2 { animation-duration: 19s; animation-direction: reverse; }
        @keyframes pk-glow { 0%,100% { opacity: .45 } 50% { opacity: .7 } }
        .pk-animal > g { animation: pk-bob 2.6s ease-in-out infinite; transform-box: fill-box; }
        .pk-tail { animation: pk-tail 1.4s ease-in-out infinite; transform-origin: 0 0; transform-box: fill-box; }
        .pk-sun { animation: pk-glow 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .pk-animal > g, .pk-tail, .pk-sun, .pk-cloud { animation: none } }
      `}</style>
    </figure>
  );
}

function Cow() {
  return (
    <g>
      <path className="pk-tail" d="M6 22 q-8 4 -6 16" stroke="var(--color-charcoal)" strokeWidth="2" fill="none" />
      <rect x="6" y="14" width="64" height="32" rx="14" fill="oklch(0.62 0.11 50)" />
      <ellipse cx="30" cy="26" rx="10" ry="7" fill="var(--color-ivory)" opacity="0.85" />
      {[12, 24, 52, 62].map((x) => <rect key={x} x={x} y="40" width="6" height="18" rx="2" fill="oklch(0.5 0.1 45)" />)}
      <rect x="62" y="6" width="26" height="22" rx="9" fill="oklch(0.62 0.11 50)" />
      <rect x="74" y="16" width="16" height="12" rx="6" fill="var(--color-cream)" />
      <circle cx="70" cy="13" r="2" fill="var(--color-charcoal)" />
      <path d="M64 6 q-4 -6 -1 -8 M84 6 q4 -6 1 -8" stroke="var(--color-cream)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Goat() {
  return (
    <g>
      <path className="pk-tail" d="M6 14 l-5 -6" stroke="var(--color-ivory)" strokeWidth="3" strokeLinecap="round" />
      <rect x="4" y="10" width="44" height="22" rx="10" fill="var(--color-ivory)" stroke="var(--color-beige)" />
      {[10, 18, 36, 42].map((x) => <rect key={x} x={x} y="28" width="4" height="16" rx="2" fill="var(--color-beige)" />)}
      <rect x="40" y="0" width="18" height="16" rx="7" fill="var(--color-ivory)" stroke="var(--color-beige)" />
      <circle cx="51" cy="6" r="1.6" fill="var(--color-charcoal)" />
      <path d="M44 1 q-2 -7 4 -8 M52 0 q1 -7 6 -6" stroke="var(--color-burgundy-dark)" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M54 15 l-2 6 l-2 -6" fill="var(--color-beige)" />
    </g>
  );
}

