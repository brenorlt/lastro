import { sanitizePath } from "@/lib/analytics";

/**
 * Seção "vista": metade dela na tela ou, se for mais alta que a tela, ocupando metade da tela
 * (senão seções longas nunca contariam no celular).
 */
export function isSectionInView(ratio: number, visibleHeight: number, viewportHeight: number): boolean {
  return ratio >= 0.5 || (viewportHeight > 0 && visibleHeight >= viewportHeight / 2);
}

export type LandingClick =
  | { event: "cta_click"; params: { cta_location: string; cta_text: string; link_url: string } }
  | { event: "nav_click"; params: { nav_location: string; section: string; link_text: string } };

/**
 * data-cta="hero" → cta_click (botões que levam ao cadastro) · data-nav="header" → nav_click
 * (links para seções). Só textos e rotas do próprio site, nada digitado pela pessoa.
 */
export function landingClickFor(el: HTMLElement): LandingClick | null {
  const href = el.getAttribute("href") ?? "";
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  const { cta, nav } = el.dataset;
  if (cta) return { event: "cta_click", params: { cta_location: cta, cta_text: text, link_url: sanitizePath(href) } };
  if (nav) {
    const hash = href.split("#")[1];
    return { event: "nav_click", params: { nav_location: nav, section: hash || sanitizePath(href), link_text: text } };
  }
  return null;
}
