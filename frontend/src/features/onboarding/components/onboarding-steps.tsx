"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { InstitutionInput } from "@/components/finance/institution-input";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { OptionCards } from "@/components/ui/pickers";
import { useCategories } from "@/features/categories/api";
import { cn } from "@/lib/cn";
import { todayISO } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { GOALS, emergencyTarget, isMoney, type Answers } from "../model";

export interface StepProps {
  answers: Answers;
  set: (patch: Partial<Answers>) => void;
}

export function StepFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="animate-rise">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl leading-[1.1] tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-ink-2 sm:text-base">{description}</p>
      <div className="mt-8 space-y-5">{children}</div>
    </div>
  );
}

function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  return (
    <OptionCards<"YES" | "NO">
      label={label}
      value={value === null ? ("" as "YES") : value ? "YES" : "NO"}
      onChange={(v) => onChange(v === "YES")}
      options={[
        { value: "YES", label: "Sim" },
        { value: "NO", label: "Não" },
      ]}
    />
  );
}

export function IncomeStep({ answers, set }: StepProps) {
  return (
    <StepFrame eyebrow="1 · Renda" title="Qual é a sua renda média por mês?" description="Some salário, pró-labore, freelas e rendas fixas, já líquidos de impostos. Uma estimativa já basta.">
      <Field label="Renda mensal líquida">
        <MoneyInput autoFocus value={answers.monthlyIncome} onChange={(v) => set({ monthlyIncome: v })} className="h-12 text-lg" />
      </Field>
    </StepFrame>
  );
}

export function ExpensesStep({ answers, set }: StepProps) {
  const { data } = useCategories("EXPENSE");
  const toggle = (id: string) => {
    const has = answers.topExpenseCategoryIds.includes(id);
    if (!has && answers.topExpenseCategoryIds.length >= 5) return;
    set({ topExpenseCategoryIds: has ? answers.topExpenseCategoryIds.filter((x) => x !== id) : [...answers.topExpenseCategoryIds, id] });
  };
  return (
    <StepFrame eyebrow="2 · Despesas" title="Quanto você gasta por mês, e com o quê?" description="O total médio define sua reserva ideal. As categorias ajudam a priorizar seu orçamento.">
      <Field label="Gasto mensal médio">
        <MoneyInput autoFocus value={answers.monthlyExpenses} onChange={(v) => set({ monthlyExpenses: v })} className="h-12 text-lg" />
      </Field>
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">
          Principais despesas <span className="font-normal text-ink-3">· até 5, opcional</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(data ?? []).map((c) => {
            const on = answers.topExpenseCategoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full pl-1.5 pr-3.5 text-sm ring-1 ring-inset transition-colors",
                  on ? "bg-accent-soft text-ink ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-line-strong",
                )}
              >
                <EntityIcon icon={c.icon} color={c.color} className="size-7 rounded-full [&_svg]:size-3.5" />
                {c.name}
                {on && <Check className="size-3.5 text-accent" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>
    </StepFrame>
  );
}

export function CashStep({ answers, set }: StepProps) {
  return (
    <StepFrame eyebrow="3 · Hoje" title="Quanto você tem hoje em conta e em dinheiro?" description="Some o saldo das contas correntes, digitais e poupança. Investimentos vêm na próxima pergunta.">
      <Field label="Saldo disponível" hint="Pode ser negativo, se estiver no cheque especial.">
        <MoneyInput autoFocus allowNegative value={answers.cashBalance} onChange={(v) => set({ cashBalance: v })} className="h-12 text-lg" />
      </Field>
      <Field label="Banco principal" optional hint="Criaremos sua primeira conta com esse saldo. Você pode detalhar depois.">
        <InstitutionInput placeholder="Ex.: Itaú, Nubank" value={answers.institution} onChange={(v) => set({ institution: v })} />
      </Field>
    </StepFrame>
  );
}

export function InvestmentsStep({ answers, set }: StepProps) {
  return (
    <StepFrame eyebrow="4 · Investimentos" title="Você possui investimentos?" description="CDB, Tesouro, ações, fundos, previdência, cripto — o valor aproximado de tudo somado.">
      <YesNo label="Possui investimentos?" value={answers.hasInvestments} onChange={(v) => set({ hasInvestments: v })} />
      {answers.hasInvestments && (
        <Field label="Valor total investido hoje" hint="Na Fase de investimentos você poderá cadastrar cada ativo.">
          <MoneyInput autoFocus value={answers.investmentsTotal} onChange={(v) => set({ investmentsTotal: v })} />
        </Field>
      )}
    </StepFrame>
  );
}

export function DebtsStep({ answers, set }: StepProps) {
  return (
    <StepFrame eyebrow="5 · Dívidas" title="Você possui dívidas ou financiamentos?" description="Empréstimos, financiamento de imóvel ou carro, cheque especial recorrente. Fatura do cartão do mês não conta.">
      <YesNo label="Possui dívidas?" value={answers.hasDebts} onChange={(v) => set({ hasDebts: v })} />
      {answers.hasDebts && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Quanto ainda deve, no total">
            <MoneyInput autoFocus value={answers.debtsOutstanding} onChange={(v) => set({ debtsOutstanding: v })} />
          </Field>
          <Field label="Parcela mensal" optional>
            <MoneyInput value={answers.debtsMonthlyPayment} onChange={(v) => set({ debtsMonthlyPayment: v })} />
          </Field>
        </div>
      )}
    </StepFrame>
  );
}

