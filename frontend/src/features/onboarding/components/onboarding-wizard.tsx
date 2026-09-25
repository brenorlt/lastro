"use client";

import { ArrowLeft, ArrowRight, PiggyBank, Shield, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/brand/logo";
import { EstimateDisclaimer } from "@/components/finance/estimate-note";
import { Insight } from "@/components/finance/insight-card";
import { NetWorthHero } from "@/components/finance/net-worth-hero";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Card } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatPercent, toNumber } from "@/lib/format";
import { ApiError, userMessage } from "@/services/api-error";
import { onboardingApi, type OnboardingSummary } from "../api";
import { INITIAL_ANSWERS, canContinue, toInput, type Answers } from "../model";
import { CashStep, DebtsStep, EmergencyStep, ExpensesStep, GoalStep, IncomeStep, InvestmentsStep } from "./onboarding-steps";

const STEPS = [IncomeStep, ExpensesStep, CashStep, InvestmentsStep, DebtsStep, GoalStep, EmergencyStep];

function SummaryView({ summary }: { summary: OnboardingSummary }) {
  const assets = toNumber(summary.cash) + toNumber(summary.investments);
  return (
    <div className="animate-rise space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">Sua primeira visão financeira</p>
        <h1 className="mt-3 font-display text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">Este é o seu ponto de partida.</h1>
      </div>
      <NetWorthHero netWorth={summary.netWorth} assets={assets} liabilities={summary.debts} />
      <Card>
        <ul className="divide-y divide-line px-5 sm:px-6">
          {summary.savingsRate !== null && (
            <Insight icon={PiggyBank} tone={summary.savingsRate > 0 ? "positive" : "warning"} basis="(renda − despesas) ÷ renda">
              Sua taxa de poupança estimada é de <strong>{formatPercent(summary.savingsRate)}</strong>
              {toNumber(summary.monthlySurplus) > 0 ? <> — sobram cerca de <strong>{formatCurrency(summary.monthlySurplus)}</strong> por mês.</> : "."}
            </Insight>
          )}
          <Insight icon={Shield} tone={summary.emergencyCoverageMonths !== null && summary.emergencyCoverageMonths >= 6 ? "positive" : "neutral"} basis={`Reserva ideal: ${formatCurrency(summary.emergencyTarget)}`}>
            {summary.emergencyCoverageMonths === null
              ? "Informe suas despesas para calcular a cobertura da reserva."
              : <>Seu saldo atual cobre aproximadamente <strong>{summary.emergencyCoverageMonths.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses</strong> do seu custo de vida.</>}
          </Insight>
          {summary.goalMonthlyContribution && (
            <Insight icon={Target} basis="valor que falta ÷ meses até o prazo">
              Para chegar à sua meta no prazo, guarde cerca de <strong>{formatCurrency(summary.goalMonthlyContribution)}/mês</strong>.
            </Insight>
          )}
        </ul>
      </Card>
      <EstimateDisclaimer />
      <Link href="/painel" className={buttonVariants({ size: "lg" })}>
        Ir para o painel <ArrowRight aria-hidden />
      </Link>
    </div>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);

  const Step = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const ready = canContinue(step, answers);
  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));

  const next = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    if (!last) return setStep((s) => s + 1);
    setSubmitting(true);
    setError(null);
    try {
      setSummary(await onboardingApi.complete(toInput(answers)));
    } catch (err) {
      if (err instanceof ApiError && err.code === "ONBOARDING_ALREADY_COMPLETED") {
        toast.info("Seu onboarding já foi concluído.");
        return router.replace("/painel");
      }
      setError(userMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    setSkipping(true);
    try {
      await onboardingApi.skip();
    } catch {
      // Sem bloqueio: pular nunca deve prender a pessoa aqui.
    } finally {
      router.replace("/painel");
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-10 pt-6 sm:pt-10">
      <header className="flex items-center justify-between">
        <Logo />
        {!summary && (
          <Button variant="ghost" size="sm" onClick={() => void skip()} loading={skipping}>
            Pular por agora
          </Button>
        )}
      </header>

      {summary ? (
        <div className="py-12">
          <SummaryView summary={summary} />
        </div>
      ) : (
        <form onSubmit={(e) => void next(e)} className="flex flex-1 flex-col py-10" noValidate>
          <div className="mb-10 flex items-center gap-3">
            <Progress value={step + 1} max={STEPS.length} size="sm" label="Progresso do onboarding" />
            <span className="num shrink-0 text-xs text-ink-3">{step + 1} de {STEPS.length}</span>
          </div>

          <div key={step} className="flex-1">
            <Step answers={answers} set={set} />
          </div>

          {error && <FormAlert className="mt-6">{error}</FormAlert>}

          <div className="mt-10 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft aria-hidden /> Voltar
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" disabled={!ready} loading={submitting}>
              {last ? "Gerar minha visão" : "Continuar"} {!last && <ArrowRight aria-hidden />}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
