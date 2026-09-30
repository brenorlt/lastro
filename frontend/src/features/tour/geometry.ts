export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type Placement = "top" | "bottom" | "left" | "right";

/** Distância entre o destaque e o card, e respiro mínimo até a borda da tela. */
export const GAP = 14;
export const MARGIN = 16;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/**
 * Posiciona o card do tour ao redor do elemento em destaque: tenta o lado preferido,
 * depois embaixo, em cima, à direita e à esquerda. Sem alvo, centraliza; se nenhum lado
 * couber (alvo maior que a tela), o card flutua no rodapé por cima do destaque.
 */
export function placeCard(target: Rect | null, card: Size, viewport: Size, preferred?: Placement) {
  const maxLeft = viewport.width - card.width - MARGIN;
  const maxTop = viewport.height - card.height - MARGIN;
  if (!target) {
    return { placement: "center" as const, top: clamp((viewport.height - card.height) / 2, MARGIN, maxTop), left: clamp((viewport.width - card.width) / 2, MARGIN, maxLeft) };
  }

  const bottom = target.top + target.height;
  const right = target.left + target.width;
  const centerX = clamp(target.left + target.width / 2 - card.width / 2, MARGIN, maxLeft);
  const centerY = clamp(target.top + target.height / 2 - card.height / 2, MARGIN, maxTop);

  const options: Record<Placement, { fits: boolean; top: number; left: number }> = {
    bottom: { fits: bottom + GAP + card.height <= viewport.height - MARGIN, top: bottom + GAP, left: centerX },
    top: { fits: target.top - GAP - card.height >= MARGIN, top: target.top - GAP - card.height, left: centerX },
    right: { fits: right + GAP + card.width <= viewport.width - MARGIN, top: centerY, left: right + GAP },
    left: { fits: target.left - GAP - card.width >= MARGIN, top: centerY, left: target.left - GAP - card.width },
  };

  const order: Placement[] = [...(preferred ? [preferred] : []), "bottom", "top", "right", "left"];
  const placement = order.find((p) => options[p].fits);
  if (placement) return { placement, top: options[placement].top, left: options[placement].left };
  return { placement: "overlay" as const, top: Math.max(MARGIN, maxTop), left: centerX };
}

/** Quanto rolar a página para o alvo caber na área útil, deixando espaço para o card logo abaixo. */
export function scrollDelta(target: Rect, viewportHeight: number, safe: { top: number; bottom: number }, cardHeight: number) {
  const room = viewportHeight - safe.top - safe.bottom;
  if (target.top >= safe.top && target.top + target.height <= viewportHeight - safe.bottom) return 0;
  if (target.height + GAP + cardHeight <= room) return target.top - (safe.top + (room - target.height - GAP - cardHeight) / 2);
  if (target.height <= room) return target.top - (safe.top + (room - target.height) / 2);
  return target.top - safe.top;
}

export interface Spot {
  rect: Rect;
  radius: number;
}

/** Destaque "fechado" no centro da tela: estado inicial e passos sem alvo. */
export const centerSpot = (viewport: Size): Spot => ({ rect: { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0 }, radius: 0 });

/** Aproxima o destaque atual do alvo (k = fração do caminho neste frame); encaixa quando quase lá. */
export function tweenSpot(from: Spot, to: Spot, k: number): Spot {
  const step = (a: number, b: number) => (Math.abs(b - a) < 0.3 ? b : a + (b - a) * k);
  return {
    rect: { top: step(from.rect.top, to.rect.top), left: step(from.rect.left, to.rect.left), width: step(from.rect.width, to.rect.width), height: step(from.rect.height, to.rect.height) },
    radius: step(from.radius, to.radius),
  };
}

/** Caminho SVG (evenodd) da tela inteira com um retângulo arredondado vazado: o "furo" do scrim. */
export function holePath(viewport: Size, { rect, radius }: Spot) {
  const { top: y, left: x, width: w, height: h } = rect;
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const n = (v: number) => Math.round(v * 10) / 10;
  return [
    `M0 0H${n(viewport.width)}V${n(viewport.height)}H0Z`,
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}`,
    `H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`,
  ].join("");
}
