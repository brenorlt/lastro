"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Amount } from "@/components/finance/amount";
import { AccountIcon } from "@/components/finance/bank-logo";
import { IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { toNumber } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";
import type { Account } from "@/types/finance";
import { accountTypeLabel } from "../api";

interface AccountCardProps {
  account: Account;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export function AccountCard({ account, onEdit, onToggleArchive, onDelete }: AccountCardProps) {
  const hidden = useUiStore((s) => s.privacyMode);
  const negative = toNumber(account.currentBalance) < 0;
  const archived = account.status === "ARCHIVED";

  return (
    <Card className={cn("group relative flex flex-col gap-6 p-5 transition-shadow hover:shadow-md", archived && "opacity-75")}>
      <div className="flex items-start gap-3">
        <AccountIcon account={account} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-ink">
            <button type="button" onClick={onEdit} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent">
              {account.name}
            </button>
          </h3>
          <p className="truncate text-xs text-ink-3">{[account.institution, accountTypeLabel(account.type)].filter(Boolean).join(" · ")}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={`Ações de ${account.name}`} size="icon-sm" className="relative z-10 -mr-1.5 -mt-1">
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Editar</DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleArchive}>
              {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />} {archived ? "Reativar" : "Arquivar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onDelete}><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xs uppercase tracking-[0.08em] text-ink-3">Saldo atual</p>
          <Amount value={account.currentBalance} hidden={hidden} className={cn("mt-1 block text-xl font-semibold tracking-tight", negative ? "text-negative" : "text-ink")} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {archived && <Badge>Arquivada</Badge>}
          {!account.includeInNetWorth && <Badge tone="outline">Fora do patrimônio</Badge>}
        </div>
      </div>
    </Card>
  );
}
