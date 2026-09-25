/** Normaliza para busca: sem acentos, minúsculas, espaços colapsados. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function transactionSearchText(description: string, notes: string | null | undefined) {
  return normalizeSearch(`${description} ${notes ?? ''}`);
}
