"use client";

import { Plus, Settings } from "lucide-react";
import { CopyField, useMcpUrl } from "./connect-parts";
import { ConsentIllustration, Frame, type GuideFaq, type GuideStep, GuideLayout } from "./guide-layout";

/* Ilustrações esquemáticas: não reproduzem a interface do Claude fielmente. */

function SettingsIllustration() {
  return (
    <Frame className="grid grid-cols-[96px_1fr]">
      <div className="border-line text-ink-3 space-y-1 border-r p-2">
        <p className="text-ink-2 mb-1.5 flex items-center gap-1 font-medium">
          <Settings className="size-3" /> Configurações
        </p>
        <p className="px-1.5 py-0.5">Perfil</p>
        <p className="px-1.5 py-0.5">Privacidade</p>
        <p className="bg-surface text-ink ring-line rounded px-1.5 py-0.5 font-medium ring-1">Conectores</p>
      </div>
      <div className="space-y-2 p-2.5">
        <p className="text-ink font-medium">Conectores</p>
        <div className="bg-surface-sunken h-5 rounded" />
        <div className="bg-surface-sunken h-5 w-4/5 rounded" />
        <span className="bg-ink text-ink-inverse ring-brass inline-flex items-center gap-1 rounded px-2 py-1 leading-tight font-medium ring-2 ring-offset-1">
          <Plus className="size-3 shrink-0" /> Adicionar conector
        </span>
      </div>
    </Frame>
  );
}

function FormIllustration({ url }: { url: string }) {
  return (
    <Frame>
      <div className="space-y-2 p-3">
        <p className="text-ink font-medium">Adicionar conector personalizado</p>
        <div>
          <p className="text-ink-3 mb-0.5">Nome</p>
          <div className="bg-surface ring-line text-ink rounded px-2 py-1 ring-1">Lastro</div>
        </div>
        <div>
          <p className="text-ink-3 mb-0.5">URL do servidor</p>
          <div className="bg-surface ring-brass text-ink truncate rounded px-2 py-1 font-mono ring-2">{url || "https://…/api/mcp"}</div>
        </div>
        <div className="flex justify-end">
          <span className="bg-ink text-ink-inverse rounded px-2 py-1 font-medium">Adicionar</span>
        </div>
      </div>
    </Frame>
  );
}

const FAQ: GuideFaq[] = [
  {
    q: "Preciso pagar algo a mais?",
    a: "No Lastro, não: o conector faz parte da sua assinatura. Do lado do Claude, conectores personalizados seguem as regras do seu plano do Claude.",
  },
  {
    q: "O Claude pode apagar meus dados?",
    a: "Não. Ele consegue consultar, registrar e editar lançamentos, marcar contas como pagas e guardar dinheiro em metas — nunca excluir. Para apagar algo, use o app.",
  },
  {
    q: "Para onde vão as informações que o Claude consulta?",
    a: "O Lastro só entrega dados quando o Claude faz um pedido em seu nome. O que ele consulta passa a fazer parte daquela conversa no Claude, sujeita às políticas de privacidade do Claude.",
  },
  {
    q: "Uso o Claude Code (terminal). Funciona?",
    a: (
      <>
        Sim. Rode <code className="bg-surface-sunken rounded px-1 font-mono text-xs">claude mcp add --transport http lastro</code> seguido do
        endereço do conector e autorize no navegador quando pedir.
      </>
    ),
  },
  {
    q: "Como desconecto?",
    a: "Logo abaixo, em “Com acesso à sua conta”, ou em Perfil → Apps conectados. O acesso cai na hora.",
  },
];

export function ClaudeGuideView() {
  const url = useMcpUrl();

  const steps: GuideStep[] = [
    {
      title: "Abra os conectores do Claude",
      body: (
        <>
          No Claude (web, desktop ou celular), vá em <strong>Configurações → Conectores</strong> e clique em{" "}
          <strong>Adicionar conector personalizado</strong>.
        </>
      ),
      visual: <SettingsIllustration />,
    },
    {
      title: "Cole o endereço do Lastro",
      body: (
        <>
          Use o nome <strong>Lastro</strong> e cole o endereço abaixo no campo de URL.
          <div className="mt-3">
            <CopyField value={url} />
          </div>
        </>
      ),
      visual: <FormIllustration url={url} />,
    },
    {
      title: "Autorize no Lastro",
      body: (
        <>
          Clique em <strong>Conectar</strong>. Abre uma tela do Lastro mostrando o que o Claude poderá fazer — confira e clique em{" "}
          <strong>Permitir acesso</strong>. Pronto, é só conversar.
        </>
      ),
      visual: <ConsentIllustration appName="Claude" />,
    },
  ];

  return <GuideLayout appName="Claude" matchApp={(name) => /claude/i.test(name)} steps={steps} faq={FAQ} />;
}
