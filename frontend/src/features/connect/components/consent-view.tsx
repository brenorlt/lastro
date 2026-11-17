"use client";

import { Ban, Check, KeyRound, Landmark, PencilLine, Eye, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Skeleton } from "@/components/ui/primitives";
import { userMessage } from "@/services/api-error";
import { useAuthStore } from "@/stores/auth-store";
import { type AuthorizeParams, useConsentDetails, useDecide } from "../api";

export const CAN = [
  { icon: Eye, text: "Ver saldos, lançamentos, cartões, orçamentos, metas e patrimônio" },
  { icon: PencilLine, text: "Registrar e editar receitas, despesas e transferências" },
  { icon: Check, text: "Marcar contas como pagas e guardar dinheiro nas metas" },
];

export const CANNOT = [
  { icon: Trash2, text: "Excluir qualquer dado" },
  { icon: KeyRound, text: "Ver sua senha ou alterar sua conta" },
  { icon: Landmark, text: "Acessar seu banco ou movimentar dinheiro de verdade" },
];

export function PermissionList({ title, items, tone }: { title: string; items: typeof CAN; tone: "can" | "cannot" }) {
  return (
    <div>
      <p className="text-ink-3 text-2xs mb-2 font-medium tracking-[0.12em] uppercase">{title}</p>
      <ul className="space-y-2.5">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span
              className={
                tone === "can"
                  ? "bg-positive-soft text-positive flex size-6 shrink-0 items-center justify-center rounded-md"
                  : "bg-surface-sunken text-ink-3 flex size-6 shrink-0 items-center justify-center rounded-md"
              }
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className={tone === "can" ? "text-ink" : "text-ink-2"}>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

/**
 * Tela de consentimento OAuth: um app (ex.: Claude) pede acesso à conta. A pessoa vê
 * exatamente o que ele poderá e não poderá fazer, e para onde volta depois.
 */
export function ConsentView({ params, error }: { params: AuthorizeParams; error: string | null }) {
  const user = useAuthStore((s) => s.user);
  const details = useConsentDetails(params, !error);
  const decide = useDecide();

  const respond = (approve: boolean) =>
    decide.mutate(
      { ...params, approve },
      { onSuccess: ({ redirectTo }) => window.location.assign(redirectTo) },
    );

  if (error || details.isError || (details.data && !details.data.valid)) {
    const message = error ?? details.data?.problem ?? userMessage(details.error);
    return (
      <Shell>
        <div className="bg-negative-soft text-negative flex size-11 items-center justify-center rounded-lg">
          <Ban className="size-5" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-ink text-2xl font-semibold tracking-tight">Não foi possível conectar</h1>
          <p className="text-ink-2 text-sm">{message}</p>
          <p className="text-ink-2 text-sm">Volte ao aplicativo que abriu esta página e tente conectar de novo.</p>
        </div>
        <Link href="/painel" className="text-accent text-sm font-medium underline-offset-4 hover:underline">
          Ir para o Lastro
        </Link>
      </Shell>
    );
  }

  if (details.isPending) {
    return (
      <Shell>
        <Skeleton className="h-11 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </Shell>
    );
  }

  const { appName, redirectHost } = details.data;
  const done = decide.isSuccess;

  return (
    <Shell>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="bg-surface ring-line flex size-11 items-center justify-center rounded-lg text-lg font-semibold ring-1">
          {appName.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-ink-3 tracking-[0.3em]">···</span>
        <LogoMark className="size-11" />
      </div>

      <div className="space-y-2">
        <h1 className="text-ink text-2xl font-semibold tracking-tight">Conectar {appName} ao Lastro</h1>
        <p className="text-ink-2 text-sm">
          <strong className="text-ink font-medium">{appName}</strong> quer acessar a conta{" "}
          <strong className="text-ink font-medium">{user?.email}</strong> para ajudar você a cuidar das suas finanças.
        </p>
      </div>

      <div className="bg-surface ring-line space-y-5 rounded-xl p-5 ring-1">
        <PermissionList title="Poderá" items={CAN} tone="can" />
        <div className="border-line border-t" />
        <PermissionList title="Não poderá" items={CANNOT} tone="cannot" />
      </div>

      {decide.isError && <FormAlert>{userMessage(decide.error)}</FormAlert>}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" className="sm:flex-1" loading={decide.isPending && decide.variables?.approve} disabled={done} onClick={() => respond(true)}>
          Permitir acesso
        </Button>
        <Button size="lg" variant="secondary" className="sm:flex-1" disabled={decide.isPending || done} onClick={() => respond(false)}>
          Cancelar
        </Button>
      </div>

      <p className="text-ink-3 flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
        <span>
          Depois de responder, você volta para <strong className="text-ink-2 font-medium">{redirectHost}</strong>. Desconecte quando quiser
          em Perfil → Apps conectados.
        </span>
      </p>
    </Shell>
  );
}