export function GoalStep({ answers, set }: StepProps) {
  return (
    <StepFrame eyebrow="6 · Objetivo" title="Qual é o seu principal objetivo financeiro?" description="Escolha um para começar. Você poderá criar outras metas depois.">
      <OptionCards
        label="Objetivo principal"
        value={answers.goalCategory ?? ("" as "OTHER")}
        onChange={(v) => set({ goalCategory: v })}
        options={GOALS}
      />
      {answers.goalCategory && answers.goalCategory !== "EMERGENCY" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome da meta" optional className="sm:col-span-2">
            <Input placeholder={GOALS.find((g) => g.value === answers.goalCategory)?.label} value={answers.goalName} onChange={(e) => set({ goalName: e.target.value })} />
          </Field>
          <Field label="Quanto precisa" optional>
            <MoneyInput value={answers.goalTarget} onChange={(v) => set({ goalTarget: v })} />
          </Field>
          <Field label="Até quando" optional error={answers.goalDate && answers.goalDate <= todayISO() ? "Escolha uma data futura" : undefined}>
            <Input type="date" min={todayISO()} value={answers.goalDate} onChange={(e) => set({ goalDate: e.target.value })} />
          </Field>
        </div>
      )}
      {answers.goalCategory === "EMERGENCY" && (
        <p className="text-sm text-ink-2">Ótima escolha para começar. O valor da reserva é definido na próxima pergunta.</p>
      )}
    </StepFrame>
  );
}

export function EmergencyStep({ answers, set }: StepProps) {
  const target = emergencyTarget(answers.monthlyExpenses, answers.emergencyMonths);
  const presets = [3, 6, 9, 12];
  return (
    <StepFrame
      eyebrow="7 · Reserva"
      title="Quantos meses de reserva você quer construir?"
      description="A reserva de emergência cobre seu custo de vida em imprevistos. Especialistas costumam sugerir de 6 a 12 meses."
    >
      <div role="radiogroup" aria-label="Meses de reserva" className="grid grid-cols-4 gap-2">
        {presets.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={answers.emergencyMonths === m}
            onClick={() => set({ emergencyMonths: m })}
            className={cn(
              "flex h-16 flex-col items-center justify-center rounded-md ring-1 ring-inset transition-colors",
              answers.emergencyMonths === m ? "bg-accent-soft ring-2 ring-accent" : "bg-surface ring-line hover:ring-line-strong",
            )}
          >
            <span className="num text-xl font-semibold text-ink">{m}</span>
            <span className="text-2xs text-ink-3">meses</span>
          </button>
        ))}
      </div>
      <Field label="Outro número de meses">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={24}
          value={answers.emergencyMonths}
          onChange={(e) => set({ emergencyMonths: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })}
          className="w-32"
        />
      </Field>
      {isMoney(answers.monthlyExpenses) && (
        <p className="rounded-lg bg-surface-sunken px-4 py-3 text-sm text-ink-2">
          Com gasto de {formatCurrency(answers.monthlyExpenses)}/mês, sua reserva ideal é de{" "}
          <strong className="num font-semibold text-ink">{formatCurrency(target)}</strong>.
        </p>
      )}
    </StepFrame>
  );
}
