"use client";

import { useEffect } from "react";

/** Sem nenhum evento de rolagem (âncora já na tela), desliga depois disso. */
const NO_SCROLL_RELEASE_MS = 5000;
/** A rolagem suave dispara `scroll` a cada quadro: esse silêncio significa que ela terminou. */
const SCROLL_IDLE_MS = 250;

/**
 * Seções com .defer-render (content-visibility: auto) entram no layout com altura estimada.
 * Num salto para âncora, as que passam pela tela no caminho ganham a altura real e empurram o
 * alvo: o clique no menu parava centenas de pixels antes ou depois da seção.
 *
 * Correção: no clique (fase de captura, antes da rolagem nativa) ou ao abrir a página já com
 * #âncora, renderiza tudo até a rolagem terminar, para ela ser calculada com as alturas reais.
 * Ao religar o adiamento, cada seção fica com a altura medida como estimativa (ver release).
 */
export function AnchorScrollFix() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: number | undefined;

    const release = () => {
      if (!("renderAll" in root.dataset)) return;
      // O Chrome não grava a "última altura" (contain-intrinsic-size: auto) enquanto a seção está
      // forçada a visible: sem isto, ao religar o adiamento ela volta aos 900px estimados e o
      // alvo pula centenas de pixels. Fixa a altura medida agora como estimativa de cada uma.
      // contain-intrinsic-size é o tamanho do conteúdo: padding e borda somam por fora.
      const sections = Array.from(document.querySelectorAll<HTMLElement>(".defer-render"));
      const contentHeights = sections.map((el) => {
        const cs = getComputedStyle(el);
        const box = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"] as const;
        return box.reduce((h, prop) => h - parseFloat(cs[prop]), el.offsetHeight);
      });
      sections.forEach((el, i) => (el.style.containIntrinsicSize = `auto ${contentHeights[i]}px`));
      delete root.dataset.renderAll;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
    // Não usa `scrollend`: ainda falta em parte dos Safaris, e o silêncio de `scroll` resolve igual.
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(release, SCROLL_IDLE_MS);
    };
    const renderAll = () => {
      root.dataset.renderAll = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(release, NO_SCROLL_RELEASE_MS);
      window.addEventListener("scroll", onScroll, { passive: true });
    };
    const targetOf = (hash: string) =>
      hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[href*='#']");
      if (!link || link.target === "_blank") return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      if (targetOf(url.hash)) renderAll();
    };

    // Página aberta já com #âncora (ex.: /#planos vindo de outra página): refaz o salto com as alturas reais.
    const initial = targetOf(location.hash);
    if (initial) {
      renderAll();
      initial.scrollIntoView({ behavior: "instant", block: "start" });
    }

    // # trocado sem clique (barra de endereço, voltar/avançar): o navegador já rolou com as
    // alturas estimadas, então refaz o salto. Num clique, renderAll já está ligado: nada a fazer.
    const onHashChange = () => {
      const target = targetOf(location.hash);
      if (!target || "renderAll" in root.dataset) return;
      renderAll();
      target.scrollIntoView({ block: "start" });
    };

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("hashchange", onHashChange);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("hashchange", onHashChange);
      release();
    };
  }, []);

  return null;
}
