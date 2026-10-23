/**
 * Animal head icons for kurban categories. Hand-drawn in the lucide stroke
 * style (currentColor, round caps) so they sit naturally beside lucide icons.
 */
type IconProps = { className?: string; "aria-hidden"?: boolean };

export function CowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* horns */}
      <path d="M5.2 3.8C3.7 4.7 3 6.2 3 8" />
      <path d="M18.8 3.8c1.5.9 2.2 2.4 2.2 4.2" />
      {/* ears */}
      <path d="M4.3 10.8c-1.2.1-2.3-.7-2.3-1.9 0-.9.8-1.5 1.7-1.3" />
      <path d="M19.7 10.8c1.2.1 2.3-.7 2.3-1.9 0-.9-.8-1.5-1.7-1.3" />
      {/* head */}
      <path d="M7.6 6.8h8.8c1.5 1.6 2.1 3.7 2.1 5.7 0 4.2-2.6 7.5-6.5 7.5s-6.5-3.3-6.5-7.5c0-2 .6-4.1 2.1-5.7Z" />
      {/* muzzle */}
      <path d="M9.2 15.8h5.6" />
      {/* eyes */}
      <circle cx="9.6" cy="11.4" r=".45" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="11.4" r=".45" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GoatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* horns curving back */}
      <path d="M9.4 3.6C7.6 4.1 6.4 5.9 6.3 8" />
      <path d="M14.6 3.6c1.8.5 3 2.3 3.1 4.4" />
      {/* droopy ears */}
      <path d="M7 9.6c-1.3-.4-2.8.2-3.2 1.6-.3 1 .5 1.9 1.5 1.7" />
      <path d="M17 9.6c1.3-.4 2.8.2 3.2 1.6.3 1-.5 1.9-1.5 1.7" />
      {/* head (slimmer) */}
      <path d="M9.2 6.4h5.6c1.3 1.4 2 3.3 2 5.3 0 3.9-2.1 7-4.8 7s-4.8-3.1-4.8-7c0-2 .7-3.9 2-5.3Z" />
      {/* beard */}
      <path d="M12 18.7c0 1-.3 2-1 2.8" />
      <path d="M12 18.7c0 1 .3 2 1 2.8" />
      {/* eyes */}
      <circle cx="9.8" cy="11.2" r=".45" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="11.2" r=".45" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AnimalIcon({ kind, className }: { kind: "sapi" | "kambing"; className?: string }) {
  return kind === "sapi" ? <CowIcon className={className} /> : <GoatIcon className={className} />;
}
