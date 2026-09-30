"use client";

import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useComposer } from "@/stores/composer-store";
import { centerSpot, holePath, placeCard, scrollDelta, tweenSpot, type Size, type Spot } from "../geometry";
import { TOUR_STEPS } from "../steps";
import { useTour } from "../store";

/** Respiro entre o elemento e a borda do destaque. */
const PAD = 8;
/** Tempo máximo esperando o alvo aparecer (ex.: painel ainda carregando) antes de pular o passo. */
const TARGET_TIMEOUT = 2500;

interface Layout {
  spot: Spot | null;
  viewport: Size;
  card: Size;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function isVisible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return el.isConnected && r.width > 0 && r.height > 0;
}

/** O mesmo alvo pode existir em mais de um lugar (desktop/mobile): vale o visível. */
function findTarget(id: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)].find(isVisible) ?? null;
}

/** Header, sidebar, tab bar e FAB ficam sempre na tela: rolar a página não os aproxima. */
function isPinned(el: HTMLElement) {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const { position } = getComputedStyle(node);
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

function spotFor(el: HTMLElement, radius: number): Spot {
  const r = el.getBoundingClientRect();
  return { rect: { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }, radius };
}

/** Acompanha o arredondamento do alvo; wrappers sem borda herdam o do primeiro filho (ex.: um Card). */
function radiusFor(el: HTMLElement) {
  const of = (node: Element | null) => (node ? parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0 : 0);
  return Math.max(10, (of(el) || of(el.firstElementChild)) + PAD);
}

const close = (a: number, b: number) => Math.abs(a - b) < 0.5;
function sameLayout(a: Layout | null, b: Layout) {
  if (!a) return false;
  const rects = a.spot && b.spot
    ? close(a.spot.rect.top, b.spot.rect.top) && close(a.spot.rect.left, b.spot.rect.left) && close(a.spot.rect.width, b.spot.rect.width) && close(a.spot.rect.height, b.spot.rect.height)
    : a.spot === b.spot;
  return rects && a.viewport.width === b.viewport.width && a.viewport.height === b.viewport.height && a.card.width === b.card.width && a.card.height === b.card.height;
}

/**
 * Tour guiado estilo "coach mark" de jogos: escurece a tela e recorta só o bloco da vez,
 * com um card explicando o que ele faz. Montado no AppShell; roda apenas no painel.
 */
export function ProductTour() {
  const active = useTour((s) => s.active);
  const pathname = usePathname();
  if (!active || pathname !== "/painel") return null;
  return createPortal(<TourOverlay />, document.body);
}

function TourOverlay() {
  const index = useTour((s) => s.step);
  const direction = useTour((s) => s.direction);
  const go = useTour((s) => s.go);
  const stop = useTour((s) => s.stop);
  const openNew = useComposer((s) => s.openNew);

  const step = TOUR_STEPS[index]!;
  const first = index === 0;
  const last = index === TOUR_STEPS.length - 1;

  const cardRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  /** Para onde o destaque está indo; o loop de pintura persegue esse alvo a cada frame. */
  const goalRef = useRef<Spot | null>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [found, setFound] = useState<{ index: number; el: HTMLElement | null } | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const ready = found?.index === index;
  const target = ready ? found.el : null;

  const next = useCallback(() => (last ? stop() : go(index + 1)), [go, index, last, stop]);
  const back = useCallback(() => !first && go(index - 1), [first, go, index]);
  const finish = () => {
    stop();
    openNew("EXPENSE");
  };

  // Trava a rolagem manual (o tour rola sozinho até cada alvo) e devolve o foco ao sair.
  useEffect(() => {
    const root = document.documentElement;
    const prev = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter };
    const focused = document.activeElement as HTMLElement | null;
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "stable";
    return () => {
      root.style.overflow = prev.overflow;
      root.style.scrollbarGutter = prev.gutter;
      focused?.focus?.({ preventScroll: true });
    };
  }, []);

  // Encontra o alvo do passo (esperando o painel carregar), rola até ele ou pula o passo.
  useEffect(() => {
    const id = step.target;
    const started = performance.now();
    let timer = 0;
    const look = () => {
      if (!id) return setFound({ index, el: null });
      const el = findTarget(id);
      if (el) {
        if (!isPinned(el)) {
          const mobile = window.innerWidth < 768;
          const delta = scrollDelta(spotFor(el, 0).rect, window.innerHeight, { top: mobile ? 72 : 88, bottom: mobile ? 88 : 24 }, cardRef.current?.offsetHeight ?? 200);
          if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: reducedMotion() ? "auto" : "smooth" });
        }
        return setFound({ index, el });
      }
      if (performance.now() - started > TARGET_TIMEOUT) {
        const skipTo = index + direction;
        return skipTo < 0 || skipTo >= TOUR_STEPS.length ? stop() : go(skipTo);
      }
      timer = window.setTimeout(look, 100);
    };
    timer = window.setTimeout(look, 0);
    return () => window.clearTimeout(timer);
  }, [direction, go, index, step.target, stop]);

  // Acompanha o alvo a cada frame (rolagem suave, resize, conteúdo que muda de altura).
  useEffect(() => {
    if (!ready) return;
    let el = target;
    let radius = 0;
    let frame = 0;
    const measure = () => {
      // Re-renderizou ou sumiu num resize (ex.: sidebar → tab bar): procura de novo.
      if (el && !isVisible(el) && step.target) {
        el = findTarget(step.target);
        radius = 0;
      }
      if (el && !radius) radius = radiusFor(el);
      const nextLayout: Layout = {
        spot: el ? spotFor(el, radius) : null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        card: { width: cardRef.current?.offsetWidth ?? 0, height: cardRef.current?.offsetHeight ?? 0 },
      };
      goalRef.current = nextLayout.spot;
      setLayout((prev) => (sameLayout(prev, nextLayout) ? prev : nextLayout));
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [ready, step.target, target]);

  // Pinta o scrim com um furo que desliza até o alvo (efeito "íris" ao abrir). Direto no DOM:
  // um box-shadow gigante seria mais simples, mas o Chrome o pinta bem mais claro que o pedido.
  useEffect(() => {
    const snap = reducedMotion();
    const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
    let drawn = centerSpot(viewport());
    let painted = "";
    let prev = performance.now();
    let frame = 0;
    const paint = (now: number) => {
      const k = snap ? 1 : 1 - Math.pow(0.8, (now - prev) / 16.7);
      prev = now;
      drawn = tweenSpot(drawn, goalRef.current ?? centerSpot(viewport()), k);
      const path = holePath(viewport(), drawn);
      if (path !== painted && scrimRef.current && ringRef.current) {
        painted = path;
        scrimRef.current.style.clipPath = `path(evenodd, "${path}")`;
        const { rect, radius } = drawn;
        Object.assign(ringRef.current.style, {
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderRadius: `${radius}px`,
          opacity: rect.width > 4 ? "1" : "0",
        });
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (ready) primaryRef.current?.focus({ preventScroll: true });
  }, [ready, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A busca (⌘K) abriria por baixo do tour.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (e.key === "Escape") {
        e.preventDefault();
        stop();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [back, next, stop]);

  const trapFocus = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !cardRef.current) return;
    const items = [...cardRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    const [head, tail] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === head) {
      e.preventDefault();
      tail?.focus();
    } else if (!e.shiftKey && document.activeElement === tail) {
      e.preventDefault();
      head?.focus();
    }
  };

  // Clique fora do card: um "tremidinho" avisa que o tour espera uma escolha.
  const nudge = () => {
    if (reducedMotion()) return;
    cardRef.current?.animate?.(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
      { duration: 320, easing: "ease-out" },
    );
  };

  const viewport = layout?.viewport ?? { width: window.innerWidth, height: window.innerHeight };
  const spot = layout?.spot ?? null;
  const card = layout?.card ?? { width: 0, height: 0 };
  const position = placeCard(spot?.rect ?? null, card, viewport, step.placement);
  const visible = ready && card.height > 0;
  const total = TOUR_STEPS.length - 2;

  return (
    <>
      {/* Bloqueia a página inteira, inclusive o bloco em destaque: só o card responde. */}
      <div className="fixed inset-0 z-[60]" onClick={nudge} aria-hidden />
      <div
        ref={scrimRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[61] bg-tour-scrim animate-fade-in"
        style={{ clipPath: `path(evenodd, "${holePath(viewport, centerSpot(viewport))}")` }}
      />
      <div ref={ringRef} aria-hidden className="tour-pulse pointer-events-none fixed z-[61] border-2 border-accent opacity-0 transition-opacity duration-200" />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        onKeyDown={trapFocus}
        className={cn(
          "fixed z-[62] w-[min(22.5rem,calc(100vw-2rem))] rounded-xl bg-surface-raised p-5 shadow-lg ring-1 ring-line",
          "transition-[top,left,opacity] duration-300 ease-out",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ top: position.top, left: position.left }}
      >
        <div key={index} className="animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1" aria-hidden>
              {TOUR_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-4 bg-accent" : i < index ? "w-1.5 bg-accent/45" : "w-1.5 bg-line-strong")}
                />
              ))}
            </div>
            <IconButton label="Fechar tour" size="icon-sm" className="-mr-2 -mt-1" onClick={stop}>
              <X />
            </IconButton>
          </div>

          <h2 id="tour-title" className="mt-3 text-lg font-semibold text-ink">{step.title}</h2>
          <p id="tour-body" className="mt-1.5 text-sm text-ink-2">{step.body}</p>

          <div className="mt-5 flex items-center justify-between gap-2">
            {first || last ? (
              <Button variant="ghost" size="sm" className="-ml-3" onClick={stop}>
                {first ? "Agora não" : "Explorar sozinho"}
              </Button>
            ) : (
              <span className="num text-xs text-ink-3">{index} de {total}</span>
            )}
            <div className="flex items-center gap-1">
              {!first && !last && (
                <Button variant="ghost" size="sm" onClick={back}>
                  <ArrowLeft aria-hidden /> Voltar
                </Button>
              )}
              {last ? (
                <Button ref={primaryRef} size="sm" onClick={finish}>
                  <Plus aria-hidden /> Novo lançamento
                </Button>
              ) : (
                <Button ref={primaryRef} size="sm" onClick={next}>
                  {first ? "Começar tour" : "Próximo"} <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
