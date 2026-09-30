import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useComposer } from "@/stores/composer-store";
import { ProductTour } from "../components/product-tour";
import { TOUR_STEPS } from "../steps";
import { useTour } from "../store";

vi.mock("next/navigation", () => ({ usePathname: () => "/painel" }));

// jsdom não faz layout: dá tamanho aos elementos para o tour considerá-los visíveis.
beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 100, left: 100, width: 200, height: 80, right: 300, bottom: 180, x: 100, y: 100, toJSON: () => ({}) });
});

function Targets() {
  return (
    <div style={{ position: "static" }}>
      {TOUR_STEPS.filter((s) => s.target).map((s) => <div key={s.id} data-tour={s.target} />)}
    </div>
  );
}

const advance = () => act(() => vi.advanceTimersByTime(50));

describe("ProductTour", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.scrollBy = vi.fn();
    useTour.getState().stop();
  });
  afterEach(() => vi.useRealTimers());

  it("não renderiza nada fora do tour", () => {
    render(<ProductTour />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("percorre os passos com botões e teclado e fecha com Esc", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<><Targets /><ProductTour /></>);
    act(() => useTour.getState().start());
    await advance();

    expect(screen.getByRole("dialog", { name: TOUR_STEPS[0]!.title })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /começar tour/i }));
    await advance();
    expect(screen.getByRole("dialog", { name: TOUR_STEPS[1]!.title })).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    await advance();
    expect(screen.getByRole("dialog", { name: TOUR_STEPS[2]!.title })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    await advance();
    expect(screen.getByRole("dialog", { name: TOUR_STEPS[1]!.title })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(useTour.getState().active).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pula passos cujo alvo não existe na tela", async () => {
    render(<ProductTour />);
    act(() => {
      useTour.getState().start();
      useTour.getState().go(1);
    });
    for (let i = 1; i < TOUR_STEPS.length - 1; i++) await act(() => vi.advanceTimersByTime(3000));
    expect(useTour.getState().step).toBe(TOUR_STEPS.length - 1);
    expect(screen.getByRole("dialog", { name: TOUR_STEPS.at(-1)!.title })).toBeInTheDocument();
  });

  it("termina abrindo o compositor de lançamentos", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<><Targets /><ProductTour /></>);
    act(() => {
      useTour.getState().start();
      useTour.getState().go(TOUR_STEPS.length - 1);
    });
    await advance();
    await user.click(screen.getByRole("button", { name: /novo lançamento/i }));
    expect(useTour.getState().active).toBe(false);
    expect(useComposer.getState()).toMatchObject({ open: true, mode: "EXPENSE" });
  });
});
