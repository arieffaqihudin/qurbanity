import { useEffect, useState } from "react";
import { IDULADHA_DATE } from "@/lib/pricing";
import { formatDate } from "@/lib/format";

function diff(target: Date) {
  const ms = Math.max(0, target.getTime() - Date.now());
  return {
    Hari: Math.floor(ms / 86_400_000),
    Jam: Math.floor((ms / 3_600_000) % 24),
    Menit: Math.floor((ms / 60_000) % 60),
    Detik: Math.floor((ms / 1000) % 60),
  };
}

export function Countdown() {
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null);
  useEffect(() => {
    setT(diff(IDULADHA_DATE));
    const id = setInterval(() => setT(diff(IDULADHA_DATE)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 md:gap-4" aria-live="off">
        {(["Hari", "Jam", "Menit", "Detik"] as const).map((k) => (
          <div key={k} className="rounded-2xl border border-ivory/15 bg-ivory/10 p-3 text-center backdrop-blur md:p-5">
            <p className="text-3xl font-extrabold tabular-nums text-ivory md:text-5xl">{t ? String(t[k]).padStart(2, "0") : "--"}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gold md:text-sm">{k}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-cream/75">
        Perkiraan Iduladha 1448 H: {formatDate(IDULADHA_DATE, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}. Tanggal resmi mengikuti penetapan pemerintah.
      </p>
    </div>
  );
}
