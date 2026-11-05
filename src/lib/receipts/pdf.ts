import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { receiptMoney } from '@/src/lib/receiptItems';
import { receiptAddress, receiptDate, receiptItemKind, receiptNote, receiptQuantity, receiptSummary, type ReceiptDocument } from './document';

type Logo = { bytes: Uint8Array; format: 'PNG' | 'JPEG' | 'WEBP' };

// Sem dados de acesso ou identificadores internos no documento do cliente.
export function renderReceiptPdf(receipt: ReceiptDocument, logo?: Logo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 10;
  const width = 190;
  let y = 10;
  doc.setProperties({ title: receipt.title, author: receipt.companyName, subject: receipt.title, creator: receipt.companyName });

  function text(value: string | string[], x: number, top: number, size = 9, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(25, 25, 25);
    doc.text(value, x, top);
  }
  function header() {
    let companyX = margin;
    if (logo) {
      try {
        const props = doc.getImageProperties(logo.bytes);
        const scale = Math.min(19 / props.width, 19 / props.height);
        doc.addImage(logo.bytes, logo.format, margin + (19 - props.width * scale) / 2, 10 + (19 - props.height * scale) / 2, props.width * scale, props.height * scale);
        companyX += 24;
      } catch { /* Logo inválida não impede a impressão do comprovante. */ }
    }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    const companyLines = doc.splitTextToSize(receipt.companyName.toUpperCase(), 130 - companyX);
    text(companyLines, companyX, 14, 11, true);
    let detailsY = 14 + companyLines.length * 4.2;
    const details = [receipt.company.cnpj ? `CNPJ: ${receipt.company.cnpj}` : '', receiptAddress(receipt.company), receipt.company.telefone ? `Tel.: ${receipt.company.telefone}` : ''].filter(Boolean);
    for (const line of details) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      const lines = doc.splitTextToSize(line, 130 - companyX);
      doc.setTextColor(95); doc.text(lines, companyX, detailsY);
      detailsY += lines.length * 3.4;
    }
    // Alinhar a referência à direita, sem cortar UUIDs ou expor a transação.
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.setTextColor(25);
    doc.text(receipt.kind === 'sale' ? 'COMPROVANTE' : 'RECIBO', 200, 14, { align: 'right' });
    doc.setFontSize(9);
    if (receipt.orderNumber) doc.text(`OS #${receipt.orderNumber}`, 200, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(95);
    doc.text(receiptDate(receipt.date), 200, 26, { align: 'right' });
    y = Math.max(34, detailsY + 3);
    doc.setDrawColor(25); doc.setLineWidth(0.6); doc.line(margin, y, 200, y);
    return y + 5;
  }
  y = header();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  const clientLines = doc.splitTextToSize(receipt.clientName, 172);
  const clientHeight = 9 + clientLines.length * 4 + (receipt.clientDocument || receipt.clientPhone ? 5 : 0);
  doc.setDrawColor(30); doc.setLineWidth(0.4); doc.roundedRect(margin, y, width, clientHeight, 1.5, 1.5);
  doc.setTextColor(100); doc.setFontSize(6.5);
  doc.text(receipt.kind === 'sale' ? 'CLIENTE' : receipt.income ? 'RECEBEMOS DE' : 'PAGAMOS A', 13, y + 5);
  text(clientLines, 13, y + 10, 10, true);
  const contact = [receipt.clientDocument ? `CPF/CNPJ: ${receipt.clientDocument}` : '', receipt.clientPhone ? `Tel.: ${receipt.clientPhone}` : ''].filter(Boolean).join('   ');
  if (contact) text(contact, 13, y + 10 + clientLines.length * 4, 7);
  y += clientHeight + 7;
  text(receipt.title, margin, y, 10, true);
  y += 5;
  if (receipt.description) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const lines = doc.splitTextToSize(receipt.description, width);
    doc.text(lines, margin, y); y += lines.length * 3.8 + 3;
  }
  if (receipt.items.length) {
    text('PRODUTOS E SERVIÇOS', margin, y, 7, true); y += 2;
    autoTable(doc, {
      startY: y, theme: 'plain', margin: { left: margin, right: margin, top: 12, bottom: 15 },
      styles: { font: 'helvetica', fontSize: 8, textColor: [35, 35, 35], cellPadding: { top: 2.2, bottom: 2.2, left: 1, right: 1 }, overflow: 'linebreak' },
      headStyles: { fontSize: 6.5, fontStyle: 'bold', fillColor: [247, 247, 247], lineWidth: { top: 0.4, bottom: 0.4 }, lineColor: [25, 25, 25] },
      bodyStyles: { lineWidth: { bottom: 0.15 }, lineColor: [220, 223, 227] },
      columnStyles: { 0: { cellWidth: 12, textColor: [100, 100, 100], fontSize: 7 }, 1: { cellWidth: 98 }, 2: { cellWidth: 16, halign: 'center' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 34, halign: 'right', fontStyle: 'bold' } },
      head: [[{ content: 'TIPO' }, { content: 'DESCRIÇÃO' }, { content: 'QTD.', styles: { halign: 'center' } }, { content: 'UNITÁRIO', styles: { halign: 'right' } }, { content: 'TOTAL', styles: { halign: 'right' } }]],
      body: receipt.items.map(item => [receiptItemKind(item), `${item.name}${item.peca_cliente ? '\nFornecido pelo cliente - sem cobrança' : ''}`, receiptQuantity(item.quantity), item.peca_cliente ? '-' : receiptMoney(item.unit_price), item.peca_cliente ? '-' : receiptMoney(item.total_price)]),
      rowPageBreak: 'avoid',
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }
  if (receipt.payments.length) {
    if (y > 245) { doc.addPage(); y = 15; }
    text('PAGAMENTO', margin, y, 7, true); y += 2;
    autoTable(doc, {
      startY: y, theme: 'plain', margin: { left: margin, right: margin, top: 12, bottom: 15 },
      styles: { fontSize: 8, cellPadding: 1.7, textColor: [70, 70, 70] },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 118 }, 2: { cellWidth: 40, halign: 'right' } },
      body: receipt.payments.map(payment => [receiptDate(payment.date), payment.method, receiptMoney(payment.amount)]),
      rowPageBreak: 'avoid',
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }
  if (y + 42 > 282) { doc.addPage(); y = 15; }
  const { parts, services, amountLabel } = receiptSummary(receipt);
  doc.setDrawColor(25); doc.setLineWidth(0.5); doc.line(margin, y, 200, y); y += 3;
  if (receipt.items.length) {
    text(`Produtos: ${receiptMoney(parts)}`, margin, y + 5, 8);
    text(`Serviços: ${receiptMoney(services)}`, margin, y + 10, 8);
  }
  if (receipt.orderTotal != null) text(`${receipt.kind === 'sale' ? 'Total da venda' : 'Total da OS'}: ${receiptMoney(receipt.orderTotal)}`, margin, y + 15, 8, true);
  doc.setFillColor(248, 248, 248); doc.setLineWidth(0.3); doc.roundedRect(132, y, 68, 20, 1.3, 1.3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(85);
  doc.text(amountLabel.toUpperCase(), 196, y + 6, { align: 'right' });
  doc.setFontSize(16); doc.setTextColor(20); doc.text(receiptMoney(receipt.amount), 196, y + 14, { align: 'right' });
  y += 26;
  const note = receiptNote(receipt);
  if (note) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100);
    const lines = doc.splitTextToSize(note, width); doc.text(lines, margin, y); y += lines.length * 3.5;
  }
  doc.setDrawColor(220); doc.setLineWidth(0.2); doc.line(margin, y + 3, 200, y + 3);
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text('Obrigado pela preferência!', 105, y + 9, { align: 'center' });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(6.5); doc.setTextColor(140);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, 200, 290, { align: 'right' });
  }
  return doc;
}
