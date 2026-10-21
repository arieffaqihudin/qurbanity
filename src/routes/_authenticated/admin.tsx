import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import type { AdminAccess } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin | qurbanity" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    // UI gate only. Every admin read is filtered by RLS and every write re-checks permissions in the database.
    const { data, error } = await supabase.rpc("my_admin_access");
    if (error) throw new Error("Hak akses admin tidak dapat diperiksa. Coba muat ulang halaman.");
    const access = data as unknown as AdminAccess | null;
    if (!access) throw redirect({ to: "/portal" });
    return { access };
  },
  component: Layout,
});

function Layout() {
  const { access } = Route.useRouteContext();
  return <AdminShell access={access} />;
}
