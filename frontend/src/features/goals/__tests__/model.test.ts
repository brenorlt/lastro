import { monthsUntil, requiredMonthly } from "../model";

describe("goal math", () => {
  it("conta meses de calendário até o prazo (mínimo 1 no futuro)", () => {
    expect(monthsUntil("2027-05-24", "2026-09-24")).toBe(8);
    expect(monthsUntil("2026-09-30", "2026-09-24")).toBe(1);
    expect(monthsUntil("2026-09-01", "2026-09-24")).toBe(0);
  });

  it("aporte necessário arredonda para cima em centavos", () => {
    expect(requiredMonthly(20000, 12500, 8)).toBe(937.5);
    expect(requiredMonthly(100, 0, 3)).toBe(33.34);
    expect(requiredMonthly(100, 150, 3)).toBe(0);
    expect(requiredMonthly(100, 0, 0)).toBeNull();
  });
});
