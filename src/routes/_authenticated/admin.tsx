import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { ADMIN_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin | qurbanity" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ context }) => {
    // UI gate only; every admin data path is enforced by RLS / has_role() in the database.
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/portal" });
  },
  component: () => <AppShell base="/admin" title="Dashboard Admin" items={ADMIN_NAV} />,
});
