"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { AccountSelect, CategorySelect } from "@/features/transactions/components/entity-selects";
import { cn } from "@/lib/cn";
import { userMessage } from "@/services/api-error";
import type { ReportFilters, ReportKind } from "@/types/reports";
import { exportReport } from "../api";
import { monthsBetween, periodLabel, PRESETS, presetRange, type PresetKey } from "../period";
import { BudgetSection, CashFlowSection, CategoriesSection, GoalsSection, InvestmentsSection, NetWorthSection, TransactionsSection } from "./report-sections";

const KINDS: { key: ReportKind; label: string; uses: ("period" | "account" | "category")[] }[] = [
  { key: "cash-flow", label: "Fluxo de caixa", uses: ["period", "account", "category"] },
  { key: "categories", label: "Categorias", uses: ["period", "account"] },
  { key: "transactions", label: "Lançamentos", uses: ["period", "account", "category"] },
  { key: "budget", label: "Orçamento", uses: ["period"] },
  { key: "net-worth", label: "Patrimônio", uses: ["period"] },
  { key: "investments", label: "Investimentos", uses: [] },
  { key: "goals", label: "Metas", uses: [] },
];

export function ReportsView() {
  const [kind, setKind] = useState<ReportKind>("cash-flow");
  const [preset, setPreset] = useState<PresetKey>("last-6");
  const [custom, setCustom] = useState(() => presetRange("this-month"));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const range = preset === "custom" ? custom : presetRange(preset);
  const meta = KINDS.find((k) => k.key === kind)!;
  const filters: ReportFilters = {
    ...range,
    accountId: meta.uses.includes("account") ? accountId ?? undefined : undefined,
    categoryId: meta.uses.includes("category") ? categoryId ?? undefined : undefined,
  };
  const months = Math.min(60, Math.max(1, monthsBetween(range.from, range.to)));
  const validRange = range.from <= range.to;

  const exportQuery = (): Record<string, string | number | undefined> => {
    if (kind === "budget") return { fromMonth: range.from.slice(0, 7), toMonth: range.to.slice(0, 7) };
    if (kind === "net-worth") return { months };
    if (kind === "investments" || kind === "goals") return {};
    return { from: filters.from, to: filters.to, accountId: filters.accountId, categoryId: filters.categoryId };
  };

  const doExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      const name = await exportReport(kind, format, exportQuery());
      toast.success("Relatório exportado", { description: name });
    } catch (err) {
      toast.error(userMessage(err));
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Analise qualquer período e exporte em CSV (para planilhas) ou PDF (para guardar ou compartilhar)."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Relatórios" }]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button loading={exporting !== null} disabled={!validRange}><Download aria-hidden /> Exportar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void doExport("csv")}><FileSpreadsheet aria-hidden /> Planilha (CSV)</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void doExport("pdf")}><FileText aria-hidden /> Documento (PDF)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <nav aria-label="Tipo de relatório" className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-1.5">
          {KINDS.map((k) => (
            <li key={k.key}>
              <button type="button" aria-current={kind === k.key ? "page" : undefined} onClick={() => setKind(k.key)}
                className={cn("flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset transition-colors", kind === k.key ? "bg-ink text-ink-inverse ring-ink" : "bg-surface text-ink-2 ring-line hover:ring-line-strong")}>
                {k.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {meta.uses.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          {meta.uses.includes("period") && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-48">
                <Select value={preset} onValueChange={(v) => setPreset(v as PresetKey)}>
                  <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {preset === "custom" ? (
                <>
                  <Input type="date" aria-label="De" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="w-40" />
                  <span className="text-ink-3">–</span>
                  <Input type="date" aria-label="Até" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="w-40" aria-invalid={!validRange || undefined} />
                </>
              ) : (
                <span className="text-xs text-ink-3">{periodLabel(range.from, range.to)}</span>
              )}
            </div>
          )}
          <div className="flex flex-1 flex-wrap gap-2 lg:justify-end">
            {meta.uses.includes("account") && <div className="w-full sm:w-52"><AccountSelect aria-label="Conta" value={accountId} onChange={setAccountId} allLabel="Todas as contas" /></div>}
            {meta.uses.includes("category") && <div className="w-full sm:w-52"><CategorySelect aria-label="Categoria" type="EXPENSE" allowNone={false} allLabel="Todas categorias" value={categoryId} onChange={setCategoryId} /></div>}
          </div>
        </div>
      )}

      {!validRange ? (
        <p className="text-sm text-negative">A data inicial precisa ser anterior à final.</p>
      ) : (
        <div key={kind}>
          {kind === "cash-flow" && <CashFlowSection filters={filters} />}
          {kind === "categories" && <CategoriesSection filters={filters} />}
          {kind === "transactions" && <TransactionsSection filters={filters} />}
          {kind === "budget" && <BudgetSection fromMonth={range.from.slice(0, 7)} toMonth={range.to.slice(0, 7)} />}
          {kind === "net-worth" && <NetWorthSection months={months} />}
          {kind === "investments" && <InvestmentsSection />}
          {kind === "goals" && <GoalsSection />}
        </div>
      )}
    </>
  );
}
