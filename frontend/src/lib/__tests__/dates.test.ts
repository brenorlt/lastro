import { dayLabel, monthRange, parseISODate, shiftMonth, toISODate } from "../dates";

describe("dates", () => {
  afterEach(() => vi.useRealTimers());

  it("intervalo do mês inclui o último dia, inclusive fevereiro bissexto", () => {
    expect(monthRange({ year: 2028, month: 1 })).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange({ year: 2026, month: 11 })).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("vira o ano ao navegar entre meses", () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("não sofre deslocamento de fuso ao converter", () => {
    expect(toISODate(parseISODate("2026-03-01"))).toBe("2026-03-01");
  });

  it("rotula hoje, ontem e amanhã", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 10));
    expect(dayLabel("2026-09-24")).toBe("Hoje");
    expect(dayLabel("2026-09-23")).toBe("Ontem");
    expect(dayLabel("2026-09-25")).toBe("Amanhã");
  });
});
