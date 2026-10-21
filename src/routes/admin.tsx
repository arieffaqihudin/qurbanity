import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { ADMIN_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin | qurbanity" }, { name: "robots", content: "noindex" }] }),
  component: () => <AppShell base="/admin" title="Dashboard Admin" items={ADMIN_NAV} />,
});
