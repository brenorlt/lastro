"use client";

import { CheckCircle2, FileUp, RefreshCw, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useId, useMemo, useRef, useState } from "react";
import { Amount } from "@/components/finance/amount";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Badge, Card } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { CategorySelect, PaymentSourceSelect } from "@/features/transactions/components/entity-selects";
import { cn } from "@/lib/cn";
import { parseISODate, todayISO } from "@/lib/dates";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { ApiError, userMessage } from "@/services/api-error";
import { useUiStore } from "@/stores/ui-store";
import { IMPORT_ACCEPT, IMPORT_MAX_BYTES, useCommitImport, useImportPreview } from "../api";
import type { ImportPreview, ImportPreviewRow, ImportRowStatus, ImportTarget } from "../types";

type RowState = { selected: boolean; categoryId: string | null };
type Selection = Record<string, RowState>;

const importable = (r: ImportPreviewRow) => r.status === "NEW" || r.status === "DUPLICATE";

const STATUS_BADGE: Record<ImportRowStatus, { label: string; tone: "warning" | "neutral" } | null> = {
  NEW: null,
  DUPLICATE: { label: "Possível duplicata", tone: "warning" },
  IMPORTED: { label: "Já importado", tone: "neutral" },
  UNSUPPORTED: { label: "Não importável", tone: "neutral" },
};

/** Duplicatas começam desmarcadas: o usuário decide olhando o motivo. */
function initialSelection(rows: ImportPreviewRow[]): Selection {
  return Object.fromEntries(rows.map((r) => [r.externalId, { selected: r.status === "NEW", categoryId: r.categoryId }]));
}

/** Mensagem principal + o detalhe que a API manda (ex.: "Extrato em PDF ainda não é suportado"). */
function errorText(err: unknown): string {
  const detail = err instanceof ApiError ? err.fields[0]?.message : undefined;
  if (err instanceof ApiError && err.code === "VALIDATION_ERROR" && detail) return detail;
  return detail ? `${userMessage(err)}. ${detail}.` : userMessage(err);
}

function Dropzone({ file, busy, onFile }: { file: File | null; busy: boolean; onFile: (f: File | undefined) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center",
        "transition-colors duration-150 hover:border-accent hover:bg-accent-soft/40 focus-within:border-accent",
        over && "border-accent bg-accent-soft/60",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={input}
        id={id}
        type="file"
        accept={IMPORT_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          // Permite escolher o mesmo arquivo de novo depois de trocar a conta.
          if (input.current) input.current.value = "";
        }}
      />
      <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        {busy ? <RefreshCw className="size-5 animate-spin" /> : <FileUp className="size-5" />}
      </span>
      {file ? (
        <>
          <p className="text-sm font-medium text-ink">{file.name}</p>
          <p className="text-xs text-ink-3">{busy ? "Lendo o extrato…" : "Clique ou arraste outro arquivo para trocar"}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-ink">
            Arraste o extrato aqui ou <span className="text-accent">escolha um arquivo</span>
          </p>
          <p className="text-xs text-ink-3">OFX ou CSV exportado pelo seu banco, até 2 MB</p>
        </>
      )}
    </label>
  );
}

const Row = memo(function Row({
  row,
  state,
  hidden,
  onChange,
}: {
  row: ImportPreviewRow;
  state: RowState;
  hidden: boolean;
  onChange: (id: string, patch: Partial<RowState>) => void;
}) {
  const enabled = importable(row);
  const badge = STATUS_BADGE[row.status];
  const checkId = `import-${row.externalId}`;
  return (
    <div
      role="listitem"
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5",
        "md:grid-cols-[auto_4.5rem_1fr_13rem_7.5rem]",
        !enabled && "opacity-55",
        enabled && !state.selected && "bg-surface-sunken/40",
      )}
    >
      <input
        id={checkId}
        type="checkbox"
        checked={enabled && state.selected}
        disabled={!enabled}
        onChange={(e) => onChange(row.externalId, { selected: e.target.checked })}
        className="size-4 cursor-pointer accent-accent disabled:cursor-not-allowed"
      />
      <span className="num hidden text-xs text-ink-3 md:block">{formatDate(parseISODate(row.date), "short")}</span>
      <label htmlFor={checkId} className="min-w-0 cursor-pointer">
        <span className="block truncate text-sm text-ink">{row.description}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-3">
          <span className="num md:hidden">{formatDate(parseISODate(row.date), "short")}</span>
          {badge && <Badge tone={badge.tone} title={row.reason ?? undefined}>{badge.label}</Badge>}
          {row.reason && row.status !== "NEW" && <span className="hidden sm:inline">{row.reason}</span>}
        </span>
      </label>
      <Amount
        value={row.amount}
        flow={row.type === "INCOME" ? "income" : "expense"}
        hidden={hidden}
        className="text-sm font-medium md:order-last md:text-right"
      />
      <div className="col-span-3 col-start-1 md:col-span-1 md:col-start-auto">
        {enabled && (
          <CategorySelect
            type={row.type}
            value={state.categoryId}
            onChange={(categoryId) => onChange(row.externalId, { categoryId })}
            aria-label={`Categoria de ${row.description}`}
          />
        )}
      </div>
    </div>
  );
});

