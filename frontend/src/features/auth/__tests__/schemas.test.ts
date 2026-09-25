import { loginSchema, registerSchema, resetPasswordSchema } from "../schemas";

describe("auth schemas", () => {
  it("rejeita e-mail inválido no login", () => {
    const r = loginSchema.safeParse({ email: "nao-e-email", password: "x" });
    expect(r.success).toBe(false);
  });

  it("exige senha forte e aceite de termos no cadastro", () => {
    const weak = registerSchema.safeParse({ name: "Ana", email: "ana@exemplo.com", password: "curta", acceptTerms: true });
    expect(weak.success).toBe(false);
    const noTerms = registerSchema.safeParse({ name: "Ana", email: "ana@exemplo.com", password: "senhaforte123", acceptTerms: false });
    expect(noTerms.success).toBe(false);
    const ok = registerSchema.safeParse({ name: "Ana", email: "ana@exemplo.com", password: "senhaforte123", acceptTerms: true });
    expect(ok.success).toBe(true);
  });

  it("aponta divergência de confirmação no campo confirm", () => {
    const r = resetPasswordSchema.safeParse({ password: "senhaforte123", confirm: "outra123456" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});
