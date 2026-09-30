import { actionEventFor, sanitizePath } from "../analytics";

describe("sanitizePath", () => {
  it("troca ids por :id e remove query/hash (tokens de e-mail nunca saem)", () => {
    expect(sanitizePath("/metas/3f2a9c1e-1b2c-4d5e-8f90-123456789abc?aba=1")).toBe("/metas/:id");
    expect(sanitizePath("/redefinir-senha?token=segredo")).toBe("/redefinir-senha");
    expect(sanitizePath("/cartoes/7f1c2d3e-0000-4000-8000-000000000000/faturas/2026-10#x")).toBe("/cartoes/:id/faturas/:id");
    expect(sanitizePath("/")).toBe("/");
    expect(sanitizePath("/painel/")).toBe("/painel");
  });
});

describe("actionEventFor", () => {
  const id = "3f2a9c1e-1b2c-4d5e-8f90-123456789abc";

  it("usa eventos recomendados do GA4 quando existem", () => {
    expect(actionEventFor("POST", "/auth/login")).toEqual({ event: "login", params: { method: "password", route: "/auth/login" } });
    expect(actionEventFor("POST", "/billing/checkout/pix")?.params).toMatchObject({ payment_type: "pix" });
    expect(actionEventFor("POST", "/users/me/onboarding")?.event).toBe("tutorial_complete");
  });

  it("deriva o nome do método e da rota, sem ids", () => {
    expect(actionEventFor("POST", "/transactions")?.event).toBe("transactions_create");
    expect(actionEventFor("PATCH", `/transactions/${id}?scope=single`)).toEqual({
      event: "transactions_update",
      params: { route: "/transactions/:id" },
    });
    expect(actionEventFor("POST", `/accounts/${id}/archive`)?.event).toBe("accounts_archive");
    expect(actionEventFor("POST", `/goals/${id}/contributions`)?.event).toBe("goals_contributions_create");
    expect(actionEventFor("DELETE", `/goals/${id}/contributions/${id}`)?.event).toBe("goals_contributions_delete");
    expect(actionEventFor("POST", `/cards/${id}/invoices/2026-10/pay`)?.event).toBe("cards_invoices_pay");
  });

  it("ignora leituras e chamadas que não são passos do usuário", () => {
    expect(actionEventFor("GET", "/dashboard")).toBeNull();
    expect(actionEventFor("POST", `/notifications/${id}/read`)).toBeNull();
  });
});
