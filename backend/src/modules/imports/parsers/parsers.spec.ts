import { describe, expect, it } from '@jest/globals';
import { parseCsv } from './csv.js';
import { parseOfx } from './ofx.js';
import { parseStatement } from './parse-statement.js';
import { StatementParseError } from './statement.types.js';
import { decodeStatement, parseAmount, parseStatementDate } from './values.js';

const amount = (raw: string) => parseAmount(raw)?.toFixed(2) ?? null;

describe('parseAmount', () => {
  it.each([
    ['1.234,56', '1234.56'],
    ['-1.234,56', '-1234.56'],
    ['1,234.56', '1234.56'],
    ['-1234.5', '-1234.50'],
    ['R$ 12,50', '12.50'],
    ['R$ -12,50', '-12.50'],
    ['(12,50)', '-12.50'],
    ['12,50 D', '-12.50'],
    ['12,50 C', '12.50'],
    ['12,50-', '-12.50'],
    ['1.234.567', '1234567.00'],
    ['+3', '3.00'],
  ])('%s → %s', (raw, expected) => expect(amount(raw)).toBe(expected));

  it.each(['', 'abc', '1,2,3', '--', 'R$'])('rejeita %p', (raw) => expect(amount(raw)).toBeNull());
});

describe('parseStatementDate', () => {
  it.each([
    ['15/09/2026', '2026-09-15'],
    ['5/9/26', '2026-09-05'],
    ['2026-09-15', '2026-09-15'],
    ['20260915120000[-3:BRT]', '2026-09-15'],
    ['15-09-2026', '2026-09-15'],
    ['15/09/2026 10:32', '2026-09-15'],
  ])('%s → %s', (raw, expected) => expect(parseStatementDate(raw)).toBe(expected));

  it.each(['31/02/2026', 'ontem', '2026/13/01'])('rejeita %p', (raw) =>
    expect(parseStatementDate(raw)).toBeNull(),
  );
});

describe('decodeStatement', () => {
  it('lê Windows-1252 quando o UTF-8 é inválido', () => {
    const latin1 = Buffer.from([0x50, 0x41, 0x44, 0x41, 0x52, 0x49, 0x41, 0x20, 0x53, 0xc3, 0x4f]);
    expect(decodeStatement(Buffer.from('Padaria São', 'utf8'))).toBe('Padaria São');
    expect(decodeStatement(latin1)).toBe('PADARIA SÃO');
  });
});

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKTRANLIST>
<DTSTART>20260901
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260902120000[-3:BRT]
<TRNAMT>-45.90
<FITID>A1
<MEMO>COMPRA CARTAO - PADARIA &amp; CAFE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260905
<TRNAMT>5000,00
<FITID>A2
<NAME>SALARIO
<MEMO>EMPRESA LTDA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>4954.10<DTASOF>20260930</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

describe('parseOfx', () => {
  it('lê OFX 1.x (SGML) de conta, com vírgula decimal e saldo', () => {
    const parsed = parseOfx(OFX_SGML);
    expect(parsed.kind).toBe('BANK');
    expect(parsed.lines.map((l) => [l.date, l.amount.toFixed(2), l.description, l.fitId])).toEqual([
      ['2026-09-02', '-45.90', 'COMPRA CARTAO - PADARIA & CAFE', 'A1'],
      ['2026-09-05', '5000.00', 'SALARIO - EMPRESA LTDA', 'A2'],
    ]);
    expect(parsed.balance).toEqual({ amount: expect.anything(), date: '2026-09-30' });
    expect(parsed.balance?.amount.toFixed(2)).toBe('4954.10');
  });

  it('lê OFX 2.x (XML) de cartão', () => {
    const xml = `<?xml version="1.0"?><?OFX OFXHEADER="200"?><OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
      <BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260910</DTPOSTED><TRNAMT>-89.90</TRNAMT>
      <FITID>X</FITID><MEMO>NETFLIX.COM</MEMO></STMTTRN></BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;
    const parsed = parseOfx(xml);
    expect(parsed.kind).toBe('CARD');
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0]).toMatchObject({
      date: '2026-09-10',
      description: 'NETFLIX.COM',
      fitId: 'X',
    });
  });

  it('descarta FITID repetido (bancos que mandam "0" em todas as linhas)', () => {
    const repeated = OFX_SGML.replace('<FITID>A2', '<FITID>A1');
    expect(parseOfx(repeated).lines.map((l) => l.fitId)).toEqual([null, null]);
  });
});

describe('parseCsv', () => {
  it('Nubank conta: vírgula, data BR, identificador', () => {
    const csv = `Data,Valor,Identificador,Descrição
02/09/2026,-45.90,5f1c,"Compra no débito - Padaria, Café"
05/09/2026,5000.00,6a2d,Transferência recebida`;
    const parsed = parseCsv(csv);
    expect(parsed.lines.map((l) => [l.date, l.amount.toFixed(2), l.description, l.fitId])).toEqual([
      ['2026-09-02', '-45.90', 'Compra no débito - Padaria, Café', '5f1c'],
      ['2026-09-05', '5000.00', 'Transferência recebida', '6a2d'],
    ]);
  });

  it('Nubank cartão: cabeçalho em inglês e data ISO', () => {
    const parsed = parseCsv(
      'date,title,amount\n2026-09-10,Uber *Trip,23.40\n2026-09-12,Pagamento recebido,-500',
    );
    expect(parsed.lines.map((l) => l.amount.toFixed(2))).toEqual(['23.40', '-500.00']);
    expect(parsed.lines[0].description).toBe('Uber *Trip');
  });

  it('ponto e vírgula, preâmbulo, linhas de saldo e valor em formato BR', () => {
    const csv = `Extrato Conta Corrente
Período: 01/09/2026 a 30/09/2026

Data Lançamento;Descrição;Valor;Saldo
01/09/2026;Saldo Anterior;;1.000,00
02/09/2026;Pix enviado João;-1.234,56;-234,56
03/09/2026;Rendimento;0,12;-234,44`;
    const parsed = parseCsv(csv);
    expect(parsed.lines.map((l) => [l.description, l.amount.toFixed(2)])).toEqual([
      ['Pix enviado João', '-1234.56'],
      ['Rendimento', '0.12'],
    ]);
  });

  it('colunas separadas de crédito e débito', () => {
    const csv =
      'Data;Histórico;Crédito;Débito\n02/09/2026;Tarifa;;15,00\n03/09/2026;Depósito;200,00;';
    expect(parseCsv(csv).lines.map((l) => l.amount.toFixed(2))).toEqual(['-15.00', '200.00']);
  });

  it('sem colunas reconhecíveis → erro explicativo', () => {
    expect(() => parseCsv('nome,idade\nana,30')).toThrow(StatementParseError);
  });
});

describe('parseStatement', () => {
  it('detecta OFX pelo conteúdo, qualquer que seja a extensão', () => {
    expect(parseStatement(Buffer.from(OFX_SGML)).format).toBe('OFX');
    expect(parseStatement(Buffer.from('Data;Descrição;Valor\n01/09/2026;X;-1,00')).format).toBe(
      'CSV',
    );
  });

  it('recusa PDF e Excel com mensagem orientando a exportação', () => {
    expect(() => parseStatement(Buffer.from('%PDF-1.7 ...'))).toThrow(/PDF/);
    expect(() => parseStatement(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toThrow(/Excel/);
  });
});
