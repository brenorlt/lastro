"use client";

import { ArrowLeft, Ban, CalendarPlus, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge, Card, CardBody, CardHeader, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { BillingPaymentStatus, SubscriptionStatus } from "@/types/admin";
import { useAdminUser, useBlockUser, useGrantAccess, useUnblockUser } from "../api";

const STATUS_TONE: Record<SubscriptionStatus, "positive" | "warning" | "negative"> = {
  ACTIVE: "positive",
  TRIALING: "warning",
  BLOCKED: "negative",
  CANCELLED: "negative",
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativo",
  TRIALING: "Em teste",
  BLOCKED: "Bloqueado",
  CANCELLED: "Cancelado",
};

const PAYMENT_STATUS_TONE: Record<BillingPaymentStatus, "positive" | "warning" | "negative"> = {
  PAID: "positive",
  PENDING: "warning",
  FAILED: "negative",
  EXPIRED: "negative",
  REFUNDED: "negative",
};

const PAYMENT_STATUS_LABEL: Record<BillingPaymentStatus, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  FAILED: "Falhou",
  EXPIRED: "Expirado",
  REFUNDED: "Reembolsado",
};

function GrantAccessDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const grant = useGrantAccess(userId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <CalendarPlus aria-hidden /> Conceder acesso
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Conceder acesso manual"
        description="Ativa a conta e estende o acesso a partir de agora (ou do fim do ciclo vigente, se ainda estiver no futuro)."
        footer={
          <Button
            loading={grant.isPending}
            onClick={() =>
              grant.mutate(days, {
                onSuccess: () => {
                  setOpen(false);
                  toast.success(`Acesso concedido por ${days} dias`);
                },
                onError: (err) => toast.error(userMessage(err)),
              })
            }
          >
            Conceder {days} {days === 1 ? "dia" : "dias"}
          </Button>
        }
      >
        <Field label="Dias de acesso">
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
          />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

export function UserDetailView({ userId }: { userId: string }) {
  const user = useAdminUser(userId);
  const block = useBlockUser(userId);
  const unblock = useUnblockUser(userId);
  const [confirmBlock, setConfirmBlock] = useState(false);

  if (user.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (user.isError || !user.data) {
    return (
      <Card>
        <ErrorState description={userMessage(user.error)} onRetry={() => void user.refetch()} />
      </Card>
    );
  }

  const u = user.data;
  const isBlocked = u.subscriptionStatus === "BLOCKED";

  return (
    <div className="space-y-6">
      <Link href="/admin/usuarios" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Usuários
      </Link>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              {u.name}
              {u.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
            </span>
          }
          description={u.email}
          action={
            <div className="flex gap-2">
              <GrantAccessDialog userId={userId} />
              {isBlocked ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={unblock.isPending}
                  onClick={() =>
                    unblock.mutate(undefined, {
                      onSuccess: () => toast.success("Usuário desbloqueado"),
                      onError: (err) => toast.error(userMessage(err)),
                    })
                  }
                >
                  <CheckCircle2 aria-hidden /> Desbloquear
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirmBlock(true)}>
                  <Ban aria-hidden /> Bloquear
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-ink-3">Status</p>
            <Badge tone={STATUS_TONE[u.subscriptionStatus]} className="mt-1">
              {STATUS_LABEL[u.subscriptionStatus]}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-ink-3">Telefone</p>
            <p className="mt-1 text-sm text-ink">{u.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Vence em</p>
            <p className="mt-1 text-sm text-ink">{u.currentPeriodEnd ? formatDate(u.currentPeriodEnd) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Cadastrado em</p>
            <p className="mt-1 text-sm text-ink">{formatDate(u.createdAt)}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <h3 className="text-sm font-medium text-ink">Pagamentos</h3>
        </div>
        {u.payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3 sm:px-6">Nenhum pagamento ainda.</p>
        ) : (
          <Table className="mt-2">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Método</TH>
                <TH>Status</TH>
                <TH align="right">Valor</TH>
                <TH align="right">Criado em</TH>
                <TH align="right">Pago em</TH>
              </TR>
            </THead>
            <TBody>
              {u.payments.map((p) => (
                <TR key={p.id}>
                  <TD>{p.method === "PIX" ? "Pix" : "Boleto"}</TD>
                  <TD>
                    <Badge tone={PAYMENT_STATUS_TONE[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  </TD>
                  <TD align="right">{formatCurrency(p.amount)}</TD>
                  <TD align="right" className="text-ink-3">{formatDate(p.createdAt, "short")}</TD>
                  <TD align="right" className="text-ink-3">{p.paidAt ? formatDate(p.paidAt, "short") : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title="Bloquear este usuário?"
        description="O acesso é suspenso imediatamente, independente do ciclo pago em vigor."
        confirmLabel="Bloquear"
        loading={block.isPending}
        onConfirm={() =>
          block.mutate(undefined, {
            onSuccess: () => {
              setConfirmBlock(false);
              toast.success("Usuário bloqueado");
            },
            onError: (err) => toast.error(userMessage(err)),
          })
        }
      />
    </div>
  );
}
