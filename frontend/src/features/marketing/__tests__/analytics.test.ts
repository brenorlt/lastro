import { isSectionInView, landingClickFor } from "../analytics";

describe("isSectionInView", () => {
  it("conta seção curta com metade visível", () => {
    expect(isSectionInView(0.5, 200, 800)).toBe(true);
    expect(isSectionInView(0.4, 160, 800)).toBe(false);
  });

  it("conta seção mais alta que a tela quando ocupa metade da tela", () => {
    // Seção de 2400px numa tela de 800px: nunca chega a 50% de si mesma.
    expect(isSectionInView(0.17, 400, 800)).toBe(true);
    expect(isSectionInView(0.1, 240, 800)).toBe(false);
  });

  it("não quebra sem altura de tela", () => {
    expect(isSectionInView(0.2, 100, 0)).toBe(false);
  });
});

describe("landingClickFor", () => {
  function link(html: string) {
    document.body.innerHTML = html;
    return document.body.firstElementChild as HTMLElement;
  }

  it("descreve o CTA com local, texto e rota limpa", () => {
    const el = link('<a href="/cadastro?utm=x" data-cta="hero">Testar grátis\n  por 7 dias <svg></svg></a>');
    expect(landingClickFor(el)).toEqual({
      event: "cta_click",
      params: { cta_location: "hero", cta_text: "Testar grátis por 7 dias", link_url: "/cadastro" },
    });
  });

  it("descreve o link de navegação pela seção de destino", () => {
    expect(landingClickFor(link('<a href="/#planos" data-nav="header">Planos</a>'))).toEqual({
      event: "nav_click",
      params: { nav_location: "header", section: "planos", link_text: "Planos" },
    });
  });

  it("ignora links sem marcação", () => {
    expect(landingClickFor(link('<a href="/entrar">Entrar</a>'))).toBeNull();
  });
});
