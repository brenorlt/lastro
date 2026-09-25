import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/services/api-error";
import { LoginForm } from "../components/login-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const login = vi.fn();
vi.mock("../api", () => ({
  authApi: { login: (...args: unknown[]) => login(...args), resendVerification: vi.fn() },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    replace.mockReset();
    login.mockReset();
  });

  it("valida antes de chamar a API", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Informe seu e-mail")).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it("redireciona com segurança para ?next após login", async () => {
    login.mockResolvedValue({ user: { onboardingCompleted: true } });
    render(<LoginForm next="//evil.com" />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senhaforte123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(replace).toHaveBeenCalledWith("/painel");
  });

  it("mostra erro genérico de credenciais e oferece reenvio quando e-mail não verificado", async () => {
    login.mockRejectedValueOnce(ApiError.fromBody({ success: false, code: "EMAIL_NOT_VERIFIED", message: "", statusCode: 403 }));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senhaforte123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirme seu e-mail");
    expect(screen.getByRole("button", { name: "Reenviar link de confirmação" })).toBeInTheDocument();
  });
});
