export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
