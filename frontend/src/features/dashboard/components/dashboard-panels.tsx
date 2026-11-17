"use client";

import { ArrowRight, Check, CircleCheck, CalendarClock, Gauge, Landmark, MessagesSquare, ReceiptText, Shield, Target, TriangleAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Amount } from "@/components/finance/amount";
import { IconButton } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { parseISODate, todayISO } from "@/lib/dates";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import type { Dashboard } from "@/types/dashboard";
import type { Budget } from "@/types/planning";

/* ------------------------------------------------------------------ */
/* Seu mês: entrou, saiu, sobrou — a pergunta que a pessoa abre o app para responder. */

export function MonthSummary({ flow, hidden, isCurrentMonth }: { flow: Dashboard["flow"]; hidden: boolean; isCurrentMonth: boolean }) {
  const income = toNumber(flow.income);
  const expense = toNumber(flow.expense);
  const net = income - expense;
  const pending = toNumber(flow.pendingExpense);
  const spentShare = income > 0 ? Math.min(1, expense / income) : expense > 0 ? 1 : 0;
  const savedShare = income > 0 ? net / income : 0;

  const verdict =
    income === 0 && expense === 0
      ? "Registre receitas e despesas para ver aqui quanto sobrou no mês."
      : net >= 0
        ? income > 0
          ? <>Você guardou <strong>{formatPercent(savedShare * 100, { fractionDigits: 0 })}</strong> do que entrou{isCurrentMonth ? " até agora" : ""}.</>
          : "Nenhuma despesa registrada neste mês."
        : <>Você gastou <strong>{hidden ? "R$ ••••" : formatCurrency(-net)}</strong> a mais do que entrou.</>;

  const rows = [
    { label: "Entrou", value: income, dot: "bg-positive" },
    { label: "Saiu", value: expense, dot: "bg-ink-3" },
  ];

  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <h2 className="text-sm font-medium text-ink">{isCurrentMonth ? "Seu mês até agora" : "Resumo do mês"}</h2>
      <p className="mt-1 text-sm text-ink-2 [&_strong]:num [&_strong]:font-semibold [&_strong]:text-ink">{verdict}</p>

      <dl className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 text-ink-2">
              <span aria-hidden className={cn("size-2 rounded-full", r.dot)} />
              {r.label}
            </dt>
            <dd><Amount value={r.value} hidden={hidden} className="font-medium text-ink" /></dd>
          </div>
        ))}
      </dl>

      {/* Quanto da renda já foi consumido: a barra cheia é "gastei tudo o que entrou". */}
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-positive-soft"
        role="img"
        aria-label={income > 0 ? `Despesas consomem ${Math.round(spentShare * 100)}% das receitas` : "Sem receitas no mês"}
      >
        <span className={cn("block h-full rounded-full", net < 0 ? "bg-negative" : "bg-ink-3")} style={{ width: `${spentShare * 100}%` }} />
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="text-sm font-medium text-ink">{net >= 0 ? "Sobrou" : "Faltou"}</span>
        <Amount value={Math.abs(net)} hidden={hidden} className={cn("text-2xl font-semibold tracking-tight", net < 0 ? "text-negative" : "text-positive")} />
      </div>
      {pending > 0 && (
        <p className="mt-1 text-right text-2xs text-ink-3">
          inclui <Amount value={pending} hidden={hidden} /> ainda a pagar
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pede sua atenção: só o que exige uma ação, cada item leva direto para onde resolver. */

interface AttentionItem {
  key: string;
  icon: LucideIcon;
  tone: "negative" | "warning" | "neutral";
  text: string;
  detail?: string;
  href: string;
}

const DAY = 86_400_000;

export function attentionItems(data: Dashboard, budgets: Budget[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { commitments } = data;
  if (commitments.overdueCount > 0) {
    items.push({
      key: "overdue",
      icon: TriangleAlert,
      tone: "negative",
      text: `${commitments.overdueCount} ${commitments.overdueCount === 1 ? "conta vencida" : "contas vencidas"}`,
      detail: `${formatCurrency(commitments.overdueAmount)} em atraso`,
      href: "/lancamentos",
    });
  }

  const today = parseISODate(todayISO()).getTime();
  const soon = data.upcoming.filter((t) => {
    const diff = parseISODate(t.date).getTime() - today;
    return diff >= 0 && diff <= 7 * DAY;
  });
  if (soon.length > 0) {
    const total = soon.reduce((s, t) => s + toNumber(t.amount), 0);
    items.push({
      key: "soon",
      icon: CalendarClock,
      tone: "neutral",
      text: soon.length === 1 ? `${soon[0]!.description} vence nos próximos 7 dias` : `${soon.length} contas vencem nos próximos 7 dias`,
      detail: formatCurrency(total),
      href: "/lancamentos",
    });
  }

  for (const b of [...budgets].sort((a, z) => z.percent - a.percent)) {
    if (b.level !== "EXCEEDED" && b.level !== "WARNING") continue;
    const over = b.level === "EXCEEDED";
    items.push({
      key: `budget-${b.id}`,
      icon: Gauge,
      tone: over ? "negative" : "warning",
      text: over ? `Orçamento de ${b.category.name} estourou` : `${b.category.name} está em ${Math.round(b.percent)}% do limite`,
      detail: over
        ? `${formatCurrency(-toNumber(b.remaining))} acima do limite`
        : `restam ${formatCurrency(b.remaining)}`,
      href: "/orcamento",
    });
  }
  return items;
}

const toneClass = {
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-sunken text-ink-2",
};

export function AttentionCard({ items, hidden }: { items: AttentionItem[]; hidden: boolean }) {
  return (
    <Card>
      <CardHeader title="Pede sua atenção" description={items.length ? "O que vale resolver primeiro" : undefined} />
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-6 pt-2 sm:px-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-positive-soft text-positive">
            <CircleCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-ink-2">
            <span className="font-medium text-ink">Tudo em dia.</span> Nenhuma conta vencida nem orçamento perto do limite.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line px-2 pb-2 sm:px-3">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-surface-sunken">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", toneClass[i.tone])}>
                  <i.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{i.text}</span>
                  {i.detail && <span className="num block text-xs text-ink-3">{hidden ? "R$ ••••" : i.detail}</span>}
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Primeiros passos: o caminho até o painel fazer sentido, com o progresso visível. */

export interface SetupState {
  hasAccount: boolean;
  hasTransactions: boolean;
  hasBudget: boolean;
  hasGoal: boolean;
  hasReserve: boolean;
}

const STEPS: { key: keyof SetupState; icon: LucideIcon; title: string; why: string; href: string; cta: string }[] = [
  { key: "hasAccount", icon: Landmark, title: "Cadastre suas contas", why: "O saldo de cada banco vira a base do seu patrimônio.", href: "/contas", cta: "Adicionar conta" },
  { key: "hasTransactions", icon: ReceiptText, title: "Traga seus lançamentos", why: "Importe o extrato OFX/CSV do banco — leva menos de um minuto.", href: "/lancamentos/importar", cta: "Importar extrato" },
  { key: "hasBudget", icon: Gauge, title: "Defina um orçamento", why: "Limites por categoria, com aviso antes de estourar.", href: "/orcamento", cta: "Criar orçamento" },
  { key: "hasGoal", icon: Target, title: "Crie uma meta", why: "Diga quanto e até quando: calculamos quanto guardar por mês.", href: "/metas", cta: "Criar meta" },
  { key: "hasReserve", icon: Shield, title: "Configure sua reserva", why: "Saiba quantos meses de custo de vida estão protegidos.", href: "/reserva", cta: "Configurar" },
];

export function setupProgress(state: SetupState) {
  const done = STEPS.filter((s) => state[s.key]).length;
  return { done, total: STEPS.length, complete: done === STEPS.length };
}

export function GettingStarted({ state, onDismiss }: { state: SetupState; onDismiss?: () => void }) {
  const { done, total } = setupProgress(state);
  const next = STEPS.find((s) => !state[s.key]);
  return (
    <Card className="mb-8 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
        <div>
          <p className="text-2xs font-medium uppercase tracking-[0.12em] text-brass">Primeiros passos · {done} de {total}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
            {done === 0 ? "Vamos montar sua visão financeira" : "Falta pouco para seu painel ficar completo"}
          </h2>
          <p className="mt-1 text-sm text-ink-2">Cada passo leva um ou dois minutos. Você pode fazer na ordem que quiser.</p>
        </div>
        {onDismiss && (
          <IconButton label="Ocultar primeiros passos" size="icon-sm" onClick={onDismiss}>
            <X />
          </IconButton>
        )}
      </div>
      <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-surface-sunken sm:mx-6" aria-hidden>
        <span className="block h-full rounded-full bg-brass transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => {
          const complete = state[s.key];
          const isNext = s === next;
          return (
            <li key={s.key} className={cn("flex flex-col bg-surface p-5", isNext && "bg-brass-soft/40")}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    complete ? "bg-positive text-ink-inverse" : isNext ? "bg-ink text-ink-inverse" : "bg-surface-sunken text-ink-3",
                  )}
                >
                  {complete ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <s.icon className={cn("size-4", complete ? "text-ink-3" : "text-ink-2")} aria-hidden />
              </div>
              <p className={cn("mt-3 text-sm font-medium", complete ? "text-ink-3 line-through decoration-ink-3/40" : "text-ink")}>
                {s.title}
                {complete && <span className="sr-only"> (concluído)</span>}
              </p>
              <p className="mt-1 text-xs text-ink-2">{s.why}</p>
              {!complete && (
                <Link
                  href={s.href}
                  className={cn(
                    "mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium",
                    isNext ? "text-accent" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {s.cta} <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Convite para o conector do Claude: some quando a pessoa conecta ou fecha. */

export function ClaudePromo({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="relative mb-8 flex flex-col gap-4 overflow-hidden p-5 pr-12 sm:flex-row sm:items-center sm:p-6 sm:pr-14">
      <span aria-hidden className="bg-brass absolute inset-y-0 left-0 w-1" />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brass-soft text-brass">
        <MessagesSquare className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Novo: use o Lastro conversando com o Claude</p>
        <p className="text-sm text-ink-2">
          “Quanto gastei com delivery este mês?” “Lança R$ 48,90 de iFood no Nubank.” Conecte em 2 minutos.
        </p>
      </div>
      <Link href="/conectar-claude" className={buttonVariants({ variant: "secondary", className: "shrink-0" })}>
        Ver como conectar <ArrowRight aria-hidden />
      </Link>
      <IconButton label="Fechar convite" size="icon-sm" onClick={onDismiss} className="absolute right-3 top-3">
        <X />
      </IconButton>
    </Card>
  );
}
