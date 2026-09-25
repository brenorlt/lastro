import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/services/api-error";
import { RegisterForm } from "../components/register-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const register = vi.fn();
const login = vi.fn();
vi.mock("../api", () => ({
  authApi: {
    register: (...a: unknown[]) => register(...a),
    login: (...a: unknown[]) => login(...a),
    resendVerification: vi.fn(),
  },
}));

async function fill() {
  await userEvent.type(screen.getByLabelText("Nome"), "Ana Souza");
  await userEvent.type(screen.getByLabelText("E-mail"), "ana@exemplo.com");
  await userEvent.type(screen.getByLabelText("Senha"), "senhaforte123");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("RegisterForm", () => {
  beforeEach(() => {
    replace.mockReset();
    register.mockReset().mockResolvedValue({ data: { message: "ok" } });
    login.mockReset();
  });

  it("entra direto quando o backend não exige confirmação", async () => {
    login.mockResolvedValue({ user: { onboardingCompleted: false } });
    render(<RegisterForm />);
    await fill();
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("mostra a tela neutra de e-mail quando a confirmação é exigida", async () => {
    login.mockRejectedValue(ApiError.fromBody({ success: false, code: "EMAIL_NOT_VERIFIED", message: "", statusCode: 403 }));
    render(<RegisterForm />);
    await fill();
    expect(await screen.findByText("ana@exemplo.com")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
