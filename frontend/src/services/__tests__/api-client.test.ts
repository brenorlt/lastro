import { useAuthStore } from "@/stores/auth-store";
import type { AuthPayload } from "@/types/auth";
import { api, refreshSession } from "../api-client";
import { ApiError } from "../api-error";

const user = { id: "u1", name: "Ana", email: "ana@exemplo.com" } as AuthPayload["user"];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ok = (data: unknown) => json(200, { success: true, data });
const fail = (status: number, code: string) => json(status, { success: false, code, message: "x", statusCode: status });

describe("api-client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.setState({ status: "idle", user: null, accessToken: null, expiresAt: null });
  });

  it("renova uma única vez para requisições concorrentes (single-flight)", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) return ok({ accessToken: "novo", expiresIn: 900, user });
      return ok({ path: url });
    });

    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);

    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    const authHeaders = fetchMock.mock.calls
      .filter(([u]) => !String(u).endsWith("/auth/refresh"))
      .map(([, init]) => (init?.headers as Record<string, string>).Authorization);
    expect(authHeaders).toEqual(["Bearer novo", "Bearer novo", "Bearer novo"]);
  });

  it("em TOKEN_EXPIRED renova e repete a requisição uma vez", async () => {
    useAuthStore.setState({ accessToken: "velho", expiresAt: Date.now() + 600_000, status: "authenticated", user });
    fetchMock
      .mockResolvedValueOnce(fail(401, "TOKEN_EXPIRED"))
      .mockResolvedValueOnce(ok({ accessToken: "novo", expiresIn: 900, user }))
      .mockResolvedValueOnce(ok({ fine: true }));

    const res = await api.get<{ fine: boolean }>("/recurso");
    expect(res.data.fine).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("novo");
  });

  it("limpa a sessão quando o refresh falha", async () => {
    useAuthStore.setState({ accessToken: "velho", expiresAt: Date.now() + 600_000, status: "authenticated", user });
    fetchMock.mockResolvedValueOnce(fail(401, "TOKEN_EXPIRED")).mockResolvedValueOnce(fail(401, "SESSION_REVOKED"));

    await expect(api.get("/recurso")).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe("anonymous");
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("SESSION_REVOKED encerra a sessão sem tentar refresh", async () => {
    useAuthStore.setState({ accessToken: "a", expiresAt: Date.now() + 600_000, status: "authenticated", user });
    fetchMock.mockResolvedValueOnce(fail(401, "SESSION_REVOKED"));
    await expect(api.get("/recurso")).rejects.toMatchObject({ code: "SESSION_REVOKED" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("rotas públicas não enviam token nem tentam refresh", async () => {
    fetchMock.mockResolvedValueOnce(fail(401, "INVALID_CREDENTIALS"));
    await expect(api.post("/auth/login", {}, { auth: false })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("falha de rede no refresh não derruba a sessão", async () => {
    useAuthStore.setState({ status: "authenticated", user, accessToken: "a", expiresAt: 0 });
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await refreshSession()).toBeNull();
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("nunca expõe mensagem técnica em erro 5xx", async () => {
    fetchMock.mockResolvedValueOnce(json(500, { success: false, code: "INTERNAL_ERROR", message: "PrismaClientKnownRequestError", statusCode: 500 }));
    await expect(api.get("/x", { auth: false })).rejects.toThrow("Algo deu errado do nosso lado");
  });
});
