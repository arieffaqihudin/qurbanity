import { PageHeader, Section, Notice, Placeholder } from "./primitives";

export function LegalPage({ title, sections }: { title: string; sections: string[] }) {
  return (
    <>
      <PageHeader eyebrow="Dokumen hukum" title={title} intro="Status: draf, belum berlaku." />
      <Section>
        <div className="mx-auto max-w-3xl space-y-4">
          <Notice kind="pending">Dokumen final belum disetujui. Kerangka di bawah menunjukkan topik yang akan dicakup; isi resmi akan dipublikasikan setelah peninjauan hukum dan syariah.</Notice>
          {sections.map((s, i) => <Placeholder key={s} title={`${i + 1}. ${s}`} />)}
        </div>
      </Section>
    </>
  );
}
