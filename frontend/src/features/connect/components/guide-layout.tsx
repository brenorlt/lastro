"use client";

import { CircleCheck, Plus, Search, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { useConnections } from "../api";
import { ConnectionsCard, EXAMPLE_PROMPTS } from "./connect-parts";
import { CAN, CANNOT, PermissionList } from "./consent-view";

/* Ilustrações esquemáticas (HTML puro) de cada passo. Não reproduzem a interface dos apps
   fielmente — só indicam onde clicar, para a pessoa reconhecer o caminho. */

export function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className="bg-canvas ring-line overflow-hidden rounded-lg text-[11px] ring-1 select-none">
      <div className="border-line flex items-center gap-1 border-b px-2.5 py-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="bg-line-strong size-1.5 rounded-full" />
        ))}
      </div>
      <div className={className}>{children}</div>
    </div>
  );
}

export function ConsentIllustration({ appName }: { appName: string }) {
  return (
    <Frame>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-1.5">
          <LogoMark className="size-5" />
          <p className="text-ink font-medium">Conectar {appName} ao Lastro</p>
        </div>
        <div className="bg-surface ring-line space-y-1 rounded p-2 ring-1">
          <p className="text-positive">✓ Ver e registrar lançamentos</p>
          <p className="text-ink-3">✕ Excluir dados</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <span className="bg-surface ring-line text-ink rounded px-2 py-1 text-center ring-1">Cancelar</span>
          <span className="bg-action text-action-ink ring-brass rounded px-2 py-1 text-center font-medium ring-2 ring-offset-1">
            Permitir acesso
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** Conversa de exemplo: mostra o tipo de pedido que funciona (valores ilustrativos). */
function ExampleChat() {
  return (
    <div aria-label="Exemplo de conversa" className="space-y-3 text-sm">
      <div className="flex justify-end">
        <p className="bg-ink text-ink-inverse max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5">
          Lança R$ 48,90 de iFood no cartão Nubank hoje e me diz como está o orçamento de alimentação.
        </p>
      </div>
      <div className="flex gap-2.5">
        <span className="bg-brass-soft text-brass mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
          <Search className="size-3.5" aria-hidden />
        </span>
        <div className="bg-surface ring-line max-w-[85%] space-y-2 rounded-2xl rounded-tl-md px-4 py-3 ring-1">
          <p className="text-ink-3 text-2xs font-medium tracking-wide uppercase">
            Usou Lastro · criar_lancamento, ver_orcamentos
          </p>
          <p className="text-ink">
            Pronto! Registrei <strong>R$ 48,90 — iFood</strong> no Nubank Ultravioleta, em Alimentação.
          </p>
          <p className="text-ink-2">
            Seu orçamento de Alimentação está em <strong className="text-warning">88%</strong>: restam R$ 95,69 até o
            fim do mês.
          </p>
        </div>
      </div>
      <p className="text-ink-3 text-2xs text-center">Exemplo ilustrativo</p>
    </div>
  );
}

export interface GuideStep {
  title: string;
  body: ReactNode;
  visual: ReactNode;
}

export interface GuideFaq {
  q: string;
  a: ReactNode;
}

/**
 * Página "Use o Lastro pelo <app>": passos, pedidos de exemplo, dúvidas e quem tem acesso.
 * `matchApp` reconhece a conexão deste app pelo nome que ele registrou no OAuth.
 */
export function GuideLayout({
  appName,
  matchApp,
  steps,
  faq,
}: {
  appName: string;
  matchApp: (registeredName: string) => boolean;
  steps: GuideStep[];
  faq: GuideFaq[];
}) {
  const connections = useConnections();
  const connected = connections.data?.find((c) => matchApp(c.appName));

  return (
    <>
      <PageHeader
        title={`Use o Lastro pelo ${appName}`}
        description="Pergunte sobre seus gastos, registre despesas e acompanhe metas conversando — sem abrir o app."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: appName }]}
      />

      {connected && (
        <Card className="mb-8 flex items-center gap-3 p-4 sm:p-5">
          <span className="bg-positive-soft text-positive flex size-9 shrink-0 items-center justify-center rounded-full">
            <CircleCheck className="size-5" aria-hidden />
          </span>
          <p className="text-ink-2 text-sm">
            <span className="text-ink font-medium">Seu Lastro já está conectado ao {connected.appName}</span> desde{" "}
            {formatDate(connected.createdAt)}. Abra o {appName} e experimente um dos pedidos abaixo.
          </p>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="passos">
            <h2 id="passos" className="text-ink mb-5 text-lg font-semibold tracking-tight">
              Conecte em {steps.length} passos
            </h2>
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="@container">
                  <Card className="grid gap-5 p-5 sm:p-6 @xl:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] @xl:items-center">
                    <div className="min-w-0">
                      <p className="text-brass text-2xs font-medium tracking-[0.12em] uppercase">Passo {i + 1}</p>
                      <h3 className="text-ink mt-1 text-base font-semibold">{s.title}</h3>
                      <div className="text-ink-2 [&_strong]:text-ink mt-1.5 text-sm [&_strong]:font-medium">
                        {s.body}
                      </div>
                    </div>
                    {s.visual}
                  </Card>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="pedidos">
            <h2 id="pedidos" className="text-ink mb-4 text-lg font-semibold tracking-tight">
              O que pedir
            </h2>
            <ul className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((e) => (
                <li key={e} className="bg-surface ring-line text-ink-2 rounded-full px-3.5 py-1.5 text-sm ring-1">
                  “{e}”
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="duvidas">
            <h2 id="duvidas" className="text-ink mb-4 text-lg font-semibold tracking-tight">
              Dúvidas
            </h2>
            <Card className="divide-line divide-y">
              {faq.map((f) => (
                <details key={f.q} className="group px-5 py-4 sm:px-6">
                  <summary className="text-ink flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus
                      className="text-ink-3 size-4 shrink-0 transition-transform group-open:rotate-45"
                      aria-hidden
                    />
                  </summary>
                  <div className="text-ink-2 mt-2 text-sm">{f.a}</div>
                </details>
              ))}
            </Card>
          </section>

          <ConnectionsCard />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <ExampleChat />
          </Card>
          <Card className="space-y-5 p-5">
            <PermissionList title={`O ${appName} poderá`} items={CAN} tone="can" />
            <div className="border-line border-t" />
            <PermissionList title="Não poderá" items={CANNOT} tone="cannot" />
            <p className="text-ink-3 flex items-start gap-2 text-xs">
              <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
              Você aprova cada conexão e pode desligar quando quiser.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
