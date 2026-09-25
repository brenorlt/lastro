import { currencyParts, formatCurrency, formatPercent, toNumber } from "../format";

const nbsp = (s: string) => s.replace(/ /g, " ");

describe("format", () => {
  it("formata BRL com precisão de centavos a partir de string decimal", () => {
    expect(nbsp(formatCurrency("1520.4"))).toBe("R$ 1.520,40");
  });

  it("sinaliza valores quando signed", () => {
    expect(nbsp(formatCurrency(-50, { signed: true }))).toBe("-R$ 50,00");
    expect(nbsp(formatCurrency(50, { signed: true }))).toBe("+R$ 50,00");
  });

  it("trata entradas inválidas como zero", () => {
    expect(toNumber("abc")).toBe(0);
  });

  it("separa partes para composição tipográfica", () => {
    expect(currencyParts(228750.42)).toMatchObject({ symbol: "R$", integer: "228.750", decimal: ",", fraction: "42" });
  });

  it("formata percentuais em pt-BR", () => {
    expect(formatPercent(62.5)).toBe("62,5%");
  });
});
