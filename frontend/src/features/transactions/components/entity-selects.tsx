"use client";

import { EntityIcon } from "@/components/ui/entity-icon";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/api";
import { useCategories } from "@/features/categories/api";
import { useCards } from "@/features/cards/api";
import { CreditCard } from "lucide-react";
import type { CategoryType } from "@/types/finance";

const NONE = "__none__";
const iconCls = "size-6 rounded-[6px] [&_svg]:size-3.5";

interface BaseProps {
  value: string | null;
  onChange: (v: string | null) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function AccountSelect({ value, onChange, exclude, placeholder = "Escolha a conta", allLabel, ...aria }: BaseProps & { exclude?: string | null; placeholder?: string; allLabel?: string }) {
  const { data } = useAccounts("ACTIVE");
  const accounts = (data?.data ?? []).filter((a) => a.id !== exclude);
  return (
    <Select value={value ?? (allLabel ? NONE : undefined)} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger {...aria}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={NONE}>{allLabel}</SelectItem>}
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id} leading={<EntityIcon icon={a.icon} color={a.color} className={iconCls} />}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({ value, onChange, type, allowNone = true, allLabel, ...aria }: BaseProps & { type: CategoryType; allowNone?: boolean; allLabel?: string }) {
  const { data } = useCategories(type);
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger {...aria}><SelectValue placeholder="Escolha a categoria" /></SelectTrigger>
      <SelectContent>
        {(allowNone || allLabel) && <SelectItem value={NONE}>{allLabel ?? "Sem categoria"}</SelectItem>}
        {(data ?? []).map((c) => (
          <SelectGroup key={c.id}>
            <SelectItem value={c.id} leading={<EntityIcon icon={c.icon} color={c.color} className={iconCls} />}>
              {c.name}
            </SelectItem>
            {c.children?.map((s) => (
              <SelectItem key={s.id} value={s.id} className="pl-9" leading={<EntityIcon icon={s.icon} color={s.color} className={iconCls} />}>
                {s.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Forma de pagamento de despesas: contas (débito) e cartões (crédito) no mesmo seletor. */
export function PaymentSourceSelect({ accountId, creditCardId, onChange, ...aria }: {
  accountId: string | null;
  creditCardId: string | null;
  onChange: (v: { accountId: string | null; creditCardId: string | null }) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const accounts = useAccounts("ACTIVE").data?.data ?? [];
  const cards = useCards("ACTIVE").data?.data ?? [];
  const value = creditCardId ? `card:${creditCardId}` : accountId ? `acc:${accountId}` : undefined;
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const [kind, id] = v.split(":");
        onChange(kind === "card" ? { accountId: null, creditCardId: id ?? null } : { accountId: id ?? null, creditCardId: null });
      }}
    >
      <SelectTrigger {...aria}><SelectValue placeholder="Conta ou cartão" /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={`acc:${a.id}`} leading={<EntityIcon icon={a.icon} color={a.color} className={iconCls} />}>{a.name}</SelectItem>
          ))}
        </SelectGroup>
        {cards.length > 0 && (
          <SelectGroup>
            {cards.map((c) => (
              <SelectItem
                key={c.id}
                value={`card:${c.id}`}
                leading={<span aria-hidden className="flex size-6 items-center justify-center rounded-[6px] text-white" style={{ background: c.color }}><CreditCard className="size-3.5" /></span>}
              >
                {c.name}{c.lastFourDigits ? ` •••• ${c.lastFourDigits}` : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
