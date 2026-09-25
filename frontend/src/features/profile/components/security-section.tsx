"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { SettingsSection } from "@/components/ui/settings-section";
import { ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toaster";
import { authApi } from "@/features/auth/api";
import { useApiFormErrors } from "@/hooks/use-api-form-errors";
import { formatDate } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import { userMessage } from "@/services/api-error";
import type { ActiveSession } from "@/types/auth";
import { changePasswordSchema, type ChangePasswordInput } from "../schemas";

const SESSIONS_KEY = ["auth", "sessions"] as const;

function ChangePasswordForm() {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), mode: "onTouched" });
  const { formError, handle } = useApiFormErrors(setError, ["currentPassword", "newPassword"] as const);

  const onSubmit = async (v: ChangePasswordInput) => {
    try {
      await authApi.changePassword(v.currentPassword, v.newPassword);
      reset();
      await queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.success("Senha alterada", { description: "Por segurança, as outras sessões foram encerradas." });
    } catch (err) {
      handle(err);
    }
  };

  return (
    <Card>
      <CardHeader title="Alterar senha" description="Ao trocar a senha, todos os outros dispositivos são desconectados." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Senha atual" error={errors.currentPassword?.message} className="sm:col-span-2">
          <PasswordInput autoComplete="current-password" {...register("currentPassword")} />
        </Field>
        <Field label="Nova senha" hint="Mínimo de 10 caracteres, com letras e números." error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" {...register("newPassword")} />
        </Field>
        <Field label="Confirme a nova senha" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirm")} />
        </Field>
        {formError && <p role="alert" className="text-sm text-negative sm:col-span-2">{formError.message}</p>}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" loading={isSubmitting}>Alterar senha</Button>
        </div>
      </form>
    </Card>
  );
}

function SessionRow({ session, onRevoke, revoking }: { session: ActiveSession; onRevoke: () => void; revoking: boolean }) {
  const { browser, os, mobile } = describeUserAgent(session.userAgent);
  const Icon = mobile ? Smartphone : Monitor;
  return (
    <li className="flex items-center gap-4 px-5 py-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-ink-2">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          {browser}{os && ` · ${os}`}
          {session.current && <Badge tone="positive">Este dispositivo</Badge>}
        </p>
        <p className="truncate text-xs text-ink-3">
          {session.ip ? `IP ${session.ip} · ` : ""}Ativa desde {formatDate(session.createdAt)}
          {session.lastUsedAt && ` · último uso ${formatDate(session.lastUsedAt)}`}
        </p>
      </div>
      {!session.current && (
        <Button variant="ghost" size="sm" onClick={onRevoke} loading={revoking}>
          Encerrar
        </Button>
      )}
    </li>
  );
}

function SessionsCard() {
  const queryClient = useQueryClient();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: async () => (await authApi.sessions()).data });

  const revoke = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previous = queryClient.getQueryData<ActiveSession[]>(SESSIONS_KEY);
      queryClient.setQueryData<ActiveSession[]>(SESSIONS_KEY, (list) => list?.filter((s) => s.id !== id));
      return { previous };
    },
    onError: (err, _id, ctx) => {
      queryClient.setQueryData(SESSIONS_KEY, ctx?.previous);
      toast.error(userMessage(err));
    },
    onSuccess: () => toast.success("Sessão encerrada"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  const revokeOthers = useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: ({ data }) => {
      setConfirmOthers(false);
      toast.success(data.revoked === 1 ? "1 sessão encerrada" : `${data.revoked} sessões encerradas`);
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    onError: (err) => toast.error(userMessage(err)),
  });

  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <Card>
      <CardHeader
        title="Sessões ativas"
        description="Dispositivos conectados à sua conta. Encerre qualquer um que você não reconheça."
        action={
          others > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setConfirmOthers(true)}>
              <LogOut aria-hidden /> Sair dos outros
            </Button>
          )
        }
      />
      {sessions.isPending ? (
        <div className="space-y-3 p-6" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : sessions.isError ? (
        <ErrorState description={userMessage(sessions.error)} onRetry={() => void sessions.refetch()} />
      ) : (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {sessions.data.map((s) => (
            <SessionRow key={s.id} session={s} onRevoke={() => revoke.mutate(s.id)} revoking={revoke.isPending && revoke.variables === s.id} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sair de todos os outros dispositivos?"
        description={`${others} ${others === 1 ? "sessão será encerrada" : "sessões serão encerradas"} imediatamente. Este dispositivo continua conectado.`}
        confirmLabel="Encerrar sessões"
        loading={revokeOthers.isPending}
        onConfirm={() => revokeOthers.mutate()}
      />
    </Card>
  );
}

export function SecuritySection() {
  return (
    <SettingsSection id="seguranca" title="Segurança" description="Senha e dispositivos com acesso à sua conta.">
      <div className="space-y-4">
        <ChangePasswordForm />
        <SessionsCard />
      </div>
    </SettingsSection>
  );
}
