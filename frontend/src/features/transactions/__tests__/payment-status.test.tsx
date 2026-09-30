import { render, screen } from "@testing-library/react";
import { parseISODate, toISODate, todayISO } from "@/lib/dates";
import { PaymentStatusBadge } from "../components/payment-status";

const today = todayISO();
const addDaysISO = (iso: string, n: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

describe("PaymentStatusBadge", () => {
  it.each([
    [{ status: "CLEARED", date: today, type: "EXPENSE" }, "Pago"],
    [{ status: "CLEARED", date: addDaysISO(today, 10), type: "EXPENSE" }, "Pago"],
    [{ status: "CLEARED", date: today, type: "INCOME" }, "Recebido"],
    [{ status: "CLEARED", date: today, type: "TRANSFER" }, "Transferido"],
    [{ status: "PENDING", date: addDaysISO(today, 3), type: "EXPENSE" }, "Agendado"],
    [{ status: "PENDING", date: addDaysISO(today, -1), type: "EXPENSE" }, "A pagar"],
    [{ status: "PENDING", date: today, type: "INCOME" }, "A receber"],
  ] as const)("%o → %s", (t, label) => {
    render(<PaymentStatusBadge transaction={t} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
