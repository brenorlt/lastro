/**
 * Bancos com logo próprio em /public/banks. `institution` é texto livre, então o
 * reconhecimento é por apelidos: cada um casa como palavra (ou sequência de palavras)
 * inteira no nome normalizado — "Banco Inter" casa "inter", "Internacional" não.
 *
 * `bleed`: o SVG já traz o fundo quadrado da marca e ocupa o ladrilho inteiro.
 */
export interface Bank {
  id: string;
  name: string;
  aliases: string[];
  bleed?: boolean;
}

export const BANKS: Bank[] = [
  { id: "nubank", name: "Nubank", aliases: ["nubank", "nu pagamentos", "nu"] },
  { id: "itau", name: "Itaú", aliases: ["itau", "unibanco"], bleed: true },
  { id: "banco-do-brasil", name: "Banco do Brasil", aliases: ["banco do brasil", "bb"] },
  { id: "bradesco", name: "Bradesco", aliases: ["bradesco"], bleed: true },
  { id: "caixa", name: "Caixa", aliases: ["caixa", "cef"] },
  { id: "santander", name: "Santander", aliases: ["santander"] },
  { id: "inter", name: "Inter", aliases: ["inter"] },
  { id: "c6", name: "C6 Bank", aliases: ["c6"] },
  { id: "btg", name: "BTG Pactual", aliases: ["btg"] },
  { id: "xp", name: "XP Investimentos", aliases: ["xp"], bleed: true },
  { id: "picpay", name: "PicPay", aliases: ["picpay"] },
  { id: "mercado-pago", name: "Mercado Pago", aliases: ["mercado pago", "mercadopago"] },
  { id: "pagbank", name: "PagBank", aliases: ["pagbank", "pagseguro"] },
  { id: "neon", name: "Neon", aliases: ["neon"] },
  { id: "original", name: "Banco Original", aliases: ["original"] },
  { id: "pan", name: "Banco Pan", aliases: ["pan"], bleed: true },
  { id: "safra", name: "Safra", aliases: ["safra"] },
  { id: "bv", name: "Banco BV", aliases: ["bv", "votorantim"] },
  { id: "sicoob", name: "Sicoob", aliases: ["sicoob"] },
  { id: "sicredi", name: "Sicredi", aliases: ["sicredi"] },
  { id: "banrisul", name: "Banrisul", aliases: ["banrisul"] },
  { id: "stone", name: "Stone", aliases: ["stone"] },
  { id: "infinitepay", name: "InfinitePay", aliases: ["infinitepay", "infinite pay"] },
  { id: "bmg", name: "Banco BMG", aliases: ["bmg"] },
  { id: "brb", name: "BRB", aliases: ["brb", "banco de brasilia"] },
  { id: "bnb", name: "Banco do Nordeste", aliases: ["bnb", "banco do nordeste"] },
  { id: "banestes", name: "Banestes", aliases: ["banestes"] },
  { id: "cora", name: "Cora", aliases: ["cora"] },
  { id: "unicred", name: "Unicred", aliases: ["unicred"], bleed: true },
  { id: "cresol", name: "Cresol", aliases: ["cresol"] },
];

/** Minúsculas, sem acento, só letras/dígitos separados por um espaço, com bordas. */
function normalize(s: string): string {
  return ` ${s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const INDEX = BANKS.flatMap((bank) => bank.aliases.map((alias) => ({ bank, alias: normalize(alias) })))
  // Apelido mais longo primeiro: "banco do brasil" antes de apelidos curtos que possam aparecer junto.
  .sort((a, b) => b.alias.length - a.alias.length);

export function findBank(institution: string | null | undefined): Bank | null {
  if (!institution?.trim()) return null;
  const text = normalize(institution);
  return INDEX.find((e) => text.includes(e.alias))?.bank ?? null;
}

export function bankLogoSrc(bank: Bank): string {
  return `/banks/${bank.id}.svg`;
}

/** Sugestões para o campo de instituição: bancos cujo nome ou apelido começa por alguma palavra digitada. */
export function searchBanks(query: string): Bank[] {
  const q = normalize(query).trim();
  if (!q) return BANKS;
  const starts = (b: Bank) => (normalize(b.name).startsWith(` ${q}`) ? 0 : 1);
  // Estável: dentro de cada grupo mantém a ordem de BANKS (mais usados primeiro).
  return BANKS.filter((b) => [b.name, ...b.aliases].some((s) => normalize(s).includes(` ${q}`))).sort((x, y) => starts(x) - starts(y));
}
