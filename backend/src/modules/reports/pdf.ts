import PDFDocument from 'pdfkit';
import { formatMoney } from '../../common/utils/money.js';
import type { ReportCell, ReportTable } from './report-table.js';

const MARGIN = 48;
const INK = '#111827';
const MUTED = '#6B7280';
const ZEBRA = '#F3F4F6';
const ACCENT = '#3F51D8';
const ROW_HEIGHT = 18;
const FOOTER_TEXT = 'Relatório gerado a partir dos dados registrados por você no Lastro.';

const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatPdfCell(cell: ReportCell, currency: string): string {
  switch (cell.t) {
    case 'money':
      return formatMoney(cell.v, currency);
    case 'date':
      return cell.v ? `${cell.v.slice(8, 10)}/${cell.v.slice(5, 7)}/${cell.v.slice(0, 4)}` : '—';
    case 'percent':
      return cell.v === null ? '—' : `${numberFormatter.format(cell.v)}%`;
    case 'int':
      return String(cell.v);
    case 'text':
      return cell.v ?? '—';
  }
}

/**
 * PDF A4 (pdfkit, Helvetica): cabeçalho com marca, título, período, filtros e data de geração;
 * bloco de resumo; tabela zebrada com cabeçalho repetido a cada página; rodapé com aviso e
 * "Página x de y".
 */
export function renderPdf(
  table: ReportTable,
  options: { generatedAt: string; currency: string },
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: `Lastro — ${table.title}` },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const pageWidth = doc.page.width - MARGIN * 2;
  const bottomLimit = doc.page.height - MARGIN - 40;

  // Cabeçalho
  doc.font('Helvetica-Bold').fontSize(20).fillColor(ACCENT).text('Lastro', MARGIN, MARGIN);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(table.title, { paragraphGap: 2 });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Período: ${table.periodLabel}`);
  if (table.filters.length) doc.text(`Filtros: ${table.filters.join(' · ')}`);
  doc.text(`Gerado em ${options.generatedAt}`);
  doc.moveDown(0.8);

  // Resumo
  if (table.summary.length) {
    const top = doc.y;
    const colWidth = pageWidth / Math.min(table.summary.length, 4);
    table.summary.forEach(([label, value], index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = MARGIN + col * colWidth;
      const y = top + row * 34;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(label.toUpperCase(), x, y, { width: colWidth - 8 });
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(INK)
        .text(value, x, y + 11, { width: colWidth - 8 });
    });
    doc.y = top + Math.ceil(table.summary.length / 4) * 34 + 6;
    doc.x = MARGIN;
  }

  // Tabela
  const weights = table.columns.map((c) => c.width ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / totalWeight) * pageWidth);
  const aligns = table.columns.map(
    (c, i) => c.align ?? (table.rows[0]?.[i]?.t === 'text' ? 'left' : 'right'),
  );

  const drawRow = (cells: string[], y: number, header: boolean, zebra: boolean) => {
    if (zebra) doc.rect(MARGIN, y - 4, pageWidth, ROW_HEIGHT).fill(ZEBRA);
    let x = MARGIN;
    doc
      .font(header ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(header ? 8 : 8.5)
      .fillColor(header ? MUTED : INK);
    cells.forEach((value, i) => {
      doc.text(value, x + 4, y, {
        width: widths[i] - 8,
        align: aligns[i],
        lineBreak: false,
        ellipsis: true,
        height: ROW_HEIGHT,
      });
      x += widths[i];
    });
  };
  const drawHeader = (y: number) => {
    drawRow(
      table.columns.map((c) => c.header.toUpperCase()),
      y,
      true,
      false,
    );
    doc
      .moveTo(MARGIN, y + ROW_HEIGHT - 5)
      .lineTo(MARGIN + pageWidth, y + ROW_HEIGHT - 5)
      .lineWidth(0.5)
      .strokeColor('#D1D5DB')
      .stroke();
    return y + ROW_HEIGHT;
  };

  let y = drawHeader(doc.y + 4);
  if (!table.rows.length) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text('Nenhum dado no período selecionado.', MARGIN + 4, y);
  }
  table.rows.forEach((row, index) => {
    if (y + ROW_HEIGHT > bottomLimit) {
      doc.addPage();
      y = drawHeader(MARGIN);
    }
    drawRow(
      row.map((cell) => formatPdfCell(cell, options.currency)),
      y,
      false,
      index % 2 === 1,
    );
    y += ROW_HEIGHT;
  });

  // Rodapé com numeração (páginas já bufferizadas)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // evita quebra automática de página ao escrever no rodapé
    const footerY = doc.page.height - MARGIN - 18;
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
    const lines = [FOOTER_TEXT, ...(table.disclaimer ? [table.disclaimer] : [])].join(' ');
    doc.text(lines, MARGIN, footerY, { width: pageWidth - 90, lineBreak: true, height: 24 });
    doc.text(`Página ${i + 1} de ${range.count}`, MARGIN + pageWidth - 90, footerY, {
      width: 90,
      align: 'right',
      lineBreak: false,
    });
  }
  doc.end();
  return done;
}
