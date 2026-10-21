import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { PORTAL_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/portal")({
  head: () => ({ meta: [{ title: "Portal Peserta | QURBANITY" }, { name: "robots", content: "noindex" }] }),
  component: () => <AppShell base="/portal" title="Portal Peserta" items={PORTAL_NAV} />,
});
