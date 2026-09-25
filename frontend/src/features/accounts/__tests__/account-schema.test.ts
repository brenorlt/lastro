import { accountSchema } from "../schemas";

const base = { name: "Conta principal", institution: "", type: "CHECKING", initialBalance: "0", color: "#3F51D8", icon: "landmark", includeInNetWorth: true };

describe("accountSchema", () => {
  it("aceita saldo negativo (cheque especial)", () => {
    expect(accountSchema.safeParse({ ...base, initialBalance: "-150.00" }).success).toBe(true);
  });
  it("rejeita valor inválido e nome vazio", () => {
    const r = accountSchema.safeParse({ ...base, name: " ", initialBalance: "invalid" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["initialBalance", "name"]);
  });
});
