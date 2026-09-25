"use client";

import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { ArrowLeftRight, CreditCard, Plus, Search, TrendingUp } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Amount } from "@/components/finance/amount";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Spinner } from "@/components/ui/spinner";
import { ALL_ROUTES } from "@/config/navigation";
import { transactionsApi } from "@/features/transactions/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDate } from "@/lib/format";
import { useOpenTransaction } from "@/features/transactions/use-open-transaction";
import { useComposer } from "@/stores/composer-store";
import { useUiStore } from "@/stores/ui-store";

const itemClass =
  "flex h-11 cursor-default select-none items-center gap-3 rounded-md px-3 text-sm text-ink outline-none data-[selected=true]:bg-surface-sunken [&_svg]:size-4 [&_svg]:text-ink-3";
const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3";
const iconCls = "size-7 rounded-[7px] [&_svg]:!size-3.5";

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return <Command.Group heading={heading} className={groupClass}>{children}</Command.Group>;
}

/**
 * Busca global (⌘K / Ctrl+K): telas, ações e — a partir de 2 caracteres —
 * lançamentos, contas e categorias vindos da API (com debounce).
 */
export function CommandMenu() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const openNew = useComposer((s) => s.openNew);
  const openEdit = useOpenTransaction();
  const [text, setText] = useState("");
  const q = useDebouncedValue(text.trim(), 250);

  const results = useQuery({
    queryKey: ["search", q],
    queryFn: async ({ signal }) => (await transactionsApi.search(q, signal)).data,
    enabled: open && q.length >= 2,
    staleTime: 15_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    setText("");
    fn();
  };

  // Resultados do servidor já vêm filtrados: a palavra buscada como keyword impede que o cmdk os esconda.
  const kw = [text];
  const data = q.length >= 2 ? results.data : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setText(""); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12dvh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl bg-surface-raised shadow-lg ring-1 ring-line animate-rise"
        >
          <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
          <Command label="Busca global" loop>
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-ink-3" aria-hidden />
              <Command.Input
                autoFocus
                value={text}
                onValueChange={setText}
                placeholder="Buscar lançamentos, contas, categorias, telas…"
                className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
              />
              {results.isFetching && <Spinner className="text-ink-3" label="Buscando" />}
            </div>
            <Command.List className="max-h-[min(60dvh,440px)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-sm text-ink-2">
                {results.isFetching ? "Buscando…" : "Nada encontrado. Tente outro termo."}
              </Command.Empty>

              {data && data.transactions.length > 0 && (
                <Group heading="Lançamentos">
                  {data.transactions.map((t) => (
                    <Command.Item key={t.id} value={`tx-${t.id}`} keywords={kw} className={itemClass} onSelect={() => run(() => openEdit(t))}>
                      {t.type === "TRANSFER" ? <ArrowLeftRight aria-hidden /> : <EntityIcon icon={t.category?.icon ?? "ellipsis"} color={t.category?.color ?? "#64748B"} className={iconCls} />}
                      <span className="min-w-0 flex-1 truncate">{t.description}</span>
                      <span className="hidden text-xs text-ink-3 sm:block">{formatDate(`${t.date}T12:00:00`, "short")}</span>
                      <Amount value={t.amount} flow={t.type === "INCOME" ? "income" : t.type === "EXPENSE" ? "expense" : "neutral"} className="text-xs font-medium" />
                    </Command.Item>
                  ))}
                </Group>
              )}
              {data && data.accounts.length > 0 && (
                <Group heading="Contas">
                  {data.accounts.map((a) => (
                    <Command.Item key={a.id} value={`acc-${a.id}`} keywords={kw} className={itemClass} onSelect={() => run(() => router.push("/contas"))}>
                      <EntityIcon icon={a.icon} color={a.color} className={iconCls} />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <Amount value={a.currentBalance} className="text-xs font-medium" />
                    </Command.Item>
                  ))}
                </Group>
              )}
              {data && data.cards.length > 0 && (
                <Group heading="Cartões">
                  {data.cards.map((c) => (
                    <Command.Item key={c.id} value={`card-${c.id}`} keywords={kw} className={itemClass} onSelect={() => run(() => router.push(`/cartoes/${c.id}`))}>
                      <span aria-hidden className="flex size-7 items-center justify-center rounded-[7px] text-white" style={{ background: c.color }}><CreditCard className="!size-3.5 !text-white" /></span>
                      <span className="min-w-0 flex-1 truncate">{c.name}{c.lastFourDigits ? ` •••• ${c.lastFourDigits}` : ""}</span>
                      <span className="text-xs text-ink-3">disponível</span>
                      <Amount value={c.availableLimit} className="text-xs font-medium" />
                    </Command.Item>
                  ))}
                </Group>
              )}
              {data && data.investments.length > 0 && (
                <Group heading="Investimentos">
                  {data.investments.map((i) => (
                    <Command.Item key={i.id} value={`inv-${i.id}`} keywords={kw} className={itemClass} onSelect={() => run(() => router.push("/investimentos"))}>
                      <TrendingUp aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{i.name}{i.ticker ? ` · ${i.ticker}` : ""}</span>
                      <Amount value={i.currentValue} className="text-xs font-medium" />
                    </Command.Item>
                  ))}
                </Group>
              )}
              {data && data.categories.length > 0 && (
                <Group heading="Categorias">
                  {data.categories.map((c) => (
                    <Command.Item key={c.id} value={`cat-${c.id}`} keywords={kw} className={itemClass} onSelect={() => run(() => router.push("/categorias"))}>
                      <EntityIcon icon={c.icon} color={c.color} className={iconCls} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-ink-3">{c.type === "INCOME" ? "Receita" : "Despesa"}</span>
                    </Command.Item>
                  ))}
                </Group>
              )}

              <Group heading="Ações">
                <Command.Item className={itemClass} onSelect={() => run(() => openNew("EXPENSE"))} keywords={["gasto", "adicionar", "novo"]}>
                  <Plus aria-hidden /> Nova despesa <span className="ml-auto text-2xs text-ink-3">N</span>
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run(() => openNew("INCOME"))} keywords={["entrada", "adicionar", "novo"]}>
                  <Plus aria-hidden /> Nova receita <span className="ml-auto text-2xs text-ink-3">⇧ N</span>
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run(() => openNew("TRANSFER"))} keywords={["mover", "entre contas"]}>
                  <ArrowLeftRight aria-hidden /> Nova transferência
                </Command.Item>
              </Group>
              <Group heading="Ir para">
                {ALL_ROUTES.map(({ key, label, href, icon: Icon, keywords, purpose }) => (
                  <Command.Item key={key} value={label} keywords={keywords} className={itemClass} onSelect={() => run(() => router.push(href))}>
                    <Icon aria-hidden />
                    <span className="flex-1 truncate">{label}</span>
                    <span className="hidden max-w-[50%] truncate text-xs text-ink-3 sm:block">{purpose}</span>
                  </Command.Item>
                ))}
              </Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
