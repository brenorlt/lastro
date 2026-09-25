"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { EntityIcon } from "@/components/ui/entity-icon";
import { Field, Label } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Input } from "@/components/ui/input";
import { ColorPicker, IconPicker } from "@/components/ui/pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { ApiError } from "@/services/api-error";
import type { Category, CategoryType } from "@/types/finance";
import { categorySchema, useSaveCategory, type CategoryFormValues } from "../api";

const ROOT = "__root__";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: CategoryType;
  /** Categorias de nível superior do mesmo tipo (possíveis pais). */
  parents: Category[];
  category?: Category | null;
  /** Pré-seleciona o pai ao criar uma subcategoria. */
  defaultParentId?: string | null;
}

export function CategoryFormDialog({ open, onOpenChange, type, parents, category, defaultParentId }: CategoryFormDialogProps) {
  const save = useSaveCategory();
  const parentOf = parents.find((p) => p.id === (category?.parentId ?? defaultParentId));
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    values: category
      ? { name: category.name, icon: category.icon, color: category.color.toUpperCase(), parentId: category.parentId }
      : { name: "", icon: parentOf?.icon ?? "ellipsis", color: (parentOf?.color ?? "#3F51D8").toUpperCase(), parentId: defaultParentId ?? null },
  });
  const { formError, setFormError, handle } = useApiFormErrors(setError, ["name"] as const);
  const preview = useWatch({ control });
  const hasChildren = (category?.children?.length ?? 0) > 0;
  const candidates = parents.filter((p) => p.id !== category?.id);

  const onSubmit = async (v: CategoryFormValues) => {
    setFormError(null);
    try {
      await save.mutateAsync({ id: category?.id, input: { ...v, type } });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "CATEGORY_ALREADY_EXISTS") setError("name", { message: "Já existe uma categoria com esse nome aqui" });
      else handle(err);
    }
  };

  const noun = type === "EXPENSE" ? "despesa" : "receita";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={category ? "Editar categoria" : preview.parentId ? "Nova subcategoria" : `Nova categoria de ${noun}`}
        footer={
          <>
            <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
            <Button type="submit" form="category-form" loading={save.isPending}>{category ? "Salvar alterações" : "Criar categoria"}</Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {formError && <FormAlert>{formError.message}</FormAlert>}
          <div className="flex items-end gap-3">
            <EntityIcon icon={preview.icon ?? "ellipsis"} color={preview.color ?? "#3F51D8"} size="lg" />
            <Field label="Nome" error={errors.name?.message} className="flex-1">
              <Input autoFocus placeholder={type === "EXPENSE" ? "Ex.: Farmácia" : "Ex.: Aluguel recebido"} {...register("name")} />
            </Field>
          </div>
          <Controller
            control={control}
            name="parentId"
            render={({ field }) => (
              <Field label="Dentro de" hint={hasChildren ? "Categorias com subcategorias permanecem no nível principal." : "Subcategorias ajudam a detalhar sem poluir os relatórios."}>
                <Select value={field.value ?? ROOT} onValueChange={(v) => field.onChange(v === ROOT ? null : v)} disabled={hasChildren}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROOT}>Nenhuma (categoria principal)</SelectItem>
                    {candidates.map((p) => (
                      <SelectItem key={p.id} value={p.id} leading={<EntityIcon icon={p.icon} color={p.color} size="sm" className="size-6 [&_svg]:size-3.5" />}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <div className="space-y-2">
            <Label>Cor</Label>
            <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} label="Cor da categoria" />} />
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <Controller control={control} name="icon" render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} color={preview.color ?? "#3F51D8"} label="Ícone da categoria" />} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
