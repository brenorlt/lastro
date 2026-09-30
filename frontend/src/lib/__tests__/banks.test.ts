import { BANKS, findBank, searchBanks } from "../banks";

const id = (s: string | null) => findBank(s)?.id ?? null;

describe("findBank", () => {
  it("reconhece nomes com acento, caixa e sufixos", () => {
    expect(id("Itaú Unibanco S.A.")).toBe("itau");
    expect(id("NUBANK")).toBe("nubank");
    expect(id("Banco Inter")).toBe("inter");
    expect(id("C6 Bank")).toBe("c6");
    expect(id("Caixa Econômica Federal")).toBe("caixa");
    expect(id("Mercado Pago")).toBe("mercado-pago");
  });

  it("aceita siglas como palavra inteira", () => {
    expect(id("BB")).toBe("banco-do-brasil");
    expect(id("Conta BB")).toBe("banco-do-brasil");
    expect(id("banco do brasil")).toBe("banco-do-brasil");
    expect(id("XP")).toBe("xp");
  });

  it("não casa apelidos dentro de outras palavras", () => {
    expect(id("Internacional")).toBeNull();
    expect(id("Panamericano")).toBeNull();
    expect(id("Carteira")).toBeNull();
  });

  it("retorna null sem instituição", () => {
    expect(id(null)).toBeNull();
    expect(id("   ")).toBeNull();
  });

  it("tem ids únicos", () => {
    expect(new Set(BANKS.map((b) => b.id)).size).toBe(BANKS.length);
  });
});

describe("searchBanks", () => {
  it("lista todos sem busca e filtra por início de palavra, sem acento", () => {
    expect(searchBanks("").length).toBe(BANKS.length);
    expect(searchBanks("ita").map((b) => b.id)).toEqual(["itau"]);
    expect(searchBanks("brasil").map((b) => b.id)).toContain("banco-do-brasil");
    expect(searchBanks("ank").map((b) => b.id)).toEqual([]);
    const ba = searchBanks("ba").map((b) => b.id);
    expect(ba.indexOf("banco-do-brasil")).toBeLessThan(ba.indexOf("c6"));
  });
});
