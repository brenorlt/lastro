import { render } from "@testing-library/react";
import { MarketingAnalytics } from "../components/marketing-analytics";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const track = vi.fn();
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  track: (...args: unknown[]) => track(...args),
}));

/** IntersectionObserver controlado pelo teste: `show`/`hide` simulam o aviso do navegador. */
class FakeObserver {
  static current: FakeObserver;
  observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.current = this;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  notify(el: Element, visibleHeight: number) {
    const ratio = visibleHeight / 1000;
    const entry = {
      target: el,
      intersectionRatio: ratio,
      intersectionRect: { height: visibleHeight },
      rootBounds: { height: 800 },
    };
    this.callback([entry as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

/** Seções de 1000px numa tela de 800px; `top` controla onde a seção está agora. */
function section(name: string, top: () => number) {
  const el = document.createElement("section");
  el.dataset.section = name;
  el.getBoundingClientRect = () => ({ top: top(), bottom: top() + 1000, height: 1000 }) as DOMRect;
  document.body.append(el);
  return el;
}

describe("MarketingAnalytics · section_view", () => {
  let heroTop = 0;
  let planosTop = 2000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.stubGlobal("innerHeight", 800);
    document.body.innerHTML = "";
    heroTop = 0;
    planosTop = 2000;
    track.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("conta a seção depois de 1s na tela, uma vez só", () => {
    const hero = section("hero", () => heroTop);
    section("planos", () => planosTop);
    render(<MarketingAnalytics />);

    FakeObserver.current.notify(hero, 800);
    vi.advanceTimersByTime(999);
    expect(track).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(track).toHaveBeenCalledWith("section_view", { section: "hero", section_index: 1 });
    expect(FakeObserver.current.observed.has(hero)).toBe(false);
  });

  it("não conta seção que só passou pela tela", () => {
    const hero = section("hero", () => heroTop);
    render(<MarketingAnalytics />);

    FakeObserver.current.notify(hero, 800);
    vi.advanceTimersByTime(400);
    heroTop = -1000;
    FakeObserver.current.notify(hero, 0);
    vi.advanceTimersByTime(2000);
    expect(track).not.toHaveBeenCalled();
  });

  it("confere a posição no disparo quando o aviso de saída atrasou (página travada)", () => {
    const hero = section("hero", () => heroTop);
    const planos = section("planos", () => planosTop);
    render(<MarketingAnalytics />);

    FakeObserver.current.notify(hero, 800);
    heroTop = -1000; // saiu da tela, mas o observer ainda não avisou
    vi.advanceTimersByTime(1000);
    expect(track).not.toHaveBeenCalled();
    expect(FakeObserver.current.observed.has(hero)).toBe(true);

    planosTop = 0;
    FakeObserver.current.notify(planos, 800);
    vi.advanceTimersByTime(1000);
    expect(track).toHaveBeenCalledExactlyOnceWith("section_view", { section: "planos", section_index: 2 });
  });
});
