import { createFileRoute, redirect } from "@tanstack/react-router";

// Rute lama — Manajemen Admin dipisah menjadi modul Pengguna dan Hak Akses.
export const Route = createFileRoute("/_authenticated/admin/manajemen-admin")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/pengguna", replace: true });
  },
  component: () => null,
});
