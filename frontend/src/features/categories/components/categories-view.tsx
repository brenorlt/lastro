"use client";

import { CornerDownRight, MoreHorizontal, Pencil, Plus, RotateCcw, Shapes, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Card, Skeleton } from "@/components/ui/primitives";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { userMessage } from "@/services/api-error";
import type { Category, CategoryType } from "@/types/finance";
import { useCategories, useRestoreDefaults } from "../api";
import { CategoryFormDialog } from "./category-form";
import { DeleteCategoryDialog } from "./delete-category-dialog";

type FormState = { category?: Category | null; parentId?: string | null } | null;

function usageLabel(n: number) {
  if (n === 0) return "Sem lançamentos";
  return n === 1 ? "1 lançamento" : `${n} lançamentos`;
}

function CategoryRow({
  category,
  nested,
  onEdit,
  onAddSub,
  onDelete,
}: {
  category: Category;
  nested?: boolean;
  onEdit: () => void;
  onAddSub?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("group flex items-center gap-3 py-3 pr-3 sm:pr-4", nested ? "pl-5 sm:pl-8" : "pl-4 sm:pl-5")}>
      {nested && <CornerDownRight className="size-4 shrink-0 text-ink-3" aria-hidden />}
      <EntityIcon icon={category.icon} color={category.color} size={nested ? "sm" : "md"} />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 rounded-xs text-left">
        <span className={cn("block truncate text-ink", nested ? "text-sm" : "text-sm font-medium")}>{category.name}</span>
        <span className="block text-xs text-ink-3 num">{usageLabel(category.transactionCount)}</span>
      </button>
      {onAddSub && (
        <Button variant="ghost" size="sm" onClick={onAddSub} className="hidden opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 sm:inline-flex">
          <Plus aria-hidden /> Subcategoria
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={`Ações de ${category.name}`} size="icon-sm"><MoreHorizontal /></IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Editar</DropdownMenuItem>
          {onAddSub && <DropdownMenuItem onSelect={onAddSub}><Plus aria-hidden /> Adicionar subcategoria</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onDelete}><Trash2 aria-hidden /> Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CategoriesView() {
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [form, setForm] = useState<FormState>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const query = useCategories(type);
  const restore = useRestoreDefaults();
  const tree = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Categorias"
        description="Organize receitas e despesas do seu jeito. Subcategorias detalham sem poluir os relatórios."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Categorias" }]}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Mais opções" variant="secondary"><MoreHorizontal /></IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => restore.mutate()}><RotateCcw aria-hidden /> Restaurar categorias padrão</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setForm({ parentId: null })}><Plus aria-hidden /> Nova categoria</Button>
          </>
        }
      />

      <Tabs value={type} onValueChange={(v) => setType(v as CategoryType)} className="mb-5">
        <TabsList aria-label="Tipo de categoria">
          <TabsTrigger value="EXPENSE">Despesas</TabsTrigger>
          <TabsTrigger value="INCOME">Receitas</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isPending ? (
        <Card className="divide-y divide-line" aria-busy="true" aria-label="Carregando categorias">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3"><Skeleton className="size-10 rounded-md" /><div className="space-y-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div></div>
          ))}
        </Card>
      ) : query.isError ? (
        <Card><ErrorState description={userMessage(query.error)} onRetry={() => void query.refetch()} /></Card>
      ) : tree.length === 0 ? (
        <Card>
          <EmptyState
            icon={Shapes}
            title={`Nenhuma categoria de ${type === "EXPENSE" ? "despesa" : "receita"}`}
            description="Categorias dão sentido aos seus números: é por elas que você descobre para onde o dinheiro vai."
            action={<Button onClick={() => setForm({ parentId: null })}><Plus aria-hidden /> Nova categoria</Button>}
            secondaryAction={<Button variant="ghost" loading={restore.isPending} onClick={() => restore.mutate()}>Restaurar padrão</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {tree.map((c) => (
            <li key={c.id}>
              <Card className="overflow-hidden">
                <CategoryRow
                  category={c}
                  onEdit={() => setForm({ category: c })}
                  onAddSub={() => setForm({ parentId: c.id })}
                  onDelete={() => setDeleting(c)}
                />
                {(c.children?.length ?? 0) > 0 && (
                  <ul className="divide-y divide-line border-t border-line bg-surface-sunken/40">
                    {c.children!.map((sub) => (
                      <li key={sub.id}>
                        <CategoryRow nested category={sub} onEdit={() => setForm({ category: sub })} onDelete={() => setDeleting(sub)} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CategoryFormDialog
        open={form !== null}
        onOpenChange={(v) => !v && setForm(null)}
        type={type}
        parents={tree}
        category={form?.category}
        defaultParentId={form?.parentId}
      />
      <DeleteCategoryDialog category={deleting} tree={tree} onOpenChange={(v) => !v && setDeleting(null)} />
    </>
  );
}
