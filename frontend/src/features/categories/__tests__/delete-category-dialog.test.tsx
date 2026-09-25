import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { Category } from "@/types/finance";
import { DeleteCategoryDialog } from "../components/delete-category-dialog";

const cat = (id: string, n: number, children: Category[] = []): Category => ({
  id, name: `Cat ${id}`, type: "EXPENSE", icon: "house", color: "#F97316", parentId: null, isDefault: false, transactionCount: n, children,
});

function renderDialog(category: Category, tree: Category[]) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <DeleteCategoryDialog category={category} tree={tree} onOpenChange={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("DeleteCategoryDialog", () => {
  it("exige destino quando há lançamentos (inclui os das subcategorias)", () => {
    const sub = { ...cat("s", 2), parentId: "a" };
    const a = cat("a", 1, [sub]);
    renderDialog(a, [a, cat("b", 0)]);
    expect(screen.getByText(/3 lançamentos usam/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover e excluir" })).toBeDisabled();
  });

  it("exclui direto quando não há uso", () => {
    const a = cat("a", 0);
    renderDialog(a, [a]);
    expect(screen.getByRole("button", { name: "Excluir categoria" })).toBeEnabled();
  });
});
