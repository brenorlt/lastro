import { z } from "zod";

export const moneyString = (opts: { allowNegative?: boolean; required?: string } = {}) =>
  z
    .string()
    .min(1, opts.required ?? "Informe um valor")
    .refine((v) => v !== "invalid" && /^-?\d{1,15}(\.\d{1,2})?$/.test(v), "Valor inválido. Ex.: 1.250,00")
    .refine((v) => opts.allowNegative || !v.startsWith("-"), "O valor não pode ser negativo");

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à conta").max(60, "Use no máximo 60 caracteres"),
  institution: z.string().trim().max(60, "Use no máximo 60 caracteres"),
  type: z.enum(["CHECKING", "SAVINGS", "DIGITAL", "WALLET", "INVESTMENT", "OTHER"]),
  initialBalance: moneyString({ allowNegative: true, required: "Informe o saldo (use 0 se estiver zerada)" }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1),
  includeInNetWorth: z.boolean(),
});

export type AccountFormValues = z.infer<typeof accountSchema>;
