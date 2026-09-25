"use client";

import { ChevronDown } from "lucide-react";
import { Accordion } from "radix-ui";
import { FAQS } from "../data";

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Perguntas frequentes</p>
          <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">Dúvidas comuns antes de começar.</h2>
        </div>
        <Accordion.Root type="single" collapsible className="mt-12 divide-y divide-line border-y border-line">
          {FAQS.map((f, i) => (
            <Accordion.Item key={f.question} value={`item-${i}`}>
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-ink transition-colors hover:text-accent">
                  {f.question}
                  <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden text-sm text-ink-2 data-[state=open]:animate-rise">
                <p className="pb-5 pr-8">{f.answer}</p>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
