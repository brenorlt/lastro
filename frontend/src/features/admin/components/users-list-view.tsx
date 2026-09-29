"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { userMessage } from "@/services/api-error";
import type { SubscriptionStatus } from "@/types/admin";
import { useAdminUsers } from "../api";

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

export function UsersListView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const users = useAdminUsers(search, page);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <h1 className="text-lg font-semibold text-ink">Usuários</h1>
        <Input
          leading={<Search />}
          placeholder="Buscar por nome ou e-mail"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-72"
        />
      </div>

      {users.isPending ? (
        <div className="space-y-3 p-6" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : users.isError || !users.data ? (
        <ErrorState description={userMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : users.data.data.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-3 sm:px-6">Nenhum usuário encontrado.</p>
      ) : (
        <>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Nome</TH>
                <TH>Status</TH>
                <TH align="right">Cadastro</TH>
              </TR>
            </THead>
            <TBody>
              {users.data.data.map((u) => (
                <TR key={u.id} className="cursor-pointer">
                  <TD className="p-0">
                    <Link href={`/admin/usuarios/${u.id}`} className="flex h-14 flex-col justify-center px-4">
                      <span className="flex items-center gap-2 truncate font-medium text-ink">
                        {u.name}
                        {u.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
                      </span>
                      <span className="truncate text-xs text-ink-3">{u.email}</span>
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[u.subscriptionStatus]}>{STATUS_LABEL[u.subscriptionStatus]}</Badge>
                  </TD>
                  <TD align="right" className="text-ink-3">{formatDate(u.createdAt, "short")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {users.data.meta && users.data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="font-medium text-accent disabled:text-ink-3">
                Anterior
              </button>
              <span className="num">Página {page} de {users.data.meta.totalPages}</span>
              <button
                type="button"
                disabled={page >= users.data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="font-medium text-accent disabled:text-ink-3"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
