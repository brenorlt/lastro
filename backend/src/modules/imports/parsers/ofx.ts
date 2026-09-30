import {
  type ParsedStatement,
  StatementParseError,
  type StatementLine,
} from './statement.types.js';
import { cleanDescription, parseAmount, parseStatementDate } from './values.js';

export function looksLikeOfx(text: string): boolean {
  return /OFXHEADER|<OFX>/i.test(text.slice(0, 4096));
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function unescape(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|apos|nbsp);/gi,
    (_, name: string) => ENTITIES[name.toLowerCase()],
  );
}

/**
 * Valor de um elemento folha. Serve para OFX 1.x (SGML, sem tag de fechamento) e 2.x (XML):
 * o valor vai até o próximo `<` ou quebra de linha.
 */
function field(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i').exec(block);
  const value = match ? unescape(match[1]).trim() : '';
  return value || null;
}

/**
 * OFX de conta (BANKMSGSRSV1) ou de cartão (CREDITCARDMSGSRSV1). O padrão é o mesmo para
 * os dois: TRNAMT negativo é débito/compra e positivo é crédito/pagamento.
 */
export function parseOfx(text: string): ParsedStatement {
  if (!looksLikeOfx(text)) throw new StatementParseError('O arquivo não é um OFX válido');
  const kind = /<(CREDITCARDMSGSRSV1|CCSTMTRS)>/i.test(text) ? 'CARD' : 'BANK';

  const lines: StatementLine[] = [];
  for (const chunk of text.split(/<STMTTRN>/i).slice(1)) {
    const block = chunk.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0];
    const date = parseStatementDate(field(block, 'DTPOSTED') ?? '');
    const amount = parseAmount(field(block, 'TRNAMT') ?? '');
    if (!date || !amount) continue;
    const name = field(block, 'NAME');
    const memo = field(block, 'MEMO');
    // Cada banco usa um dos dois (ou ambos) para a descrição útil.
    const description =
      name && memo && name.toLowerCase() !== memo.toLowerCase()
        ? `${name} - ${memo}`
        : (memo ?? name ?? field(block, 'TRNTYPE') ?? 'Lançamento importado');
    lines.push({
      date,
      amount,
      description: cleanDescription(description),
      fitId: field(block, 'FITID'),
    });
  }

  // Alguns bancos repetem o mesmo FITID (ex.: "0") em todas as linhas. Se não é único, não serve.
  const fitIds = lines.map((l) => l.fitId).filter(Boolean);
  if (new Set(fitIds).size !== fitIds.length) for (const l of lines) l.fitId = null;

  const ledger = /<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>|<\/CCSTMTRS>|$)/i.exec(
    text,
  );
  const balanceAmount = ledger ? parseAmount(field(ledger[1], 'BALAMT') ?? '') : null;
  const balanceDate = ledger ? parseStatementDate(field(ledger[1], 'DTASOF') ?? '') : null;

  return {
    format: 'OFX',
    kind,
    lines,
    balance: balanceAmount && balanceDate ? { amount: balanceAmount, date: balanceDate } : null,
  };
}
