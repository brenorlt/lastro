/**
 * Google Analytics 4 com consentimento (LGPD): o gtag só é carregado depois que a pessoa aceita
 * no banner. Nada de dado pessoal ou financeiro vai para o Google — só nomes de tela e de ação,
 * com ids trocados por ":id" e sem query string (links de e-mail carregam tokens na URL).
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null;

export type Consent = "granted" | "denied";

const CONSENT_KEY = "lastro_analytics_consent";
const CONSENT_EVENT = "lastro:analytics-consent";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

// ───────────────────────── Consentimento ─────────────────────────

export function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function saveConsent(consent: Consent | null) {
  if (consent !== "granted") pending.length = 0;
  try {
    if (consent) window.localStorage.setItem(CONSENT_KEY, consent);
    else window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Armazenamento bloqueado: a escolha vale só para esta página.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT));
}

export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// ───────────────────────── Normalização ─────────────────────────

const ID_SEGMENT = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|\d{4}-\d{2}(-\d{2})?)$/i;

/** "/metas/3f2a…?x=1" → "/metas/:id" (sem ids, sem query, sem hash). */
export function sanitizePath(path: string): string {
  const pathname = path.split(/[?#]/)[0] || "/";
  const clean = pathname
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

// ───────────────────────── Envio ─────────────────────────

function gtag(...args: unknown[]) {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID || !window.gtag) return;
  window.gtag(...args);
}

export function trackPageView(path: string) {
  const pagePath = sanitizePath(path);
  gtag("event", "page_view", {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_title: document.title,
  });
}

type Params = Record<string, string | number | boolean>;

/**
 * Eventos disparados antes do gtag existir (banner ainda sem resposta, ou script carregando).
 * Ficam só em memória, nada sai do navegador: vão para o Google se a pessoa aceitar e são
 * descartados se recusar. Sem isso, a primeira seção vista e o clique que levou ao cadastro se perdem.
 */
const pending: [string, Params][] = [];
const MAX_PENDING = 50;

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  if (window.gtag) return window.gtag("event", event, params);
  if (readConsent() !== "denied" && pending.length < MAX_PENDING) pending.push([event, params]);
}

/** Chamado logo depois que o gtag é criado. */
export function flushPendingEvents() {
  for (const [event, params] of pending.splice(0)) gtag("event", event, params);
}

// ───────────────────────── Origem do cadastro ─────────────────────────

const SIGNUP_CTA_KEY = "lastro_signup_cta";

/** Qual botão da landing levou ao /cadastro — vira o cta_location do sign_up. */
export function rememberSignupCta(location: string) {
  try {
    window.sessionStorage.setItem(SIGNUP_CTA_KEY, location);
  } catch {
    // Armazenamento bloqueado: o sign_up sai como "direto".
  }
}

function takeSignupCta(): string {
  try {
    const location = window.sessionStorage.getItem(SIGNUP_CTA_KEY);
    window.sessionStorage.removeItem(SIGNUP_CTA_KEY);
    return location || "direto";
  } catch {
    return "direto";
  }
}

/** Cadastro via Google: o backend manda a conta nova para /onboarding?cadastro=google. */
export function trackGoogleSignUp() {
  track("sign_up", { method: "google", cta_location: takeSignupCta() });
}

/** id interno (UUID, não é dado pessoal) para juntar sessões do mesmo usuário; null no logout. */
export function setAnalyticsUser(userId: string | null) {
  if (!GA_MEASUREMENT_ID) return;
  gtag("set", { user_id: userId ?? undefined });
}

// ───────────────────────── Ações via API ─────────────────────────

/** Eventos recomendados do GA4 onde existem; o resto sai do método + rota. */
const NAMED_ACTIONS: Record<string, { event: string; params?: Record<string, string> }> = {
  "POST /auth/login": { event: "login", params: { method: "password" } },
  "POST /auth/register": { event: "sign_up", params: { method: "password" } },
  "POST /auth/logout": { event: "logout" },
  "POST /users/me/onboarding": { event: "tutorial_complete" },
  "POST /users/me/onboarding/skip": { event: "onboarding_skip" },
  "POST /billing/checkout/pix": { event: "begin_checkout", params: { payment_type: "pix" } },
  "POST /billing/checkout/boleto": { event: "begin_checkout", params: { payment_type: "boleto" } },
};

/** Chamadas que não são "passos" do usuário. */
const IGNORED_ACTIONS = new Set(["POST /auth/refresh", "POST /notifications/:id/read"]);

const VERB = { POST: "create", PATCH: "update", PUT: "update", DELETE: "delete" } as const;

/** Rotas POST que terminam num verbo (…/archive) em vez de criar um sub-recurso (…/payments). */
const ACTION_VERBS = new Set([
  "archive",
  "unarchive",
  "confirm",
  "unconfirm",
  "duplicate",
  "pay",
  "copy",
  "adjust",
  "restore-defaults",
  "read-all",
  "revoke-others",
  "block",
  "unblock",
  "grant-access",
]);

/**
 * Nome do evento de uma chamada de escrita bem-sucedida, ou null se não for rastreada.
 * POST /transactions → transactions_create · POST /accounts/:id/archive → accounts_archive ·
 * DELETE /goals/:id/contributions/:id → goals_contributions_delete.
 */
export function actionEventFor(method: string, path: string): { event: string; params: Record<string, string> } | null {
  if (method === "GET") return null;
  const route = sanitizePath(path);
  const key = `${method} ${route}`;
  if (IGNORED_ACTIONS.has(key)) return null;
  const named = NAMED_ACTIONS[key];
  if (named) return { event: named.event, params: { ...named.params, route } };

  const segments = route.split("/").filter((s) => s && s !== ":id");
  if (!segments.length) return null;
  const endsWithVerb = method === "POST" && ACTION_VERBS.has(segments.at(-1)!);
  const parts = endsWithVerb ? segments : [...segments, VERB[method as keyof typeof VERB] ?? method.toLowerCase()];
  return { event: parts.join("_").replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 40), params: { route } };
}

export function trackApiAction(method: string, path: string) {
  const action = actionEventFor(method, path);
  if (!action) return;
  track(action.event, action.event === "sign_up" ? { ...action.params, cta_location: takeSignupCta() } : action.params);
}
