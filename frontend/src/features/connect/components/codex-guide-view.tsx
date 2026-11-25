"use client";

import { CopyField, useMcpUrl } from "./connect-parts";
import { ConsentIllustration, Frame, type GuideFaq, type GuideStep, GuideLayout } from "./guide-layout";

/* Ilustrações esquemáticas: não reproduzem a saída do Codex fielmente. */

function TerminalIllustration({ url }: { url: string }) {
  return (
    <Frame className="space-y-1.5 p-3 font-mono leading-relaxed">
      <p className="text-ink break-all">
        <span className="text-ink-3">$ </span>codex mcp add lastro --url{" "}
        <span className="ring-brass rounded px-0.5 ring-2">{url || "https://…/api/mcp"}</span>
      </p>
      <p className="text-ink-3">Abrindo o navegador para autorizar…</p>
      <p className="text-positive">✓ lastro conectado</p>
    </Frame>
  );
}

function ChatIllustration() {
  return (
    <Frame className="space-y-2 p-3">
      <p className="bg-ink text-ink-inverse ml-auto w-fit max-w-[90%] rounded-lg px-2 py-1">
        Quanto gastei com delivery este mês?
      </p>
      <p className="text-ink-3 font-mono">• Chamou lastro.buscar_lancamentos</p>
      <div className="bg-surface-sunken h-4 w-4/5 rounded" />
      <div className="bg-surface-sunken h-4 w-3/5 rounded" />
    </Frame>
  );
}

function Code({ children }: { children: string }) {
  return <code className="bg-surface-sunken rounded px-1 font-mono text-xs">{children}</code>;
}

export function CodexGuideView() {
  const url = useMcpUrl();
  const command = url ? `codex mcp add lastro --url ${url}` : "";

  const faq: GuideFaq[] = [
    {
      q: "Preciso pagar algo a mais?",
      a: "No Lastro, não: o conector faz parte da sua assinatura. Do lado do Codex, valem as regras do seu plano do ChatGPT ou da sua conta OpenAI.",
    },
    {
      q: "O Codex pode apagar meus dados?",
      a: "Não. Ele consegue consultar, registrar e editar lançamentos, marcar contas como pagas e guardar dinheiro em metas — nunca excluir. Para apagar algo, use o app.",
    },
    {
      q: "Para onde vão as informações que o Codex consulta?",
      a: "O Lastro só entrega dados quando o Codex faz um pedido em seu nome. O que ele consulta passa a fazer parte daquela conversa no Codex, sujeita às políticas de privacidade da OpenAI.",
    },
    {
      q: "O navegador não abriu para autorizar. E agora?",
      a: (
        <>
          Rode <Code>codex mcp login lastro</Code> no terminal: ele mostra o link de autorização para você abrir
          manualmente.
        </>
      ),
    },
    {
      q: "Prefiro editar o config.toml",
      a: (
        <>
          <span className="block">
            Adicione o bloco abaixo em <Code>~/.codex/config.toml</Code> e depois rode{" "}
            <Code>codex mcp login lastro</Code>:
          </span>
          <pre className="bg-surface-sunken text-ink mt-2 overflow-x-auto rounded-md p-3 font-mono text-xs">
            {`[mcp_servers.lastro]\nurl = "${url || "https://…/api/mcp"}"`}
          </pre>
        </>
      ),
    },
    {
      q: "Como desconecto?",
      a: (
        <>
          Logo abaixo, em “Com acesso à sua conta”, ou em Perfil → Apps conectados — o acesso cai na hora. Para tirar o
          Lastro da lista do Codex, rode <Code>codex mcp remove lastro</Code>.
        </>
      ),
    },
  ];

  const steps: GuideStep[] = [
    {
      title: "Adicione o Lastro ao Codex",
      body: (
        <>
          No terminal, rode o comando abaixo. Ele vale para o Codex no terminal, na extensão da IDE e no app, que
          compartilham a mesma configuração (<code className="font-mono text-xs">~/.codex/config.toml</code>).
          <div className="mt-3">
            <CopyField value={command} label="Copiar comando" />
          </div>
        </>
      ),
      visual: <TerminalIllustration url={url} />,
    },
    {
      title: "Autorize no Lastro",
      body: (
        <>
          O Codex abre o navegador numa tela do Lastro mostrando o que ele poderá fazer — confira e clique em{" "}
          <strong>Permitir acesso</strong>.
        </>
      ),
      visual: <ConsentIllustration appName="Codex" />,
    },
    {
      title: "Converse com o Codex",
      body: (
        <>
          Abra uma nova conversa e peça o que precisar. No terminal, <strong>/mcp</strong> mostra se o Lastro está
          ativo.
        </>
      ),
      visual: <ChatIllustration />,
    },
  ];

  return <GuideLayout appName="Codex" matchApp={(name) => /codex/i.test(name)} steps={steps} faq={faq} />;
}
