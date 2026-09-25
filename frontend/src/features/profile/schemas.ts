import { z } from "zod";
import { passwordRules } from "@/features/auth/schemas";

export const personalSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80, "Use no máximo 80 caracteres"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 ()-]{8,20}$/.test(v), "Telefone inválido. Ex.: +55 11 91234-5678"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: passwordRules,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "As senhas não coincidem" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Escolha uma senha diferente da atual" });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Informe sua senha"),
  confirmation: z.literal("EXCLUIR", { error: "Digite EXCLUIR para confirmar" }),
});

export type PersonalInput = z.infer<typeof personalSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const CURRENCIES = [
  { value: "BRL", label: "Real brasileiro (R$)" },
  { value: "USD", label: "Dólar americano (US$)" },
  { value: "EUR", label: "Euro (€)" },
] as const;

export const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
] as const;

export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (São Paulo, Rio, BH, Sul)" },
  { value: "America/Bahia", label: "Salvador" },
  { value: "America/Fortaleza", label: "Fortaleza" },
  { value: "America/Recife", label: "Recife" },
  { value: "America/Belem", label: "Belém" },
  { value: "America/Manaus", label: "Manaus" },
  { value: "America/Cuiaba", label: "Cuiabá" },
  { value: "America/Porto_Velho", label: "Porto Velho" },
  { value: "America/Rio_Branco", label: "Rio Branco" },
  { value: "America/Noronha", label: "Fernando de Noronha" },
  { value: "Europe/Lisbon", label: "Lisboa" },
  { value: "America/New_York", label: "Nova York" },
  { value: "Europe/London", label: "Londres" },
  { value: "UTC", label: "UTC" },
] as const;
