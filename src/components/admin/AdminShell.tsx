import { useState } from "react";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, LogOut, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";
import { ADMIN_GROUPS } from "@/lib/navigation";
import { can, ROLE_LABEL, type AdminAccess } from "@/lib/admin";

export function AdminShell({ access }: { access: AdminAccess }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const groups = ADMIN_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(access, i.perms)) })).filter((g) => g.items.length);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4"><Logo light /></div>
      <nav aria-label="Menu admin" className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-sidebar-primary">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <Link to={it.to} onClick={onNavigate} activeOptions={{ exact: it.to === "/admin" }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground [&>svg]:text-sidebar-primary" }}>
                    <it.icon className="size-4 shrink-0" />{it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <Link to="/" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"><Home className="size-4" /> Kembali ke situs</Link>
        <button type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent"><LogOut className="size-4" /> Keluar</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">Lewati ke konten</a>
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar()}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu admin</SheetTitle>
          <SheetDescription className="sr-only">Navigasi modul admin</SheetDescription>
          {sidebar(() => setOpen(false))}
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-ivory/90 px-3 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11 lg:hidden" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></Button>
          <p className="font-bold text-burgundy-dark">Dashboard Admin</p>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{ROLE_LABEL[access.role]}</span>
        </header>
        <main id="admin-main" className="flex-1 p-3 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