function BalanceCheck({ preview, delta, hidden }: { preview: ImportPreview; delta: number; hidden: boolean }) {
  const { statementBalance, target } = preview;
  if (target.kind !== "ACCOUNT" || !statementBalance || target.currentBalance === null) return null;
  const after = toNumber(target.currentBalance) + delta;
  const bank = toNumber(statementBalance.amount);
  const matches = Math.abs(after - bank) < 0.005;
  const money = (v: number) => (hidden ? "R$ ••••" : formatCurrency(v));
  return (
    <FormAlert tone={matches ? "success" : "info"}>
      {matches ? (
        <>O saldo do Lastro vai bater com o do banco: {money(bank)}.</>
      ) : (
        <>
          O banco informa saldo de <strong className="num">{money(bank)}</strong> em{" "}
          {formatDate(parseISODate(statementBalance.date), "short")}; depois de importar, {target.name} ficará com{" "}
          <strong className="num">{money(after)}</strong>. A diferença costuma vir do saldo inicial da conta ou de
          lançamentos fora do período do extrato.
        </>
      )}
    </FormAlert>
  );
}

export function ImportView() {
  const router = useRouter();
  const hidden = useUiStore((s) => s.privacyMode);
  const [target, setTarget] = useState<ImportTarget>({ accountId: null, creditCardId: null });
  const [file, setFile] = useState<File | null>(null);
  const [invert, setInvert] = useState(false);
  const [selection, setSelection] = useState<Selection>({});
  const previewM = useImportPreview();
  const commit = useCommitImport();
  const preview = previewM.data ?? null;
  const hasTarget = Boolean(target.accountId || target.creditCardId);

  const run = (next: { file: File | null; target: ImportTarget; invert: boolean }) => {
    if (!next.file || !(next.target.accountId || next.target.creditCardId)) return;
    previewM.mutate(
      { file: next.file, target: next.target, invertSigns: next.invert },
      { onSuccess: (data) => setSelection(initialSelection(data.rows)) },
    );
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > IMPORT_MAX_BYTES) return void toast.error("O arquivo deve ter no máximo 2 MB.");
    setFile(f);
    setInvert(false);
    run({ file: f, target, invert: false });
  };

  const onTarget = (t: ImportTarget) => {
    setTarget(t);
    // A identidade das linhas e as duplicatas dependem do destino: refaz a prévia.
    run({ file, target: t, invert });
  };

  const onRowChange = useCallback((id: string, patch: Partial<RowState>) => {
    setSelection((s) => ({ ...s, [id]: { ...s[id], ...patch } as RowState }));
  }, []);

  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const eligible = useMemo(() => rows.filter(importable), [rows]);
  const chosen = useMemo(() => eligible.filter((r) => selection[r.externalId]?.selected), [eligible, selection]);
  const counts = useMemo(() => {
    const c: Record<ImportRowStatus, number> = { NEW: 0, DUPLICATE: 0, IMPORTED: 0, UNSUPPORTED: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);
  const totals = useMemo(() => {
    const today = todayISO();
    let income = 0;
    let expense = 0;
    let cleared = 0;
    for (const r of chosen) {
      const v = toNumber(r.amount);
      if (r.type === "INCOME") income += v;
      else expense += v;
      // Datas futuras entram como pendentes e não mexem no saldo.
      if (r.date <= today) cleared += r.type === "INCOME" ? v : -v;
    }
    return { income, expense, cleared };
  }, [chosen]);

  const allChosen = eligible.length > 0 && chosen.length === eligible.length;
  const toggleAll = () =>
    setSelection((s) => {
      const next = { ...s };
      for (const r of eligible) next[r.externalId] = { ...next[r.externalId], selected: !allChosen } as RowState;
      return next;
    });

  const submit = () => {
    if (!preview || chosen.length === 0) return;
    commit.mutate(
      {
        target,
        rows: chosen.map((r) => ({
          externalId: r.externalId,
          type: r.type,
          amount: r.amount,
          description: r.description,
          date: r.date,
          categoryId: selection[r.externalId]?.categoryId ?? null,
        })),
      },
      {
        onSuccess: ({ created, skipped }) => {
          toast.success(created === 1 ? "1 lançamento importado" : `${created} lançamentos importados`, {
            description: skipped ? `${skipped} já estavam importados e foram ignorados.` : preview.target.name,
          });
          router.push("/lancamentos");
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  const kindMismatch =
    preview &&
    preview.statementKind &&
    (preview.statementKind === "CARD") !== (preview.target.kind === "CARD");

  return (
    <>
      <PageHeader
        title="Importar extrato"
        description="Traga o extrato OFX ou CSV do seu banco. Nada é gravado até você revisar e confirmar."
        breadcrumbs={[{ label: "Lastro", href: "/painel" }, { label: "Lançamentos", href: "/lancamentos" }, { label: "Importar" }]}
      />

      <Card className="space-y-5 p-5 sm:p-6">
        <Field label="De qual conta ou cartão é este extrato?" hint="Receitas vão para a conta; no cartão entram só as compras.">
          <PaymentSourceSelect accountId={target.accountId} creditCardId={target.creditCardId} onChange={onTarget} />
        </Field>
        <div className={cn(!hasTarget && "pointer-events-none opacity-50")} aria-disabled={!hasTarget}>
          <Dropzone file={file} busy={previewM.isPending} onFile={onFile} />
        </div>
        {previewM.isError && <FormAlert>{errorText(previewM.error)}</FormAlert>}
        <details className="group text-sm text-ink-2">
          <summary className="cursor-pointer select-none text-xs font-medium text-ink-3 hover:text-ink">
            Onde encontro o arquivo do extrato?
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            No app ou no internet banking, abra o extrato da conta (ou a fatura do cartão), escolha o período e procure
            por “Exportar” ou “Baixar”. Prefira <strong className="text-ink-2">OFX</strong> (às vezes chamado de
            “Money” ou “Quicken”): ele identifica cada lançamento e evita duplicatas. PDF e Excel não são aceitos.
          </p>
        </details>
      </Card>

      {preview && (
        <div className={cn("mt-6 space-y-4 transition-opacity", previewM.isPending && "opacity-60")}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Revise antes de importar</h2>
              <p className="mt-0.5 text-xs text-ink-3">
                {preview.target.name} · {preview.format} · {rows.length} {rows.length === 1 ? "linha" : "linhas"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="accent">{counts.NEW} novos</Badge>
              {counts.DUPLICATE > 0 && <Badge tone="warning">{counts.DUPLICATE} possíveis duplicatas</Badge>}
              {counts.IMPORTED > 0 && <Badge>{counts.IMPORTED} já importados</Badge>}
              {counts.UNSUPPORTED > 0 && <Badge>{counts.UNSUPPORTED} não importáveis</Badge>}
            </div>
          </div>

          {kindMismatch && (
            <FormAlert tone="info">
              {preview.statementKind === "CARD"
                ? "Este arquivo parece ser a fatura de um cartão, mas você escolheu uma conta."
                : "Este arquivo parece ser o extrato de uma conta, mas você escolheu um cartão."}{" "}
              Confira o destino acima.
            </FormAlert>
          )}
          <BalanceCheck preview={preview} delta={totals.cleared} hidden={hidden} />

          <Card className="overflow-hidden">
            {preview.format === "CSV" && (
              <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
                <label htmlFor="invert-signs" className="min-w-0">
                  <span className="block text-sm text-ink">Inverter entradas e saídas</span>
                  <span className="block text-xs text-ink-3">Use se as despesas aparecerem como receitas.</span>
                </label>
                <Switch
                  id="invert-signs"
                  checked={invert}
                  disabled={previewM.isPending}
                  onCheckedChange={(v) => {
                    setInvert(v);
                    run({ file, target, invert: v });
                  }}
                />
              </div>
            )}
            <div className="flex items-center gap-3 border-b border-line bg-surface-sunken/50 px-4 py-2.5 sm:px-5">
              <input
                id="import-all"
                type="checkbox"
                checked={allChosen}
                disabled={eligible.length === 0}
                onChange={toggleAll}
                className="size-4 cursor-pointer accent-accent"
              />
              <label htmlFor="import-all" className="cursor-pointer text-2xs font-medium uppercase tracking-[0.06em] text-ink-3">
                {allChosen ? "Desmarcar todos" : "Selecionar todos"}
              </label>
            </div>
            <div role="list" aria-label="Linhas do extrato" className="divide-y divide-line">
              {rows.map((r) => (
                <Row
                  key={r.externalId}
                  row={r}
                  state={selection[r.externalId] ?? { selected: false, categoryId: r.categoryId }}
                  hidden={hidden}
                  onChange={onRowChange}
                />
              ))}
            </div>
          </Card>

          <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] z-30 md:bottom-6">
            <Card className="flex items-center justify-between gap-3 px-4 py-3 shadow-lg sm:px-5">
              <div className="min-w-0 text-xs text-ink-3">
                <p className="text-sm font-medium text-ink">
                  {chosen.length} {chosen.length === 1 ? "selecionado" : "selecionados"}
                </p>
                <p className="num">
                  <Amount value={totals.income} flow="income" hidden={hidden} /> ·{" "}
                  <Amount value={totals.expense} flow="expense" hidden={hidden} />
                </p>
              </div>
              <Button onClick={submit} loading={commit.isPending} disabled={chosen.length === 0 || previewM.isPending}>
                {chosen.length > 0 ? <CheckCircle2 aria-hidden /> : <Scale aria-hidden />}
                {chosen.length > 0 ? `Importar ${chosen.length}` : "Nada selecionado"}
              </Button>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
