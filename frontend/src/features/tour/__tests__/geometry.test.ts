import { GAP, MARGIN, centerSpot, holePath, placeCard, scrollDelta, tweenSpot } from "../geometry";

const viewport = { width: 1280, height: 800 };
const card = { width: 360, height: 200 };

describe("placeCard", () => {
  it("centraliza quando não há alvo", () => {
    expect(placeCard(null, card, viewport)).toEqual({ placement: "center", top: 300, left: 460 });
  });

  it("prefere abaixo do alvo, centralizado horizontalmente", () => {
    const pos = placeCard({ top: 100, left: 500, width: 200, height: 80 }, card, viewport);
    expect(pos).toEqual({ placement: "bottom", top: 180 + GAP, left: 420 });
  });

  it("vai para cima quando não cabe embaixo", () => {
    const pos = placeCard({ top: 600, left: 500, width: 200, height: 100 }, card, viewport);
    expect(pos.placement).toBe("top");
    expect(pos.top).toBe(600 - GAP - card.height);
  });

  it("respeita o lado preferido quando cabe", () => {
    const pos = placeCard({ top: 0, left: 0, width: 256, height: 800 }, card, viewport, "right");
    expect(pos).toMatchObject({ placement: "right", left: 256 + GAP });
  });

  it("nunca encosta na borda da tela", () => {
    const pos = placeCard({ top: 20, left: 1200, width: 40, height: 40 }, card, viewport);
    expect(pos.left).toBe(viewport.width - card.width - MARGIN);
  });

  it("flutua no rodapé quando o alvo ocupa a tela toda", () => {
    const pos = placeCard({ top: 60, left: 16, width: 343, height: 900 }, card, { width: 375, height: 812 });
    expect(pos).toMatchObject({ placement: "overlay", top: 812 - card.height - MARGIN });
  });
});

describe("scrollDelta", () => {
  const safe = { top: 88, bottom: 24 };

  it("não rola quando o alvo já está visível", () => {
    expect(scrollDelta({ top: 200, left: 0, width: 100, height: 100 }, 800, safe, 200)).toBe(0);
  });

  it("traz o alvo para a área útil deixando espaço para o card embaixo", () => {
    const delta = scrollDelta({ top: 1200, left: 0, width: 100, height: 100 }, 800, safe, 200);
    const newTop = 1200 - delta;
    expect(newTop).toBeGreaterThanOrEqual(safe.top);
    expect(newTop + 100 + GAP + 200).toBeLessThanOrEqual(800 - safe.bottom);
  });

  it("alinha pelo topo quando o alvo é maior que a tela", () => {
    expect(scrollDelta({ top: 1000, left: 0, width: 100, height: 2000 }, 800, safe, 200)).toBe(1000 - safe.top);
  });
});

describe("destaque", () => {
  it("desliza em direção ao alvo e encaixa quando chega perto", () => {
    const to = { rect: { top: 100, left: 200, width: 300, height: 80 }, radius: 16 };
    const half = tweenSpot(centerSpot(viewport), to, 0.5);
    expect(half.rect).toEqual({ top: 250, left: 420, width: 150, height: 40 });
    expect(tweenSpot({ rect: { top: 99.9, left: 200, width: 300, height: 80 }, radius: 16 }, to, 0.1)).toEqual(to);
  });

  it("vaza um retângulo arredondado na tela inteira", () => {
    const path = holePath({ width: 1280, height: 800 }, { rect: { top: 10, left: 20, width: 100, height: 40 }, radius: 30 });
    expect(path.startsWith("M0 0H1280V800H0Z")).toBe(true);
    // Raio limitado à metade da altura para não "estourar" o formato.
    expect(path).toContain("M40 10H100A20 20 0 0 1 120 30");
  });
});
