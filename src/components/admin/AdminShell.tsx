import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, LogOut, Home, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import symbol from "@/assets/qurbanity-symbol.png";
import { ADMIN_GROUPS, adminHubOf, type AdminHub } from "@/lib/navigation";
import { can, ROLE_LABEL, type AdminAccess } from "@/lib/admin";
import { cn } from "@/lib/utils";

const PREF_KEY = "qurbanity.admin.sidebar";
const GROUPS_KEY = "qurbanity.admin.groups";

export function AdminShell({ access }: { access: AdminAccess }) {
  const [drawer, setDrawer] = useState(false);
  const [pref, setPref] = useState(false);
  const [wide, setWide] = useState(true);
  // Tablets (md–lg) always get the icon rail so content keeps its width; desktop follows the saved preference.
  const collapsed = pref || !wide;
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try {
      setPref(localStorage.getItem(PREF_KEY) === "collapsed");
      setClosedGroups(JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "[]"));
    } catch { /* ignore corrupt preference */ }
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const toggleCollapsed = () => setPref((c) => { localStorage.setItem(PREF_KEY, c ? "expanded" : "collapsed"); return !c; });
  const toggleGroup = (g: string) => setClosedGroups((cur) => {
    const next = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g];
    localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    return next;
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  // Role-filtered hubs: a hub shows if any of its tabs is allowed, and links to the first allowed tab.
  const groups = ADMIN_GROUPS.map((g) => ({
    ...g,
    items: g.items.map((h) => ({ ...h, tabs: h.tabs.filter((t) => can(access, t.perms)) })).filter((h) => h.tabs.length),
  })).filter((g) => g.items.length);
  const activeHub = (pathname.startsWith("/admin/peserta") ? adminHubOf("/admin/peserta") : adminHubOf(pathname))?.hub.label;
  const isActive = (h: AdminHub) => h.label === activeHub;

  const itemCls = (active: boolean) => cn(
    "flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    active ? "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
  );

  const expandedNav = (onNavigate?: () => void) => (
    <nav aria-label="Menu admin" className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((g) => {
        const open = !closedGroups.includes(g.label) || g.items.some(isActive);
        const id = `grp-${g.label.replace(/\W+/g, "-")}`;
        return (
          <div key={g.label} className="mb-2">
            <button type="button" onClick={() => toggleGroup(g.label)} aria-expanded={open} aria-controls={id}
              className="flex w-full items-center rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sidebar-primary hover:bg-sidebar-accent/40">
              {g.label}<ChevronDown className={cn("ml-auto size-3.5 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />
            </button>
            {open && (
              <ul id={id} className="mt-0.5 space-y-0.5">
                {g.items.map((h) => (
                  <li key={h.label}>
                    <Link to={h.tabs[0]!.to} onClick={onNavigate} aria-current={isActive(h) ? "page" : undefined} className={itemCls(isActive(h))}>
                      <h.icon className="size-4 shrink-0" /><span className="truncate">{h.label}</span>
                      {h.tabs.length > 1 && <span className="ml-auto text-[10px] font-bold text-sidebar-foreground/50">{h.tabs.length}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  const collapsedNav = (
    <nav aria-label="Menu admin" className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((g, gi) => (
        <ul key={g.label} aria-label={g.label} className={cn("space-y-1", gi > 0 && "mt-2 border-t border-sidebar-border pt-2")}>
          {g.items.map((h) => (
            <li key={h.label}>
              {h.tabs.length > 1 ? (
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger aria-label={h.label} className={cn(itemCls(isActive(h)), "w-full justify-center px-0")}>
                        <h.icon className="size-5" />
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">{h.label}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent side="right" align="start" className="min-w-52">
                    <DropdownMenuLabel>{h.label}</DropdownMenuLabel>
                    {h.tabs.map((t) => (
                      <DropdownMenuItem key={t.to} asChild>
                        <Link to={t.to} className={cn(pathname === t.to && "font-bold text-primary")}><t.icon className="size-4" />{t.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to={h.tabs[0]!.to} aria-label={h.label} aria-current={isActive(h) ? "page" : undefined} className={cn(itemCls(isActive(h)), "justify-center px-0")}>
                      <h.icon className="size-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{h.label}</TooltipContent>
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      ))}
    </nav>
  );

  const footer = (mini: boolean) => (
    <div className="border-t border-sidebar-border p-2">
      {mini ? (
        <>
          <Tooltip><TooltipTrigger asChild><Link to="/" aria-label="Kembali ke situs" className={cn(itemCls(false), "justify-center px-0")}><Home className="size-5" /></Link></TooltipTrigger><TooltipContent side="right">Kembali ke situs</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><button type="button" aria-label="Keluar" onClick={signOut} className={cn(itemCls(false), "w-full justify-center px-0")}><LogOut className="size-5" /></button></TooltipTrigger><TooltipContent side="right">Keluar</TooltipContent></Tooltip>
        </>
      ) : (
        <>
          <Link to="/" className={itemCls(false)}><Home className="size-4" /> Kembali ke situs</Link>
          <button type="button" onClick={signOut} className={cn(itemCls(false), "w-full")}><LogOut className="size-4" /> Keluar</button>
        </>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-dvh bg-background">
        <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Lewati ke konten</a>

        {/* Desktop sidebar */}
        <aside className={cn("sticky top-0 z-40 hidden h-dvh shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none md:block", collapsed ? "w-[4.5rem]" : "w-64")}>
          <div className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
            <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center" : "px-4")}>
              {collapsed ? <img src={symbol} alt="qurbanity" className="size-8 object-contain" /> : <div className="flex items-center gap-2"><Logo light /><span className="text-[10px] font-bold uppercase tracking-wider text-sidebar-primary">Admin</span></div>}
            </div>
            {collapsed ? collapsedNav : expandedNav()}
            {footer(collapsed)}
          </div>
          {wide && <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "Perluas menu samping" : "Ciutkan menu samping"} aria-expanded={!collapsed}
            className="absolute right-0 top-1/2 z-50 grid size-7 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full border border-border bg-card text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>}
        </aside>

        {/* Mobile / tablet drawer */}
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:text-sidebar-foreground">
            <SheetTitle className="sr-only">Menu admin</SheetTitle>
            <SheetDescription className="sr-only">Navigasi modul admin</SheetDescription>
            <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
              <div className="flex h-14 items-center border-b border-sidebar-border px-4"><Logo light /></div>
              {expandedNav(() => setDrawer(false))}
              {footer(false)}
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-ivory/90 px-3 backdrop-blur md:px-6">
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:hidden" aria-label="Buka menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu /></Button>
            <p className="truncate font-bold text-burgundy-dark">{activeHub ?? "Dashboard Admin"}</p>
            <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{ROLE_LABEL[access.role]}</span>
          </header>
          <main id="admin-main" className="flex-1 p-3 md:p-6"><Outlet /></main>
        </div>
      </div>
    </TooltipProvider>
  );
}
