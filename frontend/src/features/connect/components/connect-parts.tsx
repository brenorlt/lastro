"use client";

import { Check, Copy, Plug, Unplug } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import { type AppConnection, mcpServerUrl, useConnections, useDisconnect } from "../api";

const noop = () => () => {};

/** Endereço do conector (depende da origem atual: só existe no navegador). */
export function useMcpUrl() {
  return useSyncExternalStore(noop, mcpServerUrl, () => "");
}

export function CopyField({ value, label = "Copiar endereço" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto continua selecionável */
    }
  };
  if (!value) return <Skeleton className="h-10 w-full" />;
  return (
    <div className="bg-surface-sunken ring-line flex items-center gap-2 rounded-md py-1 pr-1 pl-3 ring-1">
      <code className="text-ink min-w-0 flex-1 truncate font-mono text-sm select-all">{value}</code>
      <Button size="sm" variant="secondary" onClick={() => void copy()} aria-label={label}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export const EXAMPLE_PROMPTS = [
  "Quanto gastei com delivery este mês?",
  "Lança R$ 48,90 de iFood no cartão Nubank hoje",
  "Estou no ritmo da meta da viagem?",
  "Quais contas vencem esta semana?",
  "Algum orçamento estourou?",
  "Guarda R$ 300 na meta do carro",
];

function ConnectionRow({ c, onDisconnect }: { c: AppConnection; onDisconnect: () => void }) {
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <span className="bg-surface-sunken text-ink-2 flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
        {c.appName.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ink truncate text-sm font-medium">{c.appName}</p>
        <p className="text-ink-3 text-xs">
          Conectado em {formatDate(c.createdAt)}
          {c.lastUsedAt ? ` · usado em ${formatDate(c.lastUsedAt)}` : " · ainda não usado"}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onDisconnect}>
        <Unplug aria-hidden /> Desconectar
      </Button>
    </li>
  );
}

/** Quem tem acesso à conta hoje, com opção de desconectar. */
export function ConnectionsCard() {
  const connections = useConnections();
  const disconnect = useDisconnect();
  const [removing, setRemoving] = useState<AppConnection | null>(null);
  return (
    <Card>
      <CardHeader title="Com acesso à sua conta" />
      {connections.isPending ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : connections.isError ? (
        <ErrorState description={userMessage(connections.error)} onRetry={() => void connections.refetch()} />
      ) : connections.data.length === 0 ? (
        <p className="text-ink-2 flex items-center gap-2 px-5 pb-6 text-sm sm:px-6">
          <Plug className="text-ink-3 size-4" aria-hidden /> Nenhum app conectado ainda.
        </p>
      ) : (
        <ul className="divide-line divide-y">
          {connections.data.map((c) => (
            <ConnectionRow key={c.id} c={c} onDisconnect={() => setRemoving(c)} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(v) => !v && setRemoving(null)}
        title={`Desconectar ${removing?.appName ?? ""}?`}
        description="O app perde o acesso imediatamente. Para usar de novo, é só conectar outra vez."
        confirmLabel="Desconectar"
        loading={disconnect.isPending}
        onConfirm={() => removing && disconnect.mutate(removing.id, { onSettled: () => setRemoving(null) })}
      />
    </Card>
  );
}
