/**
 * Conversão entre o que a pessoa digita (pt-BR: "1.234,56") e o decimal em
 * string que a API espera ("1234.56"). Nunca passa por float.
 */

const MONEY_RE = /^-?\d{1,15}(\.\d{1,2})?$/;

export function parseMoneyInput(raw: string): string | null {
  let s = raw.trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  const negative = s.startsWith("-") || s.startsWith("−");
  s = s.replace(/^[-−]/, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [int = "0", frac = ""] = s.split(".");
  const normalized = `${negative ? "-" : ""}${String(BigInt(int))}${frac ? `.${frac.padEnd(2, "0")}` : ""}`;
  return MONEY_RE.test(normalized) ? normalized : null;
}

/** "1234.5" → "1.234,50" para preencher inputs em edição. */
export function formatMoneyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const [intPart, frac = ""] = String(value).replace("-", "").split(".");
  const negative = String(value).startsWith("-");
  const grouped = (intPart ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped},${frac.padEnd(2, "0").slice(0, 2)}`;
}
