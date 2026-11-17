import { render, screen } from "@testing-library/react";
import { toISODate } from "@/lib/dates";
import type { Dashboard } from "@/types/dashboard";
import type { Transaction } from "@/types/finance";
import type { Budget } from "@/types/planning";
import { attentionItems, MonthSummary, setupProgress } from "../components/dashboard-panels";

const inDays = (n: number) => toISODate(new Date(Date.now() + n * 86_400_000));

function dashboard(partial: Partial<Dashboard> = {}): Dashboard {
  return {
    commitments: { next30Days: "0", pendingCount: 0, overdueCount: 0, overdueAmount: "0" },
    upcoming: [],
    ...partial,
  } as Dashboard;
}

const budget = (name: string, percent: number, level: Budget["level"], remaining: string) =>
  ({ id: name, category: { name }, percent, level, remaining }) as unknown as Budget;

describe("attentionItems", () => {
  it("vazio quando nada está vencido, perto de vencer ou perto do limite", () => {
    expect(attentionItems(dashboard(), [budget("Lazer", 40, "OK", "100")])).toEqual([]);
  });

  it("vencidos primeiro, depois vencimentos da semana e orçamentos do mais crítico ao menos", () => {
    const items = attentionItems(
      dashboard({
        commitments: { next30Days: "500", pendingCount: 2, overdueCount: 2, overdueAmount: "300" },
        upcoming: [
          { description: "Água", date: inDays(3), amount: "96.30" },
          { description: "Seguro", date: inDays(20), amount: "400" },
        ] as Transaction[],
      }),
      [budget("Mercado", 82, "WARNING", "144.59"), budget("Assinaturas", 115, "EXCEEDED", "-25.70"), budget("Lazer", 60, "ATTENTION", "300")],
    );
    expect(items.map((i) => i.key)).toEqual(["overdue", "soon", "budget-Assinaturas", "budget-Mercado"]);
    expect(items[0]!.text).toBe("2 contas vencidas");
    // Só o que vence em até 7 dias entra no aviso.
    expect(items[1]!.text).toBe("Água vence nos próximos 7 dias");
    expect(items[2]!.detail).toMatch(/25,70 acima do limite/);
  });
});

describe("setupProgress", () => {
  it("conta passos concluídos", () => {
    expect(setupProgress({ hasAccount: true, hasTransactions: true, hasBudget: false, hasGoal: false, hasReserve: false })).toEqual({ done: 2, total: 5, complete: false });
    expect(setupProgress({ hasAccount: true, hasTransactions: true, hasBudget: true, hasGoal: true, hasReserve: true }).complete).toBe(true);
  });
});

describe("MonthSummary", () => {
  const flow = (income: string, expense: string) =>
    ({ income, expense, pendingExpense: "0" }) as Dashboard["flow"];

  it("mostra quanto sobrou e a taxa guardada", () => {
    render(<MonthSummary flow={flow("10000", "7500")} hidden={false} isCurrentMonth />);
    expect(screen.getByText("Sobrou")).toBeInTheDocument();
    expect(screen.getByText(/do que entrou até agora/)).toHaveTextContent("Você guardou 25% do que entrou até agora.");
  });

  it("avisa quando gastou mais do que entrou", () => {
    render(<MonthSummary flow={flow("1000", "1500")} hidden={false} isCurrentMonth={false} />);
    expect(screen.getByText("Faltou")).toBeInTheDocument();
    expect(screen.getByText(/a mais do que entrou/)).toHaveTextContent(/R\$\s?500,00/);
  });
});
