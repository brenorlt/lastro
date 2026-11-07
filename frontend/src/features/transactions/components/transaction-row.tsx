"use client";

import { ArrowLeftRight, Check, Copy, MoreHorizontal, Pencil, Repeat, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Amount } from "@/components/finance/amount";
import { IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { isFuture } from "@/lib/dates";
import type { Transaction } from "@/types/finance";
import { PaymentStatusBadge } from "./payment-status";

interface RowProps {
  transaction: Transaction;
  hidden: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onConfirmCategory: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function subtitle(t: Transaction) {
  if (t.type === "TRANSFER") {
    const other = t.description.startsWith("Pagamento:") ? "Dívida" : "Investimento";
    return `${t.account?.name ?? other} → ${t.transferAccount?.name ?? t.creditCard?.name ?? other}`;
  }
  return [t.category?.name ?? "Sem categoria", t.account?.name ?? (t.creditCard && `${t.creditCard.name} (crédito)`)].filter(Boolean).join(" · ");
}

export function TransactionRow({ transaction: t, hidden, onEdit, onToggle, onConfirmCategory, onDuplicate, onDelete }: RowProps) {
  const autoCategory = t.categoryAuto && t.category;
  const pending = t.status === "PENDING";
  const flow = t.type === "INCOME" ? "income" : t.type === "EXPENSE" ? "expense" : "neutral";
  const confirmLabel = t.type === "INCOME" ? "Marcar como recebido" : t.type === "TRANSFER" ? "Confirmar transferência" : "Marcar como pago";
  // Compras no cartão não têm "pago/pendente": quem se paga é a fatura.
  const canToggleCleared = pending && !t.creditCard;
  // O botão rápido na linha só aparece quando já é possível confirmar (hoje ou atrasado);
  // no menu "..." a ação fica sempre disponível, mesmo para agendados no futuro.
  const canConfirm = canToggleCleared && !isFuture(t.date);

  return (
    <div className="group relative flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken/60 sm:px-5">
      {t.type === "TRANSFER" ? (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-2">
          <ArrowLeftRight className="size-[18px]" strokeWidth={1.8} />
        </span>
      ) : (
        <EntityIcon icon={t.category?.icon ?? "ellipsis"} color={t.category?.color ?? "#64748B"} />
      )}

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className="block max-w-full truncate text-left text-sm font-medium text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-accent"
        >
          {t.description}
        </button>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
          <span className="truncate">{subtitle(t)}</span>
          {autoCategory && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] bg-accent-soft px-1.5 text-2xs text-accent" title="Categoria escolhida automaticamente">
              <Sparkles className="size-2.5" aria-hidden />
              <span>auto<span className="sr-only">: categoria escolhida automaticamente</span></span>
            </span>
          )}
          {t.installment && <span className="num shrink-0 rounded-[4px] bg-surface-sunken px-1.5 text-2xs text-ink-2">{t.installment.number}/{t.installment.total}</span>}
          {t.recurring && <Repeat className="size-3 shrink-0" aria-label="Recorrente" />}
          {t.tags.length > 0 && <span className="hidden truncate sm:inline">· {t.tags.map((x) => `#${x.name}`).join(" ")}</span>}
          {!t.creditCard && <PaymentStatusBadge transaction={t} className="shrink-0" />}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-2">
        <Amount
          value={t.amount}
          flow={flow}
          hidden={hidden}
          className={cn("min-w-24 text-right text-sm font-semibold", pending && "text-ink-3", t.type === "TRANSFER" && "text-ink-2")}
        />
        {canConfirm ? (
          <Tooltip content={confirmLabel}>
            <IconButton
              label={confirmLabel}
              size="icon"
              variant="secondary"
              className="text-positive hover:text-positive sm:size-8 sm:rounded-sm"
              onClick={onToggle}
            >
              <Check />
            </IconButton>
          </Tooltip>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              label={`Ações de ${t.description}`}
              size="icon"
              className="sm:size-8 sm:rounded-sm sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-[state=open]:opacity-100"
            >
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Editar</DropdownMenuItem>
            {!pending && !t.creditCard && <DropdownMenuItem onSelect={onToggle}><Undo2 aria-hidden /> Marcar como pendente</DropdownMenuItem>}
            {canToggleCleared && (
              <DropdownMenuItem onSelect={onToggle} className="[&_svg]:text-positive">
                <Check aria-hidden /> {confirmLabel}
              </DropdownMenuItem>
            )}
            {autoCategory && (
              <DropdownMenuItem onSelect={onConfirmCategory}>
                <Sparkles aria-hidden /> Confirmar categoria ({t.category?.name})
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onDuplicate}><Copy aria-hidden /> Duplicar para hoje</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
