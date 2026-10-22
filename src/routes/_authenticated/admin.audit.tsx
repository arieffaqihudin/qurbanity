import { createFileRoute, redirect } from "@tanstack/react-router";

// Rute lama — Audit Aktivitas pindah ke Log Aktivitas di grup Pengaturan.
export const Route = createFileRoute("/_authenticated/admin/audit")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/log-aktivitas", replace: true });
  },
  component: () => null,
});
