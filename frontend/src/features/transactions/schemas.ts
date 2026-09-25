import { z } from "zod";
import { moneyString } from "@/features/accounts/schemas";
import type { ComposerMode } from "@/stores/composer-store";
import type { RepeatInput, Transaction, TransactionInput, TransferInput } from "@/types/finance";

export const composerSchema = z
  .object({
    mode: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
    amount: moneyString({ required: "Informe o valor" }).refine((v) => v === "invalid" || Number(v) > 0, "O valor deve ser maior que zero"),
    description: z.string().trim().max(120, "Use no máximo 120 caracteres"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
    paid: z.boolean(),
    accountId: z.string().nullable(),
    creditCardId: z.string().nullable(),
    toAccountId: z.string().nullable(),
    categoryId: z.string().nullable(),
    tags: z.array(z.string()).max(10),
    notes: z.string().max(500, "Use no máximo 500 caracteres"),
    repeat: z.enum(["NONE", "INSTALLMENTS", "RECURRING"]),
    installments: z.number().int().min(2, "Mínimo de 2 parcelas").max(60, "Máximo de 60 parcelas"),
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    endDate: z.string(),
    autoConfirm: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const hasSource = v.mode === "EXPENSE" ? Boolean(v.accountId || v.creditCardId) : Boolean(v.accountId);
    if (!hasSource) ctx.addIssue({ code: "custom", path: ["accountId"], message: v.mode === "TRANSFER" ? "Escolha a conta de origem" : v.mode === "EXPENSE" ? "Escolha a conta ou o cartão" : "Escolha a conta" });
    if (v.mode === "TRANSFER") {
      if (!v.toAccountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha a conta de destino" });
      else if (v.toAccountId === v.accountId) ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha uma conta diferente da origem" });
    } else if (!v.description) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Descreva o lançamento" });
    }
    if (v.repeat === "RECURRING" && v.endDate && v.endDate < v.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O término deve ser depois da primeira data" });
    }
  });

export type ComposerValues = z.infer<typeof composerSchema>;

export function emptyComposer(mode: ComposerMode, date: string, accountId: string | null): ComposerValues {
  return {
    mode,
    amount: "",
    description: "",
    date,
    paid: true,
    accountId,
    creditCardId: null,
    toAccountId: null,
    categoryId: null,
    tags: [],
    notes: "",
    repeat: "NONE",
    installments: 2,
    frequency: "MONTHLY",
    endDate: "",
    autoConfirm: false,
  };
}

export function fromTransaction(t: Transaction): ComposerValues {
  return {
    mode: t.type,
    amount: t.amount,
    description: t.description,
    date: t.date,
    paid: t.status === "CLEARED",
    accountId: t.account?.id ?? null,
    creditCardId: t.creditCard?.id ?? null,
    toAccountId: t.transferAccount?.id ?? null,
    categoryId: t.category?.id ?? null,
    tags: t.tags.map((x) => x.name),
    notes: t.notes ?? "",
    repeat: "NONE",
    installments: 2,
    frequency: t.recurring?.frequency ?? "MONTHLY",
    endDate: t.recurring?.endDate ?? "",
    autoConfirm: false,
  };
}

function repeatOf(v: ComposerValues): RepeatInput | undefined {
  if (v.repeat === "INSTALLMENTS") return { kind: "INSTALLMENTS", count: v.installments };
  if (v.repeat === "RECURRING") {
    return { kind: "RECURRING", frequency: v.frequency, endDate: v.endDate || undefined, autoConfirm: v.autoConfirm };
  }
  return undefined;
}

/** Futuro nunca é "pago": vira pendente automaticamente (regra da API). */
export function statusOf(v: ComposerValues, today: string) {
  return v.date > today ? "PENDING" : v.paid ? "CLEARED" : "PENDING";
}

export function toTransactionInput(v: ComposerValues, today: string): TransactionInput {
  return {
    type: v.mode as "INCOME" | "EXPENSE",
    amount: v.amount,
    description: v.description.trim(),
    date: v.date,
    status: statusOf(v, today),
    ...(v.mode === "EXPENSE" && v.creditCardId ? { creditCardId: v.creditCardId, accountId: null } : { accountId: v.accountId!, creditCardId: null }),
    categoryId: v.categoryId,
    notes: v.notes.trim() || null,
    tags: v.tags,
    repeat: repeatOf(v),
  };
}

export function toTransferInput(v: ComposerValues, today: string): TransferInput {
  return {
    fromAccountId: v.accountId!,
    toAccountId: v.toAccountId!,
    amount: v.amount,
    date: v.date,
    description: v.description.trim() || undefined,
    status: statusOf(v, today),
    notes: v.notes.trim() || null,
  };
}
