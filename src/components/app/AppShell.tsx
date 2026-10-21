import { useState, type ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import type { ShellItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Props {
  base: "/portal" | "/admin";
  title: string;
  items: ShellItem[];
}

function NavList({ base, items, onNavigate }: Omit<Props, "title"> & { onNavigate?: (() => void) | undefined }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const cls = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
        const active = { className: "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary" };
        const inner = (<><it.icon className="size-4 shrink-0" />{it.label}</>);
        return (
          <li key={it.slug || "index"}>
            {it.slug ? (
              <Link to={`${base}/$section`} params={{ section: it.slug }} onClick={onNavigate} className={cls} activeProps={active}>{inner}</Link>
            ) : (
              <Link to={base} activeOptions={{ exact: true }} onClick={onNavigate} className={cls} activeProps={active}>{inner}</Link>
            )}
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
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#app-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Lewati ke konten</a>
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar()}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">Menu navigasi</SheetDescription>
          {sidebar(() => setOpen(false))}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-ivory/90 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11 lg:hidden" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></Button>
          <p className="font-bold text-burgundy-dark">{title}</p>
          <span className="ml-auto rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-burgundy-dark">Pratinjau tata letak</span>
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
