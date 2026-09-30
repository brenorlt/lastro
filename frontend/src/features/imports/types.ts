export type ImportRowStatus = "NEW" | "DUPLICATE" | "IMPORTED" | "UNSUPPORTED";

export interface ImportPreviewRow {
  /** Impressão digital da linha do extrato; o backend a usa para não importar duas vezes. */
  externalId: string;
  date: string;
  description: string;
  /** Sempre positivo; o sentido vem de `type`. */
  amount: string;
  type: "INCOME" | "EXPENSE";
  status: ImportRowStatus;
  reason: string | null;
  /** Categoria sugerida pelo histórico ou por palavra-chave. */
  categoryId: string | null;
}

export interface ImportPreview {
  format: "OFX" | "CSV";
  statementKind: "BANK" | "CARD" | null;
  target: { kind: "ACCOUNT" | "CARD"; id: string; name: string; currentBalance: string | null };
  statementBalance: { amount: string; date: string } | null;
  signsInverted: boolean;
  rows: ImportPreviewRow[];
}

export interface ImportTarget {
  accountId: string | null;
  creditCardId: string | null;
}

export interface ImportCommitRow {
  externalId: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  description: string;
  date: string;
  categoryId: string | null;
}
