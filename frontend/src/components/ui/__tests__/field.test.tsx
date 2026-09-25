import { render, screen } from "@testing-library/react";
import { Field } from "../field";
import { Input } from "../input";

describe("Field", () => {
  it("liga rótulo, controle e mensagem de erro via ARIA", () => {
    render(
      <Field label="Valor" error="Informe um valor">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Valor");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Informe um valor");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um valor");
  });
});
