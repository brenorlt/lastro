import { trackApiAction } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth-store";
import type { ApiSuccess } from "@/types/api";
import type { AuthPayload } from "@/types/auth";
import { ApiError, isApiErrorBody } from "./api-error";

/**
 * Base da API. Por padrão "/api": o Next reescreve para o NestJS (next.config.ts),
 * então no navegador a API é same-origin e o cookie de refresh é first-party.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/** Renova o access token quando faltar menos que isso para expirar. */
const REFRESH_LEEWAY_MS = 30_000;

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Rotas públicas (login, cadastro…) não enviam token nem tentam refresh. */
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) params.set(k, String(v));
  }
  const qs = params.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

async function send(method: Method, path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  // FormData define o próprio Content-Type (multipart com boundary).
  if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(buildUrl(path, options.query), {
      method,
      credentials: "include",
      signal: options.signal,
      headers,
      body: isForm ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw ApiError.network();
  }
}

async function parse<T, M>(response: Response): Promise<ApiSuccess<T, M>> {
  const payload: unknown =
    response.status === 204 ? { success: true, data: null } : await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiErrorBody(payload)) throw ApiError.fromBody(payload);
    throw ApiError.fromBody({ success: false, code: "INTERNAL_ERROR", message: "", statusCode: response.status });
  }
  return payload as ApiSuccess<T, M>;
}

let refreshInFlight: Promise<AuthPayload | null> | null = null;

/**
 * Serializa entre abas: o backend revoga a família inteira se um refresh já
 * rotacionado for reapresentado. Com o lock, a segunda aba envia o cookie novo.
 */
function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("lastro-auth-refresh", fn) as Promise<T>;
  }
  return fn();
}

/**
 * Troca o cookie httpOnly de refresh por um novo access token.
 * Single-flight na aba + lock entre abas, evitando detecção falsa de reuso.
 */
export function refreshSession(): Promise<AuthPayload | null> {
  refreshInFlight ??= withCrossTabLock(async () => {
    try {
      const res = await send("POST", "/auth/refresh", { auth: false }, null);
      if (!res.ok) {
        useAuthStore.getState().clear();
        return null;
      }
      const { data } = (await res.json()) as ApiSuccess<AuthPayload>;
      useAuthStore.getState().setSession(data);
      return data;
    } catch {
      // Falha de rede não encerra a sessão: o cookie pode continuar válido.
      return null;
    } finally {
      refreshInFlight = null;
    }
  });
  return refreshInFlight;
}

async function validToken(): Promise<string | null> {
  const { accessToken, expiresAt } = useAuthStore.getState();
  if (accessToken && expiresAt && expiresAt - Date.now() > REFRESH_LEEWAY_MS) return accessToken;
  const refreshed = await refreshSession();
  return refreshed?.accessToken ?? null;
}

/** Só token expirado justifica renovar; SESSION_REVOKED/EXPIRED encerram a sessão. */
const RETRYABLE_AUTH_CODES = new Set(["TOKEN_EXPIRED"]);

async function request<T, M = undefined>(method: Method, path: string, options: RequestOptions = {}) {
  const result = await requestOnce<T, M>(method, path, options);
  // Só escritas bem-sucedidas viram evento (parse lança em erro); nomes e rota, nunca o corpo.
  if (method !== "GET") trackApiAction(method, path);
  return result;
}

async function requestOnce<T, M>(method: Method, path: string, options: RequestOptions) {
  const useAuth = options.auth !== false;
  const token = useAuth ? await validToken() : null;
  const response = await send(method, path, options, token);

  if (useAuth && response.status === 401) {
    const body: unknown = await response.clone().json().catch(() => null);
    if (isApiErrorBody(body) && RETRYABLE_AUTH_CODES.has(body.code)) {
      const refreshed = await refreshSession();
      if (refreshed) return parse<T, M>(await send(method, path, options, refreshed.accessToken));
    }
    useAuthStore.getState().clear();
  }
  return parse<T, M>(response);
}

/** Baixa um arquivo autenticado (CSV/PDF) e dispara o salvamento no navegador. */
async function download(path: string, query: RequestOptions["query"], fallbackName: string) {
  const attempt = (token: string | null) => send("GET", path, { query }, token);
  let res = await attempt(await validToken());
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) res = await attempt(refreshed.accessToken);
  }
  if (!res.ok) await parse(res);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export const api = {
  download,
  get: <T, M = undefined>(path: string, options?: Omit<RequestOptions, "body">) => request<T, M>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { body: form }),
  delete: <T = null>(path: string, body?: unknown) => request<T>("DELETE", path, { body }),
};
