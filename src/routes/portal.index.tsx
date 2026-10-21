import { createFileRoute } from "@tanstack/react-router";
import { ShellPage } from "@/components/app/AppShell";
import { PORTAL_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/portal/")({
  component: () => <ShellPage item={PORTAL_NAV[0]!} />,
});
