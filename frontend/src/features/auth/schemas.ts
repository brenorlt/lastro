import { z } from "zod";

const email = z.string().trim().min(1, "Informe seu e-mail").email("E-mail inválido").max(254);

export const passwordRules = z
  .string()
  .min(10, "Use pelo menos 10 caracteres")
  .max(128, "Use no máximo 128 caracteres")
  .regex(/[A-Za-z]/, "Inclua pelo menos uma letra")
  .regex(/\d/, "Inclua pelo menos um número");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  email,
  password: passwordRules,
  acceptTerms: z.literal(true, { error: "É preciso aceitar os termos para continuar" }),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: passwordRules, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não coincidem" });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
