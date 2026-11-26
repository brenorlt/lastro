import { ArrowRight, ArrowUp, Check, Eye, PencilLine, ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";
import { AI_CHAT_SCENES, AI_CLIENTS, SIGNUP_CTA } from "../data";
import { SectionHeading } from "./section-heading";

/** O mesmo que a tela de consentimento (/conectar) mostra antes de autorizar. */
const PERMISSIONS = [
  { icon: Eye, text: "Consulta saldos, lançamentos, orçamentos, metas e patrimônio" },
  { icon: PencilLine, text: "Registra e edita lançamentos, marca contas como pagas e guarda dinheiro nas metas" },
  { icon: ShieldCheck, text: "Nunca exclui nada, não vê sua senha e não movimenta dinheiro de verdade" },
];

const SCENE_SECONDS = 6;
const delay = (i: number) => ({ "--ai-delay": `${i * SCENE_SECONDS}s` }) as CSSProperties;

/** Prévia da conversa: ilustração (aria-hidden), animada só com CSS em globals.css (.ai-scene). */
function ChatPreview() {
  return (
    <div aria-hidden className="reveal bg-surface-sunken ring-line relative rounded-2xl p-4 shadow-lg ring-1 sm:p-5">
      <div className="text-ink-3 flex items-center gap-2 text-xs">
        <span className="bg-positive size-1.5 rounded-full" />
        Lastro conectado
      </div>

      <div className="mt-4 grid">
        {AI_CHAT_SCENES.map((s, i) => (
          <div key={s.tool} className="ai-scene col-start-1 row-start-1 flex flex-col gap-3" style={delay(i)}>
            <p className="ai-q bg-accent text-accent-ink ml-auto max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm">
              {s.question}
            </p>
            <p className="ai-tool text-ink-3 flex items-center gap-2 text-xs">
              <span className="bg-positive-soft text-positive flex size-5 items-center justify-center rounded-full">
                <Check className="size-3" strokeWidth={2.5} />
              </span>
              Usou o Lastro
              <code className="bg-surface ring-line text-ink-2 rounded px-1.5 py-0.5 font-mono text-[11px] ring-1">
                {s.tool}
              </code>
            </p>
            <p className="ai-a text-ink max-w-[92%] text-sm leading-6">{s.answer}</p>
          </div>
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {AI_CHAT_SCENES.map((s, i) => (
          <li
            key={s.chip}
            className="ai-chip text-ink-2 ring-line relative isolate rounded-full px-3 py-1 text-xs ring-1"
          >
            <span
              className="ai-chip-on bg-accent-soft ring-accent/40 absolute inset-0 -z-10 rounded-full opacity-0 ring-1"
              style={delay(i)}
            />
            {s.chip}
          </li>
        ))}
      </ul>

      <div className="bg-surface ring-line text-ink-3 mt-3 flex items-center gap-3 rounded-xl py-2 pr-2 pl-3.5 text-sm ring-1">
        <span className="flex-1 truncate">Pergunte sobre o seu dinheiro…</span>
        <span className="bg-accent text-accent-ink flex size-8 items-center justify-center rounded-full">
          <ArrowUp className="size-4" />
        </span>
      </div>
    </div>
  );
}

export function AiConnectorSection() {
  return (
    <section id="ia" data-section="ia" aria-labelledby="ia-titulo" className="defer-render scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="bg-surface ring-line relative isolate overflow-hidden rounded-3xl p-6 ring-1 sm:p-10 lg:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 -right-32 -z-10 size-[520px] rounded-full opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--accent), transparent 70%), transparent)",
            }}
          />

          <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <SectionHeading
                id="ia-titulo"
                align="left"
                eyebrow="Novo · Conector para IA"
                title={
                  <>
                    Seu dinheiro, numa conversa.
                    <span className="text-brass block italic">No Claude ou no Codex.</span>
                  </>
                }
                description="Conecte o Lastro ao assistente de IA que você já usa e pergunte, lance gastos ou acompanhe metas sem abrir o app. A resposta vem dos seus números, não de palpites."
              />

              <ul className="reveal mt-8 space-y-3">
                {PERMISSIONS.map((p) => (
                  <li key={p.text} className="text-ink-2 flex items-start gap-3 text-sm">
                    <span className="bg-accent-soft text-accent flex size-7 shrink-0 items-center justify-center rounded-md">
                      <p.icon className="size-4" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="pt-1">{p.text}</span>
                  </li>
                ))}
              </ul>

              <div className="reveal mt-8">
                <p className="text-ink-3 text-2xs font-medium tracking-[0.12em] uppercase">Funciona com</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {AI_CLIENTS.map((c) => (
                    <li key={c.name} className="bg-surface-sunken ring-line rounded-lg px-3 py-2 text-sm ring-1">
                      <span className="text-ink font-medium">{c.name}</span>
                      <span className="text-ink-3"> · {c.where}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="reveal mt-9">
                <Link
                  href="/cadastro"
                  data-cta="ia"
                  className={cn(buttonVariants({ size: "lg" }), "h-13 w-full px-7 sm:w-auto")}
                >
                  {SIGNUP_CTA} <ArrowRight aria-hidden />
                </Link>
                <p className="text-ink-3 mt-3 text-xs">
                  Incluído na assinatura. Você autoriza uma vez e desconecta quando quiser, em Perfil.
                </p>
              </div>
            </div>

            <ChatPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
