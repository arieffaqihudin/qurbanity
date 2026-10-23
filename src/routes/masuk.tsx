import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/masuk")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", replace: true });
  },
});
