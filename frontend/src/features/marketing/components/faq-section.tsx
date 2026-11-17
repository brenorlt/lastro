import { ChevronDown } from "lucide-react";
import { FAQS } from "../data";
import { SectionHeading } from "./section-heading";

/**
 * <details> nativo em vez do Accordion do Radix: zero JS, abre pelo teclado e pela busca
 * do navegador (Ctrl+F acha o texto das respostas). O evento faq_open sai do MarketingAnalytics,
 * que escuta o "toggle" de qualquer [data-faq].
 */
export function FaqSection() {
  return (
    <section id="faq" data-section="faq" className="defer-render border-line scroll-mt-20 border-t py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading
          align="left"
          className="lg:sticky lg:top-24 lg:self-start"
          eyebrow="Perguntas frequentes"
          title="Antes de começar, a gente responde."
          description={
            <>
              Ficou alguma dúvida? Escreva para{" "}
              <a href="mailto:brenotolentino.dev@gmail.com" className="text-accent underline-offset-4 hover:underline">
                nosso e-mail
              </a>
              . Respondemos rápido.
            </>
          }
        />
        <div className="faq-list divide-line border-line divide-y border-y">
          {FAQS.map((f) => (
            <details key={f.question} name="faq" data-faq={f.question} className="faq-item group">
              <summary className="text-ink hover:text-accent flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium transition-colors">
                {f.question}
                <ChevronDown
                  className="faq-chevron text-ink-3 size-4 shrink-0 transition-transform duration-200"
                  aria-hidden
                />
              </summary>
              <p className="text-ink-2 pr-8 pb-5 text-sm leading-relaxed">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
