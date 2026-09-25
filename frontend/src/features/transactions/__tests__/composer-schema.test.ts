import { composerSchema, emptyComposer, statusOf, toTransactionInput, toTransferInput } from "../schemas";

const base = () => ({ ...emptyComposer("EXPENSE", "2026-09-24", "acc-1"), amount: "120.50", description: "Mercado" });

describe("composer schema", () => {
  it("despesa válida vira input da API com status efetivado", () => {
    const v = composerSchema.parse(base());
    expect(toTransactionInput(v, "2026-09-24")).toMatchObject({ type: "EXPENSE", amount: "120.50", status: "CLEARED", accountId: "acc-1" });
  });

  it("data futura é sempre pendente, mesmo marcada como paga", () => {
    const v = composerSchema.parse({ ...base(), date: "2026-10-05", paid: true });
    expect(statusOf(v, "2026-09-24")).toBe("PENDING");
  });

  it("valor zero e descrição vazia são recusados", () => {
    const r = composerSchema.safeParse({ ...base(), amount: "0", description: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["amount", "description"]);
  });

  it("transferência exige contas diferentes e dispensa descrição", () => {
    const same = composerSchema.safeParse({ ...base(), mode: "TRANSFER", description: "", toAccountId: "acc-1" });
    expect(same.success).toBe(false);
    expect(same.error?.issues[0]?.path).toEqual(["toAccountId"]);
    const ok = composerSchema.parse({ ...base(), mode: "TRANSFER", description: "", toAccountId: "acc-2" });
    expect(toTransferInput(ok, "2026-09-24")).toMatchObject({ fromAccountId: "acc-1", toAccountId: "acc-2", description: undefined });
  });

  it("parcelado envia o total e o número de parcelas", () => {
    const v = composerSchema.parse({ ...base(), amount: "1000.00", repeat: "INSTALLMENTS", installments: 10 });
    expect(toTransactionInput(v, "2026-09-24").repeat).toEqual({ kind: "INSTALLMENTS", count: 10 });
  });

  it("recorrente não pode terminar antes de começar", () => {
    const r = composerSchema.safeParse({ ...base(), repeat: "RECURRING", endDate: "2026-01-01" });
    expect(r.success).toBe(false);
  });
});
