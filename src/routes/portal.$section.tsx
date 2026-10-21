import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShellPage } from "@/components/app/AppShell";
import { PORTAL_NAV } from "@/lib/navigation";

export const Route = createFileRoute("/portal/$section")({
  loader: ({ params }) => {
    const item = PORTAL_NAV.find((n) => n.slug && n.slug === params.section);
    if (!item) throw notFound();
    return { slug: item.slug };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${PORTAL_NAV.find((n) => n.slug === loaderData?.slug)?.label ?? "Halaman"} | Portal Peserta qurbanity` }, { name: "robots", content: "noindex" }],
  }),
  component: Page,
});

function Page() {
  const { slug } = Route.useLoaderData();
  return <ShellPage item={PORTAL_NAV.find((n) => n.slug === slug)!} />;
}
