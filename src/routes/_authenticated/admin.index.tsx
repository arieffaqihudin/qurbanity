import { createFileRoute } from "@tanstack/react-router";
import { ShellPage } from "@/components/app/AppShell";
import { ADMIN_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: () => <ShellPage item={ADMIN_NAV[0]!} />,
});
