import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import symbol from "@/assets/qurbanity-symbol.png";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { PortalAccountMenu } from "@/components/portal/PortalAccountMenu";
import type { ShellItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Props {
  base: "/portal" | "/admin";
  title: string;
  items: ShellItem[];
}

const PREF_KEY = "qurbanity.portal.sidebar";

const itemCls =
  "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/85 outline-none transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const activeProps = {
  className: "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary",
  "aria-current": "page" as const,
};

function NavList({
  base,
  items,
  collapsed,
  onNavigate,
}: Omit<Props, "title"> & { collapsed?: boolean; onNavigate?: (() => void) | undefined }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const cls = cn(itemCls, collapsed && "justify-center px-0");
        const inner = (
          <>
            <it.icon className="size-4 shrink-0" />
            {collapsed ? <span className="sr-only">{it.label}</span> : <span className="truncate">{it.label}</span>}
          </>
        );
        const link = it.slug ? (
          <Link to={`${base}/$section`} params={{ section: it.slug }} onClick={onNavigate} className={cls} activeProps={activeProps}>
            {inner}
          </Link>
        ) : (
          <Link to={base} activeOptions={{ exact: true }} onClick={onNavigate} className={cls} activeProps={activeProps}>
            {inner}
          </Link>
        );
        return (
          <li key={it.slug || "index"}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{it.label}</TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ base, title, items }: Props) {
  const [drawer, setDrawer] = useState(false);
  const [pref, setPref] = useState(false);
  const [wide, setWide] = useState(true);
  // Tablet (md–lg) always gets the icon rail; desktop follows the saved preference.
  const collapsed = pref || !wide;

  useEffect(() => {
    try {
      setPref(localStorage.getItem(PREF_KEY) === "collapsed");
    } catch {
      /* ignore unavailable storage */
    }
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const toggleCollapsed = () =>
    setPref((c) => {
      try {
        localStorage.setItem(PREF_KEY, c ? "expanded" : "collapsed");
      } catch {
        /* ignore unavailable storage */
      }
      return !c;
    });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-dvh bg-background">
        <a href="#app-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          Lewati ke konten
        </a>

        <aside
          className={cn(
            "sticky top-0 z-40 hidden h-dvh shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none md:block",
            collapsed ? "w-[4.5rem]" : "w-64",
          )}
        >
          <div className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
            <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center" : "px-4")}>
              {collapsed ? <img src={symbol} alt="qurbanity" className="size-8 object-contain" /> : <Logo light />}
            </div>
            <nav aria-label={title} className="flex-1 overflow-y-auto px-2 py-3">
              <NavList base={base} items={items} collapsed={collapsed} />
            </nav>
          </div>
          {wide && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Perluas menu samping" : "Ciutkan menu samping"}
              aria-expanded={!collapsed}
              className="absolute right-0 top-1/2 z-50 grid size-7 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full border border-border bg-card text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          )}
        </aside>

        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:text-sidebar-foreground">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <SheetDescription className="sr-only">Menu navigasi</SheetDescription>
            <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
              <div className="flex h-14 items-center border-b border-sidebar-border px-4"><Logo light /></div>
              <nav aria-label={title} className="flex-1 overflow-y-auto px-2 py-3">
                <NavList base={base} items={items} onNavigate={() => setDrawer(false)} />
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-ivory/90 px-3 backdrop-blur md:px-6">
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:hidden" aria-label="Buka menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <Menu />
            </Button>
            <p className="truncate font-bold text-burgundy-dark">{title}</p>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationBell table="participant_notifications" scope="portal" />
              <PortalAccountMenu />
            </div>
          </header>
          <main id="app-main" className="min-w-0 flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
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
