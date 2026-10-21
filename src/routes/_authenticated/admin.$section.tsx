import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShellPage } from "@/components/app/AppShell";
import { ADMIN_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/_authenticated/admin/$section")({
  loader: ({ params }) => {
    const item = ADMIN_NAV.find((n) => n.slug && n.slug === params.section);
    if (!item) throw notFound();
    return { slug: item.slug };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${ADMIN_NAV.find((n) => n.slug === loaderData?.slug)?.label ?? "Halaman"} | Admin qurbanity` }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useLoaderData();
  return <ShellPage item={ADMIN_NAV.find((n) => n.slug === slug)!} />;
}
