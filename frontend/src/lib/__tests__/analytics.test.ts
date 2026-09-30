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

describe("envio com consentimento", () => {
  // GA_MEASUREMENT_ID é lido no import: cada teste carrega o módulo de novo com o id definido.
  async function load() {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TESTE");
    vi.resetModules();
    return import("../analytics");
  }

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete window.gtag;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.gtag;
  });

  it("guarda eventos até o gtag existir e envia na ordem depois do aceite", async () => {
    const analytics = await load();
    analytics.track("section_view", { section: "hero" });
    analytics.track("cta_click", { cta_location: "hero" });

    const gtag = vi.fn();
    window.gtag = gtag;
    analytics.saveConsent("granted");
    analytics.flushPendingEvents();

    expect(gtag.mock.calls).toEqual([
      ["event", "section_view", { section: "hero" }],
      ["event", "cta_click", { cta_location: "hero" }],
    ]);
    analytics.flushPendingEvents();
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it("descarta a fila quando a pessoa recusa e não guarda mais nada", async () => {
    const analytics = await load();
    analytics.track("section_view", { section: "hero" });
    analytics.saveConsent("denied");
    analytics.track("section_view", { section: "planos" });

    const gtag = vi.fn();
    window.gtag = gtag;
    analytics.flushPendingEvents();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("atribui o sign_up ao CTA clicado na landing, uma vez só", async () => {
    const analytics = await load();
    const gtag = vi.fn();
    window.gtag = gtag;

    analytics.rememberSignupCta("planos");
    analytics.trackApiAction("POST", "/auth/register");
    analytics.trackApiAction("POST", "/auth/register");

    expect(gtag.mock.calls.map((c) => c[2])).toEqual([
      { method: "password", route: "/auth/register", cta_location: "planos" },
      { method: "password", route: "/auth/register", cta_location: "direto" },
    ]);
  });

  it("sign_up do Google usa o mesmo CTA guardado", async () => {
    const analytics = await load();
    const gtag = vi.fn();
    window.gtag = gtag;

    analytics.rememberSignupCta("hero");
    analytics.trackGoogleSignUp();
    expect(gtag).toHaveBeenCalledWith("event", "sign_up", { method: "google", cta_location: "hero" });
  });
});
