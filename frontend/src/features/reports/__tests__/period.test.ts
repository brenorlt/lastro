import { monthsBetween, presetRange } from "../period";

describe("report periods", () => {
  const today = new Date(2026, 8, 24);
  it("presets cobrem meses de calendário completos", () => {
    expect(presetRange("this-month", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(presetRange("last-month", today)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(presetRange("last-3", today)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(presetRange("last-12", today)).toEqual({ from: "2025-10-01", to: "2026-09-30" });
    expect(presetRange("last-year", today)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });
  it("vira o ano em janeiro", () => {
    expect(presetRange("last-month", new Date(2027, 0, 10))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("conta meses inclusivos", () => {
    expect(monthsBetween("2026-07-01", "2026-09-30")).toBe(3);
    expect(monthsBetween("2025-10-01", "2026-09-30")).toBe(12);
  });
});
