import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQS } from "./faq-data";

export function FaqList({ limit }: { limit?: number }) {
  const items = limit ? FAQS.slice(0, limit) : FAQS;
  return (
    <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5">
      {items.map((f, i) => (
        <AccordionItem key={f.q} value={`f${i}`} className="last:border-b-0">
          <AccordionTrigger className="text-left text-base font-bold hover:no-underline">{f.q}</AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
