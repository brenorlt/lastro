import { parseCsv } from './csv.js';
import { looksLikeOfx, parseOfx } from './ofx.js';
import { type ParsedStatement, StatementParseError } from './statement.types.js';
import { decodeStatement } from './values.js';

/** Detecta o formato pelo conteúdo (a extensão não é confiável) e interpreta o extrato. */
export function parseStatement(buffer: Buffer): ParsedStatement {
  const head = buffer.subarray(0, 8).toString('latin1');
  if (head.startsWith('%PDF')) {
    throw new StatementParseError(
      'Extrato em PDF ainda não é suportado. No app do banco, exporte em OFX ou CSV',
    );
  }
  if (head.startsWith('PK') || buffer.subarray(0, 4096).includes(0)) {
    throw new StatementParseError(
      'Planilhas Excel não são suportadas. Salve como CSV ou exporte o extrato em OFX',
    );
  }
  const text = decodeStatement(buffer);
  return looksLikeOfx(text) ? parseOfx(text) : parseCsv(text);
}
