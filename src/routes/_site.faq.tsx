import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/site/primitives";
import { FaqList } from "@/components/site/FaqList";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/faq")({
  head: () => seo("FAQ", "Jawaban atas pertanyaan umum seputar kurban bertahap, harga terkunci, pembayaran, dan pelaksanaan."),
  component: () => (
    <>
      <PageHeader eyebrow="FAQ" title="Pertanyaan yang sering diajukan" />
      <Section>
        <div className="mx-auto max-w-3xl">
          <h2 className="sr-only">Daftar pertanyaan</h2>
          <FaqList />
          <div className="mt-8 rounded-2xl bg-cream/60 p-6 text-center">
            <p className="font-bold text-burgundy-dark">Belum menemukan jawaban?</p>
            <Button className="mt-3" asChild><Link to="/kontak">Hubungi kami</Link></Button>
          </div>
        </div>
      </Section>
    </>
  ),
});
