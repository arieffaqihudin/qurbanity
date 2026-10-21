import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Section, Notice } from "@/components/site/primitives";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_site/kontak")({
  head: () => seo("Kontak", "Hubungi tim qurbanity untuk pertanyaan seputar program kurban bertahap."),
  component: Page,
});

function Page() {
  const [sent, setSent] = useState(false);
  return (
    <>
      <PageHeader eyebrow="Kontak" title="Kami siap membantu" intro="Sampaikan pertanyaan kamu tentang program, pembayaran, atau pelaksanaan kurban." />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            {[
              { icon: MessageCircle, t: "WhatsApp", d: "Nomor resmi segera diumumkan" },
              { icon: Mail, t: "Email", d: "Alamat resmi segera diumumkan" },
              { icon: MapPin, t: "Alamat", d: "Alamat kantor segera diumumkan" },
            ].map((x) => (
              <div key={x.t} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><x.icon className="size-5" /></span>
                <div><p className="font-bold text-burgundy-dark">{x.t}</p><p className="text-sm text-muted-foreground">{x.d}</p></div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft md:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="nama">Nama lengkap</Label><Input id="nama" required className="mt-1.5 h-11" autoComplete="name" /></div>
              <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required className="mt-1.5 h-11" autoComplete="email" /></div>
            </div>
            <div><Label htmlFor="pesan">Pesan</Label><Textarea id="pesan" required rows={5} className="mt-1.5" /></div>
            <Button type="submit" size="lg">Kirim pesan</Button>
            {sent && <Notice kind="info">Formulir belum terhubung ke sistem. Pesan kamu belum terkirim; silakan hubungi kami melalui kanal resmi setelah diumumkan.</Notice>}
          </form>
        </div>
      </Section>
    </>
  );
}
