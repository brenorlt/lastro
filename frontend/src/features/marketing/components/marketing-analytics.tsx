"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { rememberSignupCta, track } from "@/lib/analytics";
import { isSectionInView, landingClickFor } from "../analytics";

/** Tempo mínimo na tela: quem só rola até o rodapé não "vê" todas as seções no caminho. */
const DWELL_MS = 1000;
const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10);

function inViewNow(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const visible = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return rect.height > 0 && isSectionInView(visible / rect.height, visible, window.innerHeight);
}

/**
 * A landing é uma página só, então page_view não diz o que foi visto. Aqui saem section_view
 * (uma por seção [data-section] por visita), cta_click ([data-cta]) e nav_click ([data-nav]).
 */
export function MarketingAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
    if (!sections.length) return;
    const timers = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const viewport = entry.rootBounds?.height ?? window.innerHeight;
          if (!isSectionInView(entry.intersectionRatio, entry.intersectionRect.height, viewport)) {
            window.clearTimeout(timers.get(el));
            timers.delete(el);
            continue;
          }
          if (timers.has(el)) continue;
          const timer = window.setTimeout(() => {
            timers.delete(el);
            // Com a página travada (celular fraco) o aviso de saída do observer atrasa: confere de novo.
            if (!inViewNow(el)) return;
            observer.unobserve(el);
            track("section_view", { section: el.dataset.section!, section_index: sections.indexOf(el) + 1 });
          }, DWELL_MS);
          timers.set(el, timer);
        }
      },
      { threshold: THRESHOLDS },
    );
    for (const section of sections) observer.observe(section);
    return () => {
      observer.disconnect();
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-cta], [data-nav]") : null;
      const click = el && landingClickFor(el);
      if (!click) return;
      if (click.event === "cta_click" && click.params.link_url === "/cadastro")
        rememberSignupCta(click.params.cta_location);
      track(click.event, click.params);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
