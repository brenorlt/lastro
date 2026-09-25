import { formatMoneyInput, parseMoneyInput } from "../money";

describe("parseMoneyInput", () => {
  it.each([
    ["1.234,56", "1234.56"],
    ["1234,5", "1234.50"],
    ["R$ 10", "10"],
    ["0,1", "0.10"],
    ["1.000", "1000"],
    ["12.5", "12.50"],
    ["-250,00", "-250.00"],
    ["", null],
    ["abc", null],
    ["1,234", null],
  ])("%s → %s", (input, expected) => {
    expect(parseMoneyInput(input)).toBe(expected);
  });
});

describe("formatMoneyInput", () => {
  it("formata com milhar e centavos", () => {
    expect(formatMoneyInput("1234567.5")).toBe("1.234.567,50");
    expect(formatMoneyInput("-20")).toBe("-20,00");
    expect(formatMoneyInput("")).toBe("");
  });
});
