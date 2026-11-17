import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy manual para o backend (mesmo papel do antigo `rewrites()` em next.config.ts).
 *
 * O rewrite embutido do Next para um destino externo não repassa múltiplos cabeçalhos
 * Set-Cookie corretamente (bug conhecido: https://github.com/vercel/next.js/issues/29488) —
 * `Headers.get("set-cookie")` funde tudo numa string só. O login emite dois cookies
 * (lastro_rt e lastro_session) numa resposta só, então um dos dois sempre se perdia.
 * `Headers.getSetCookie()` lê os valores corretamente; anexamos cada um por conta própria.
 */

const BACKEND_URL = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3333").replace(/\/+$/, "");

// Cabeçalhos que não devem ser repassados como vieram (o runtime recalcula os corretos).
const STRIP_REQUEST_HEADERS = new Set(["host", "content-length"]);
const STRIP_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "set-cookie", "transfer-encoding"]);

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const target = new URL(`${BACKEND_URL}/api/${path.join("/")}${request.nextUrl.search}`);

  const requestHeaders = new Headers(request.headers);
  for (const name of STRIP_REQUEST_HEADERS) requestHeaders.delete(name);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const backendResponse = await fetch(target, {
    method: request.method,
    headers: requestHeaders,
    body: hasBody ? request.body : undefined,
    // Necessário no runtime Node para enviar um ReadableStream como corpo da requisição.
    ...(hasBody ? { duplex: "half" } : {}),
    redirect: "manual",
    cache: "no-store",
  } as RequestInit);

  const responseHeaders = new Headers(backendResponse.headers);
  for (const name of STRIP_RESPONSE_HEADERS) responseHeaders.delete(name);

  const response = new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: responseHeaders,
  });
  for (const cookie of backendResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

async function handle(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
// Preflight CORS de clientes MCP/OAuth: quem responde é o backend.
export const OPTIONS = handle;
