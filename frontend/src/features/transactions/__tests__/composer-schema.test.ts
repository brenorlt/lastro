import type { Transaction } from "@/types/finance";
import { composerSchema, emptyComposer, fromTransaction, statusOf, toTransactionInput, toTransactionPatch, toTransferInput, type ComposerValues } from "../schemas";

const base = () => ({ ...emptyComposer("EXPENSE", "2026-09-24", "acc-1"), amount: "120.50", description: "Mercado" });

describe("composer schema", () => {
  it("despesa válida vira input da API com status efetivado", () => {
    const v = composerSchema.parse(base());
    expect(toTransactionInput(v)).toMatchObject({ type: "EXPENSE", amount: "120.50", status: "CLEARED", accountId: "acc-1" });
  });

  it("data futura respeita o switch: pago adiantado ou agendado", () => {
    expect(statusOf(composerSchema.parse({ ...base(), date: "2026-10-05", paid: true }))).toBe("CLEARED");
    expect(statusOf(composerSchema.parse({ ...base(), date: "2026-10-05", paid: false }))).toBe("PENDING");
  });

  it("valor zero e descrição vazia são recusados", () => {
    const r = composerSchema.safeParse({ ...base(), amount: "0", description: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["amount", "description"]);
  });

  it("transferência exige contas diferentes e dispensa descrição", () => {
    const same = composerSchema.safeParse({ ...base(), mode: "TRANSFER", description: "", toAccountId: "acc-1" });
    expect(same.success).toBe(false);
    expect(same.error?.issues[0]?.path).toEqual(["toAccountId"]);
    const ok = composerSchema.parse({ ...base(), mode: "TRANSFER", description: "", toAccountId: "acc-2" });
    expect(toTransferInput(ok)).toMatchObject({ fromAccountId: "acc-1", toAccountId: "acc-2", description: undefined });
  });

  it("parcelado envia o total e o número de parcelas", () => {
    const v = composerSchema.parse({ ...base(), amount: "1000.00", repeat: "INSTALLMENTS", installments: 10 });
    expect(toTransactionInput(v).repeat).toEqual({ kind: "INSTALLMENTS", count: 10 });
  });

  it("recorrente não pode terminar antes de começar", () => {
    const r = composerSchema.safeParse({ ...base(), repeat: "RECURRING", endDate: "2026-01-01" });
    expect(r.success).toBe(false);
  });
});

/**
 * Property 1: Bug Condition - Edição de receita/despesa envia só a forma de pagamento que mudou.
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
 *
 * Tabela exaustiva: tipo × forma atual × forma no formulário × igual/diferente.
 */
describe("toTransactionPatch: forma de pagamento na edição de receita/despesa", () => {
  type Source = { kind: "account" | "card"; id: string };
  const acc = (id: string): Source => ({ kind: "account", id });
  const card = (id: string): Source => ({ kind: "card", id });
  const ref = (id: string) => ({ id, name: id, color: "#000000", icon: "wallet" });

  const editingOf = (type: "INCOME" | "EXPENSE", src: Source, amount = "120.50"): Transaction => ({
    id: "tx-1",
    type,
    amount,
    description: "Mercado",
    date: "2026-09-24",
    status: "CLEARED",
    notes: null,
    account: src.kind === "account" ? ref(src.id) : null,
    transferAccount: null,
    category: null,
    categoryAuto: false,
    tags: [],
    creditCard: src.kind === "card" ? { id: src.id, name: src.id, color: "#000000", brand: "VISA", lastFourDigits: null } : null,
    invoice: src.kind === "card" ? { id: "inv-1", referenceMonth: "2026-10", dueDate: "2026-10-10" } : null,
    installment: null,
    recurring: null,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
  });

  /** Formulário aberto a partir de `editing`, com a forma de pagamento trocada para `dest`. */
  const valuesFor = (editing: Transaction, dest: Source, patch: Partial<ComposerValues> = {}): ComposerValues =>
    composerSchema.parse({
      ...fromTransaction(editing),
      accountId: dest.kind === "account" ? dest.id : null,
      creditCardId: dest.kind === "card" ? dest.id : null,
      ...patch,
    });

  const isBugCondition = (editing: Transaction, body: Record<string, unknown>) =>
    (editing.type === "INCOME" || editing.type === "EXPENSE") &&
    (("accountId" in body && body.accountId === null) || ("creditCardId" in body && body.creditCardId === null));

  const expectFixed = (editing: Transaction, dest: Source, body: Record<string, unknown>) => {
    expect(isBugCondition(editing, body)).toBe(false);
    expect(body.accountId).not.toBeNull();
    expect(body.creditCardId).not.toBeNull();
    expect("accountId" in body && "creditCardId" in body).toBe(false);
    const cardChanged = dest.kind === "card" && dest.id !== editing.creditCard?.id;
    const accountChanged = dest.kind === "account" && (dest.id !== editing.account?.id || editing.creditCard !== null);
    expect("creditCardId" in body).toBe(cardChanged);
    expect("accountId" in body).toBe(accountChanged);
    if (cardChanged) expect(body.creditCardId).toBe(dest.id);
    if (accountChanged) expect(body.accountId).toBe(dest.id);
  };

  const cases: Array<[string, "INCOME" | "EXPENSE", Source, Source]> = [
    ["receita conta A → conta A (igual)", "INCOME", acc("acc-A"), acc("acc-A")],
    ["receita conta A → conta B (diferente)", "INCOME", acc("acc-A"), acc("acc-B")],
    ["despesa conta A → conta A (igual)", "EXPENSE", acc("acc-A"), acc("acc-A")],
    ["despesa conta A → conta B (diferente)", "EXPENSE", acc("acc-A"), acc("acc-B")],
    ["despesa conta A → cartão C (troca)", "EXPENSE", acc("acc-A"), card("card-C")],
    ["despesa conta A → cartão D (troca)", "EXPENSE", acc("acc-A"), card("card-D")],
    ["despesa cartão C → cartão C (igual)", "EXPENSE", card("card-C"), card("card-C")],
    ["despesa cartão C → cartão D (diferente)", "EXPENSE", card("card-C"), card("card-D")],
    ["despesa cartão C → conta A (troca)", "EXPENSE", card("card-C"), acc("acc-A")],
    ["despesa cartão C → conta B (troca)", "EXPENSE", card("card-C"), acc("acc-B")],
  ];

  it.each(cases)("%s", (_label, type, current, dest) => {
    const editing = editingOf(type, current);
    const body = toTransactionPatch(valuesFor(editing, dest), editing) as Record<string, unknown>;
    expectFixed(editing, dest, body);
  });

  it("compra no cartão C só com valor alterado (86.66 → 86.65) não envia conta nem cartão", () => {
    const editing = editingOf("EXPENSE", card("card-C"), "86.66");
    const body = toTransactionPatch(valuesFor(editing, card("card-C"), { amount: "86.65" }), editing) as Record<string, unknown>;
    expect(body.amount).toBe("86.65");
    expect(body).not.toHaveProperty("accountId");
    expect(body).not.toHaveProperty("creditCardId");
  });

  it("despesa na conta A sem troca não envia conta nem cartão", () => {
    const editing = editingOf("EXPENSE", acc("acc-A"));
    const body = toTransactionPatch(valuesFor(editing, acc("acc-A"), { amount: "99.90" }), editing) as Record<string, unknown>;
    expect(body.amount).toBe("99.90");
    expect(body).not.toHaveProperty("accountId");
    expect(body).not.toHaveProperty("creditCardId");
  });

  it("receita na mesma conta A não envia conta nem cartão", () => {
    const editing = editingOf("INCOME", acc("acc-A"));
    const body = toTransactionPatch(valuesFor(editing, acc("acc-A"), { description: "Salário" }), editing) as Record<string, unknown>;
    expect(body.description).toBe("Salário");
    expect(body).not.toHaveProperty("accountId");
    expect(body).not.toHaveProperty("creditCardId");
  });
});

/**
 * Property 2: Preservation - transferências, criação e campos fora da forma de pagamento.
 * **Validates: Requirements 3.9, 3.10, 3.12**
 *
 * Saídas observadas no código sem a correção, fixadas como literais.
 */
describe("preservação: corpo de edição de transferências, criação e campos não relacionados", () => {
  const ref = (id: string) => ({ id, name: id, color: "#000000", icon: "wallet" });
  const editingTx = (over: Partial<Transaction>): Transaction => ({
    id: "tx-1",
    type: "EXPENSE",
    amount: "120.50",
    description: "Mercado",
    date: "2026-09-24",
    status: "CLEARED",
    notes: null,
    account: ref("acc-A"),
    transferAccount: null,
    category: null,
    categoryAuto: false,
    tags: [],
    creditCard: null,
    invoice: null,
    installment: null,
    recurring: null,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    ...over,
  });
  const cardRef = (id: string) => ({ id, name: id, color: "#000000", brand: "VISA", lastFourDigits: null });

  describe("transferência: toTransactionPatch igual ao objeto inline de hoje", () => {
    // [rótulo, origem atual, destino atual, origem no form, destino no form, descrição, pago, notas, esperado]
    const cases: Array<[string, string, string, string, string, string, boolean, string, { description: string; status: "CLEARED" | "PENDING"; notes: string | null }]> = [
      ["mesmas contas, descrição vazia, pago, sem notas", "acc-A", "acc-B", "acc-A", "acc-B", "", true, "", { description: "Transferência", status: "CLEARED", notes: null }],
      ["mesmas contas, descrição só com espaços, pendente", "acc-A", "acc-B", "acc-A", "acc-B", "   ", false, "", { description: "Transferência", status: "PENDING", notes: null }],
      ["origem trocada, descrição preenchida, notas", "acc-A", "acc-B", "acc-C", "acc-B", "  Reserva  ", true, " mensal ", { description: "Reserva", status: "CLEARED", notes: "mensal" }],
      ["destino trocado, pendente, notas só espaços", "acc-A", "acc-B", "acc-A", "acc-C", "Poupança", false, "   ", { description: "Poupança", status: "PENDING", notes: null }],
      ["origem e destino invertidos", "acc-A", "acc-B", "acc-B", "acc-A", "Volta", true, "ajuste", { description: "Volta", status: "CLEARED", notes: "ajuste" }],
    ];

    it.each(cases)("%s", (_label, curFrom, curTo, from, to, description, paid, notes, expected) => {
      const editing = editingTx({ type: "TRANSFER", description: "Transferência", account: ref(curFrom), transferAccount: ref(curTo) });
      const values = composerSchema.parse({ ...fromTransaction(editing), amount: "75.50", date: "2026-09-20", accountId: from, toAccountId: to, description, paid, notes });
      expect(toTransactionPatch(values, editing)).toEqual({
        amount: "75.50",
        date: "2026-09-20",
        description: expected.description,
        status: expected.status,
        notes: expected.notes,
        fromAccountId: from,
        toAccountId: to,
      });
    });
  });

  describe("criação: toTransactionInput mantém o par conta/cartão com null", () => {
    const cases: Array<[string, Partial<ComposerValues>, Record<string, unknown>]> = [
      [
        "receita na conta",
        { mode: "INCOME", accountId: "acc-A", creditCardId: null, description: "Salário", amount: "5000.00" },
        { type: "INCOME", amount: "5000.00", description: "Salário", date: "2026-09-24", status: "CLEARED", accountId: "acc-A", creditCardId: null, categoryId: null, notes: null, tags: [], repeat: undefined },
      ],
      [
        "despesa na conta",
        { mode: "EXPENSE", accountId: "acc-A", creditCardId: null, paid: false, notes: " obs ", tags: ["casa"], categoryId: "cat-1" },
        { type: "EXPENSE", amount: "120.50", description: "Mercado", date: "2026-09-24", status: "PENDING", accountId: "acc-A", creditCardId: null, categoryId: "cat-1", notes: "obs", tags: ["casa"], repeat: undefined },
      ],
      [
        "despesa no cartão",
        { mode: "EXPENSE", accountId: null, creditCardId: "card-C" },
        { type: "EXPENSE", amount: "120.50", description: "Mercado", date: "2026-09-24", status: "CLEARED", creditCardId: "card-C", accountId: null, categoryId: null, notes: null, tags: [], repeat: undefined },
      ],
      [
        "despesa no cartão parcelada (cartão prevalece sobre conta)",
        { mode: "EXPENSE", accountId: "acc-A", creditCardId: "card-C", amount: "259.98", repeat: "INSTALLMENTS", installments: 3 },
        { type: "EXPENSE", amount: "259.98", description: "Mercado", date: "2026-09-24", status: "CLEARED", creditCardId: "card-C", accountId: null, categoryId: null, notes: null, tags: [], repeat: { kind: "INSTALLMENTS", count: 3 } },
      ],
      [
        "receita recorrente: cartão do form é ignorado",
        { mode: "INCOME", accountId: "acc-A", creditCardId: "card-C", description: "Aluguel", repeat: "RECURRING", frequency: "MONTHLY", endDate: "", autoConfirm: true },
        { type: "INCOME", amount: "120.50", description: "Aluguel", date: "2026-09-24", status: "CLEARED", accountId: "acc-A", creditCardId: null, categoryId: null, notes: null, tags: [], repeat: { kind: "RECURRING", frequency: "MONTHLY", endDate: undefined, autoConfirm: true } },
      ],
    ];

    it.each(cases)("%s", (_label, patch, expected) => {
      const v = composerSchema.parse({ ...base(), ...patch });
      const input = toTransactionInput(v);
      expect(input).toEqual(expected);
      // Mesmo conjunto de chaves de forma de pagamento de hoje: sempre as duas, uma delas null.
      expect(Object.keys(input)).toEqual(expect.arrayContaining(["accountId", "creditCardId"]));
      expect([input.accountId, input.creditCardId].filter((x) => x === null)).toHaveLength(1);
    });
  });

  describe("receita/despesa: campos fora da forma de pagamento não mudam", () => {
    const KEYS = ["amount", "description", "date", "status", "categoryId", "notes", "tags"] as const;
    const pick = (body: Record<string, unknown>) => Object.fromEntries(KEYS.map((k) => [k, body[k]]));

    const cases: Array<[string, Partial<Transaction>, Partial<ComposerValues>, Record<string, unknown>]> = [
      [
        "despesa em conta, só valor",
        { type: "EXPENSE" },
        { amount: "99.90" },
        { amount: "99.90", description: "Mercado", date: "2026-09-24", status: "CLEARED", categoryId: null, notes: null, tags: [] },
      ],
      [
        "despesa em conta, textos com espaços, pendente, categoria e tags",
        { type: "EXPENSE" },
        { description: "  Feira  ", notes: "  orgânicos ", paid: false, categoryId: "cat-1", tags: ["casa", "mensal"], date: "2026-10-01" },
        { amount: "120.50", description: "Feira", date: "2026-10-01", status: "PENDING", categoryId: "cat-1", notes: "orgânicos", tags: ["casa", "mensal"] },
      ],
      [
        "compra no cartão C, 86.66 → 86.65",
        { type: "EXPENSE", amount: "86.66", account: null, creditCard: cardRef("card-C"), invoice: { id: "inv-1", referenceMonth: "2026-10", dueDate: "2026-10-10" } },
        { amount: "86.65" },
        { amount: "86.65", description: "Mercado", date: "2026-09-24", status: "CLEARED", categoryId: null, notes: null, tags: [] },
      ],
      [
        "compra no cartão trocada para conta, notas apagadas",
        { type: "EXPENSE", account: null, creditCard: cardRef("card-C"), notes: "antiga" },
        { accountId: "acc-A", creditCardId: null, notes: "   " },
        { amount: "120.50", description: "Mercado", date: "2026-09-24", status: "CLEARED", categoryId: null, notes: null, tags: [] },
      ],
      [
        "receita com tags existentes e categoria",
        { type: "INCOME", description: "Salário", category: { ...ref("cat-2"), parentId: null }, tags: [{ id: "t1", name: "fixo", color: null }] },
        { amount: "5000.00" },
        { amount: "5000.00", description: "Salário", date: "2026-09-24", status: "CLEARED", categoryId: "cat-2", notes: null, tags: ["fixo"] },
      ],
    ];

    it.each(cases)("%s", (_label, over, patch, expected) => {
      const editing = editingTx(over);
      const values = composerSchema.parse({ ...fromTransaction(editing), ...patch });
      expect(pick(toTransactionPatch(values, editing) as Record<string, unknown>)).toEqual(expected);
    });
  });
});
