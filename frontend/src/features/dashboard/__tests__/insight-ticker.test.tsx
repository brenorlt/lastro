import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DashboardInsight, MarketInsight } from "@/types/dashboard";
import { tickerHeadline, tickerItems } from "../api";
import { InsightTicker, TICKER_INTERVAL_MS } from "../components/insight-ticker";

const personal = (key: string, tone: DashboardInsight["tone"], message: string): DashboardInsight => ({
  key,
  tone,
  message,
  basis: "base",
  value: null,
});

const market = (key: string, message: string): MarketInsight => ({
  key,
  kind: "currency",
  tone: "neutral",
  trend: "down",
  symbol: "USD",
  message,
  basis: "AwesomeAPI",
  value: -0.49,
});

const PERSONAL = [
  personal("SAVINGS_RATE", "positive", "Sua taxa de poupança está em 35,6%."),
  personal("OVERDUE", "warning", "Você tem 2 lançamentos vencidos somando R$ 540,00."),
];
const MARKET = [market("USD_BRL", "Dólar hoje: R$ 5,18 (−0,49% no dia)."), market("EUR_BRL", "Euro estável hoje: R$ 5,89.")];

describe("tickerItems", () => {
  it("alertas pessoais primeiro, depois mercado e pessoais intercalados", () => {
    expect(tickerItems(PERSONAL, MARKET).map((i) => i.insight.key)).toEqual(["OVERDUE", "USD_BRL", "SAVINGS_RATE", "EUR_BRL"]);
  });
});

const MANY_MARKET = [
  ...MARKET,
  market("BTC_BRL", "Bitcoin hoje: R$ 435.116 (+1,20% no dia)."),
  market("STOCK_TOP_GAINER", "Destaque em alta: ITUB4 sobe 1,41% hoje, a R$ 42,30."),
];

describe("InsightTicker", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("não renderiza sem insights", () => {
    const { container } = render(<InsightTicker personal={[]} market={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("até 4 insights: um grupo só, sem controles", () => {
    render(<InsightTicker personal={PERSONAL} market={MARKET} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Próximos insights" })).not.toBeInTheDocument();
  });

  it("mostra 4 cards por vez, troca o grupo sozinho e para com o mouse em cima", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InsightTicker personal={PERSONAL} market={MANY_MARKET} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText(/vencidos somando/)).toBeInTheDocument();
    expect(screen.queryByText(/ITUB4/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(TICKER_INTERVAL_MS));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/ITUB4/)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /Pausar/ })).not.toBeInTheDocument();
    await user.hover(screen.getByRole("region", { name: "Insights" }));
    act(() => vi.advanceTimersByTime(TICKER_INTERVAL_MS * 3));
    expect(screen.getByText(/ITUB4/)).toBeInTheDocument();
  });

  it("navega entre grupos com anterior/próximo, dando a volta", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InsightTicker personal={PERSONAL} market={MANY_MARKET} />);
    await user.click(screen.getByRole("button", { name: "Insights anteriores" }));
    expect(screen.getByText(/ITUB4/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próximos insights" }));
    expect(screen.getByText(/vencidos somando/)).toBeInTheDocument();
  });
});

describe("tickerHeadline", () => {
  it("número de destaque por tipo de insight", () => {
    const h = (key: string, value: number | null) => tickerHeadline({ source: "personal", insight: { ...PERSONAL[0]!, key, value } });
    expect(h("SPENDING_CHANGE", 37.8)).toEqual({ value: "+37,8%", label: "gastos", trend: "up" });
    expect(h("INCOME_CHANGE", -18.8)).toMatchObject({ value: "-18,8%", trend: "down" });
    expect(h("OVERDUE", 1)).toEqual({ value: "1", label: "vencido" });
    expect(h("SAVINGS_RATE", null)).toBeNull();
    expect(tickerHeadline({ source: "market", insight: MARKET[0]! })).toEqual({ value: "-0,49%", label: "USD", trend: "down" });
  });
});
