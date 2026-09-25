import { pctChange, shortMonth } from "../api";

describe("dashboard helpers", () => {
  it("variação percentual com 1 casa e base zero = null", () => {
    expect(pctChange(9150, 10900)).toBe(-16.1);
    expect(pctChange(100, 0)).toBeNull();
  });
  it("rótulo curto de mês sem ponto", () => {
    expect(shortMonth("2026-09")).toBe("set");
  });
});
