import { useState, type ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Menu, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import type { ShellItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Props {
  base: "/portal" | "/admin";
  title: string;
  items: ShellItem[];
}

function NavList({ base, items, onNavigate }: Omit<Props, "title"> & { onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const linkProps = it.slug
          ? ({ to: `${base}/$section`, params: { section: it.slug } } as const)
          : ({ to: base, activeOptions: { exact: true } } as const);
        return (
          <li key={it.slug || "index"}>
            <Link
              {...(linkProps as object)}
              to={linkProps.to}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary" }}
            >
              <it.icon className="size-4 shrink-0" />
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ base, title, items }: Props) {
  const [open, setOpen] = useState(false);
  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-4"><Logo light /></div>
      <p className="px-4 pb-2 pt-5 text-xs font-bold uppercase tracking-wider text-sidebar-primary">{title}</p>
      <nav aria-label={title} className="flex-1 overflow-y-auto px-2 pb-4"><NavList base={base} items={items} onNavigate={onNavigate} /></nav>
      <div className="border-t border-sidebar-border p-3">
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"><LogOut className="size-4" /> Kembali ke situs</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">{sidebar()}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <button className="absolute inset-0 bg-charcoal/50" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <div className="animate-rise relative h-full w-72 shadow-lift">
            {sidebar(() => setOpen(false))}
            <Button variant="ghost" size="icon" className="absolute right-2 top-3 text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Tutup menu" onClick={() => setOpen(false)}><X /></Button>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-ivory/90 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu /></Button>
          <p className="font-bold text-burgundy-dark">{title}</p>
          <span className="ml-auto rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-gold-foreground">Pratinjau tata letak</span>
        </header>
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function ShellPage({ item, children }: { item: ShellItem; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="size-5" /></span>
        <div>
          <h1 className="text-2xl font-extrabold text-burgundy-dark md:text-3xl">{item.label}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{item.description}</p>
        </div>
      </div>
      <div className={cn("rounded-2xl border-2 border-dashed border-burgundy/20 bg-card p-8 text-center")}>
        <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">Fase berikutnya</span>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">Fitur ini belum aktif. Halaman ini menyiapkan struktur navigasi dan tata letak.</p>
        {children}
      </div>
    </div>
  );
}
