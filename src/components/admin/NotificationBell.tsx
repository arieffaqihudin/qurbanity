import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Notif { id: string; kind: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string }

/** Lonceng notifikasi di header admin. Data asli dari tabel admin_notifications (RLS: hanya milik sendiri). */
export function NotificationBell({ table = "admin_notifications", scope = "admin" }: { table?: "admin_notifications" | "participant_notifications"; scope?: string } = {}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: [scope, "notif", "unread"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const r = await supabase.from(table).select("id", { count: "exact", head: true }).is("read_at", null);
      if (r.error) throw new Error(r.error.message);
      return r.count ?? 0;
    },
  });

  const list = useQuery({
    queryKey: [scope, "notif", "list"],
    enabled: open,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(15);
      if (r.error) throw new Error(r.error.message);
      return (r.data ?? []) as Notif[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: [scope, "notif"] });
  };

  const markRead = async (id: string) => {
    const r = await supabase.from(table).update({ read_at: new Date().toISOString() }).eq("id", id);
    if (r.error) throw new Error(r.error.message);
    refresh();
  };

  const markAll = async () => {
    const r = await supabase.from(table).update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (r.error) throw new Error(r.error.message);
    refresh();
  };

  const count = unread.data ?? 0;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative min-h-11 min-w-11" aria-label={count > 0 ? `Notifikasi, ${count} belum dibaca` : "Notifikasi"} aria-expanded={open}>
          <Bell className="size-5" />
          {count > 0 && (
            <span aria-hidden className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-bold">Notifikasi</p>
          {count > 0 && (
            <button type="button" onClick={() => void markAll()} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <CheckCheck className="size-3.5" /> Tandai semua dibaca
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto" aria-label="Daftar notifikasi">
          {list.isPending ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Memuat notifikasi…</li>
          ) : list.isError ? (
            <li className="px-4 py-6 text-center text-sm text-destructive">Gagal memuat notifikasi.</li>
          ) : !list.data?.length ? (
            <li className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 size-6 text-muted-foreground/50" />
              <p className="text-sm font-semibold">Belum ada notifikasi</p>
              <p className="text-xs text-muted-foreground">Aktivitas penting program akan muncul di sini.</p>
            </li>
          ) : (
            list.data.map((n) => (
              <li key={n.id} className={cn("border-b border-border last:border-0", !n.read_at && "bg-primary/5")}>
                <div className="flex items-start gap-2 px-4 py-3">
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-border" : "bg-primary")} />
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link to={n.link} onClick={() => { setOpen(false); if (!n.read_at) void markRead(n.id); }} className="block text-sm font-semibold hover:text-primary">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold">{n.title}</p>
                    )}
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatRelativeTime(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <button type="button" onClick={() => void markRead(n.id)} aria-label={`Tandai dibaca: ${n.title}`}
                      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary">
                      <Check className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
