const BACKEND_URL = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3333").replace(/\/+$/, "");

/**
 * Descoberta OAuth para clientes MCP (ex.: Claude). Fica na raiz do domínio público, como
 * as RFCs exigem; o conteúdo vem do backend, que conhece emissor e endpoints.
 */
export async function wellKnown(path: string): Promise<Response> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store" });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
