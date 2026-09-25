"use client";

import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currentMonth, monthLabel, shiftMonth, type MonthRef } from "@/lib/dates";
import type { TransactionStatus, TransactionType } from "@/types/finance";
import { AccountSelect, CategorySelect } from "./entity-selects";

export function MonthNavigator({ value, onChange }: { value: MonthRef; onChange: (m: MonthRef) => void }) {
  const now = currentMonth();
  const isCurrent = value.year === now.year && value.month === now.month;
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Mês anterior" variant="secondary" size="icon-sm" onClick={() => onChange(shiftMonth(value, -1))}><ChevronLeft /></IconButton>
      <h2 className="min-w-40 text-center text-base font-semibold text-ink" aria-live="polite">{monthLabel(value)}</h2>
      <IconButton label="Próximo mês" variant="secondary" size="icon-sm" onClick={() => onChange(shiftMonth(value, 1))}><ChevronRight /></IconButton>
      {!isCurrent && <Button variant="ghost" size="sm" onClick={() => onChange(now)}>Hoje</Button>}
    </div>
  );
}

export interface ListFilters {
  q: string;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  status?: TransactionStatus;
}

const ALL = "__all__";

export function FiltersBar({ value, onChange }: { value: ListFilters; onChange: (f: ListFilters) => void }) {
  const active = Boolean(value.q || value.type || value.accountId || value.categoryId || value.status);
  const categoryType = value.type === "INCOME" ? "INCOME" : "EXPENSE";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <Tabs value={value.type ?? ALL} onValueChange={(t) => onChange({ ...value, type: t === ALL ? undefined : (t as TransactionType), categoryId: undefined })}>
        <TabsList aria-label="Tipo">
          <TabsTrigger value={ALL}>Todos</TabsTrigger>
          <TabsTrigger value="EXPENSE">Despesas</TabsTrigger>
          <TabsTrigger value="INCOME">Receitas</TabsTrigger>
          <TabsTrigger value="TRANSFER">Transferências</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:justify-end">
        <div className="col-span-2 sm:col-span-4 lg:w-64">
          <Input
            type="search"
            aria-label="Buscar lançamentos"
            placeholder="Buscar descrição ou observação"
            value={value.q}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
            leading={<Search />}
          />
        </div>
        <div className="lg:w-44">
          <AccountSelect aria-label="Filtrar por conta" value={value.accountId ?? null} onChange={(id) => onChange({ ...value, accountId: id ?? undefined })} allLabel="Todas as contas" />
        </div>
        {value.type !== "TRANSFER" && (
          <div className="lg:w-44">
            <CategorySelect aria-label="Filtrar por categoria" type={categoryType} allowNone={false} allLabel="Todas categorias" value={value.categoryId ?? null} onChange={(id) => onChange({ ...value, categoryId: id ?? undefined })} />
          </div>
        )}
        <div className="lg:w-36">
          <Select value={value.status ?? ALL} onValueChange={(s) => onChange({ ...value, status: s === ALL ? undefined : (s as TransactionStatus) })}>
            <SelectTrigger aria-label="Filtrar por situação"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas situações</SelectItem>
              <SelectItem value="CLEARED">Efetivados</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {active && (
          <Button variant="ghost" onClick={() => onChange({ q: "" })} className="col-span-2 sm:col-span-4 lg:col-span-1">
            <X aria-hidden /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
