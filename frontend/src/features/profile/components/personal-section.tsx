"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheck, Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Avatar, Badge, Card } from "@/components/ui/primitives";
import { SettingsSection } from "@/components/ui/settings-section";
import { toast } from "@/components/ui/toaster";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { userMessage } from "@/services/api-error";
import type { User } from "@/types/auth";
import { profileApi } from "../api";
import { personalSchema, type PersonalInput } from "../schemas";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function AvatarEditor({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return toast.error("Use uma imagem JPG, PNG ou WEBP.");
    if (file.size > MAX_AVATAR_BYTES) return toast.error("A imagem deve ter no máximo 2 MB.");
    setBusy(true);
    try {
      await profileApi.uploadAvatar(file);
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error(userMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await profileApi.removeAvatar();
      toast.success("Foto removida");
    } catch (err) {
      toast.error(userMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-5 px-5 pt-5 sm:px-6 sm:pt-6">
      <Avatar name={user.name} src={user.avatarUrl} size={64} />
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept={ACCEPTED.join(",")} className="sr-only" id="avatar-file" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
          <Camera aria-hidden /> {user.avatarUrl ? "Trocar foto" : "Adicionar foto"}
        </Button>
        {user.avatarUrl && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
            <Trash2 aria-hidden /> Remover
          </Button>
        )}
        <p className="w-full text-xs text-ink-3">JPG, PNG ou WEBP, até 2 MB.</p>
      </div>
    </div>
  );
}

export function PersonalSection({ user }: { user: User }) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PersonalInput>({
    resolver: zodResolver(personalSchema),
    values: { name: user.name, phone: user.phone ?? "" },
  });
  const { formError, handle } = useApiFormErrors(setError, ["name", "phone"] as const);

  const onSubmit = async (values: PersonalInput) => {
    try {
      const updated = await profileApi.update({ name: values.name, phone: values.phone || null });
      reset({ name: updated.name, phone: updated.phone ?? "" });
      toast.success("Dados atualizados");
    } catch (err) {
      handle(err);
    }
  };

  return (
    <SettingsSection id="dados" title="Dados pessoais" description="Como você aparece no Lastro.">
      <Card>
        <AvatarEditor user={user} />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Nome" error={errors.name?.message}>
            <Input autoComplete="name" {...register("name")} />
          </Field>
          <Field label="Telefone" optional error={errors.phone?.message}>
            <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="+55 11 91234-5678" {...register("phone")} />
          </Field>
          <Field
            label="E-mail"
            className="sm:col-span-2"
            hint={
              user.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-positive">
                  <BadgeCheck className="size-3.5" aria-hidden /> Confirmado
                </span>
              ) : (
                "Ainda não confirmado."
              )
            }
          >
            <Input value={user.email} readOnly disabled />
          </Field>
          {formError && <p role="alert" className="text-sm text-negative sm:col-span-2">{formError.message}</p>}
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            {isDirty && <Badge tone="warning">Alterações não salvas</Badge>}
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Salvar dados
            </Button>
          </div>
        </form>
      </Card>
    </SettingsSection>
  );
}
