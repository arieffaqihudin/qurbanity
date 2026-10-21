import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBLIC_NAV } from "@/lib/navigation";
import { Logo } from "./Logo";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-ivory/90 backdrop-blur">
      <div className="container-q flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Utama" className="hidden items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3 py-2 text-sm font-semibold text-charcoal/80 transition-colors hover:bg-muted hover:text-burgundy"
              activeProps={{ className: "bg-muted text-burgundy" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button variant="ghost" size="sm" asChild><Link to="/auth">Masuk</Link></Button>
          <Button size="sm" asChild><Link to="/simulasi">Mulai Kurban</Link></Button>
        </div>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11 lg:hidden" aria-label={open ? "Tutup menu" : "Buka menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav aria-label="Menu seluler" className="animate-rise border-t border-border bg-ivory lg:hidden">
          <div className="container-q flex flex-col py-3">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-base font-semibold hover:bg-muted" activeProps={{ className: "text-burgundy bg-muted" }}>
                {n.label}
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" asChild><Link to="/auth" onClick={() => setOpen(false)}>Masuk</Link></Button>
              <Button asChild><Link to="/simulasi" onClick={() => setOpen(false)}>Mulai Kurban</Link></Button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
