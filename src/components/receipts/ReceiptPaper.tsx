import React from 'react';
import { receiptMoney } from '@/src/lib/receiptItems';
import { receiptAddress, receiptDate, receiptItemKind, receiptNote, receiptQuantity, receiptSummary, type ReceiptDocument } from '@/src/lib/receipts/document';

export const receiptPrintStyles = `
  @media screen { #receipt-print-root { display: none !important; } }
  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    html, body { width: auto !important; height: auto !important; overflow: visible !important; background: white !important; margin: 0 !important; padding: 0 !important; }
    body > *:not(#receipt-print-root) { display: none !important; }
    #receipt-print-root { display: block !important; position: static !important; width: 100% !important; }
    #receipt-print-root, #receipt-print-root * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

// Folha independente do painel. Os dados e rótulos também são usados no PDF.
export default function ReceiptPaper({ receipt }: { receipt: ReceiptDocument }) {
  const logo = receipt.company.logo_impressos_url || receipt.company.logo_url;
  const summary = receiptSummary(receipt);
  return <article className="receipt-paper">
    <header className="receipt-paper-header">
      <div className="receipt-paper-company">
        {logo && <img src={logo} alt="" className="receipt-paper-logo" />}
        <div>
          <h1>{receipt.companyName}</h1>
          {receipt.company.cnpj && <p>CNPJ: {receipt.company.cnpj}</p>}
          {receiptAddress(receipt.company) && <p>{receiptAddress(receipt.company)}</p>}
          {receipt.company.telefone && <p>Tel.: {receipt.company.telefone}</p>}
        </div>
      </div>
      <div className="receipt-paper-reference">
        <h2>{receipt.kind === 'sale' ? 'COMPROVANTE' : 'RECIBO'}</h2>
        {receipt.orderNumber && <strong>OS #{receipt.orderNumber}</strong>}
        <p>{receiptDate(receipt.date)}</p>
      </div>
    </header>
    <section className="receipt-paper-client">
      <span className="receipt-paper-label">{receipt.kind === 'sale' ? 'Cliente' : receipt.income ? 'Recebemos de' : 'Pagamos a'}</span>
      <strong>{receipt.clientName}</strong>
      <p>{[receipt.clientDocument && `CPF/CNPJ: ${receipt.clientDocument}`, receipt.clientPhone && `Tel.: ${receipt.clientPhone}`].filter(Boolean).join('   ')}</p>
    </section>
    <h3>{receipt.title}</h3>
    {receipt.description && <p className="receipt-paper-description">{receipt.description}</p>}
    {!!receipt.items.length && <section>
      <h4>Produtos e serviços</h4>
      <table className="receipt-paper-items">
        <colgroup><col style={{ width: '6%' }} /><col style={{ width: '52%' }} /><col style={{ width: '8%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} /></colgroup>
        <thead><tr><th>Tipo</th><th>Descrição</th><th className="receipt-paper-center">Qtd.</th><th className="receipt-paper-right">Unitário</th><th className="receipt-paper-right">Total</th></tr></thead>
        <tbody>{receipt.items.map((item, index) => <tr key={item.id || index}>
          <td className="receipt-paper-muted">{receiptItemKind(item)}</td>
          <td>{item.name}{item.peca_cliente && <small>Fornecido pelo cliente - sem cobrança</small>}</td>
          <td className="receipt-paper-center">{receiptQuantity(item.quantity)}</td>
          <td className="receipt-paper-right">{item.peca_cliente ? '-' : receiptMoney(item.unit_price)}</td>
          <td className="receipt-paper-right"><strong>{item.peca_cliente ? '-' : receiptMoney(item.total_price)}</strong></td>
        </tr>)}</tbody>
      </table>
    </section>}
    {!!receipt.payments.length && <section className="receipt-paper-payments">
      <h4>Pagamento</h4>
      <table><tbody>{receipt.payments.map((payment, i) => <tr key={i}>
        <td>{receiptDate(payment.date)}</td><td>{payment.method}</td><td className="receipt-paper-right">{receiptMoney(payment.amount)}</td>
      </tr>)}</tbody></table>
    </section>}
    <div className="receipt-paper-ending">
      <section className="receipt-paper-summary">
        <div className="receipt-paper-subtotals">
          {!!receipt.items.length && <><p>Produtos: {receiptMoney(summary.parts)}</p><p>Serviços: {receiptMoney(summary.services)}</p></>}
          {receipt.orderTotal != null && <p><strong>{receipt.kind === 'sale' ? 'Total da venda' : 'Total da OS'}: {receiptMoney(receipt.orderTotal)}</strong></p>}
        </div>
        <div className="receipt-paper-total"><span className="receipt-paper-label">{summary.amountLabel}</span><strong>{receiptMoney(receipt.amount)}</strong></div>
      </section>
      {receiptNote(receipt) && <p className="receipt-paper-note">{receiptNote(receipt)}</p>}
      <footer>Obrigado pela preferência!</footer>
    </div>
    <style>{`
      .receipt-paper { color: #191919; background: white; font: 9pt Arial, sans-serif; width: 100%; }
      .receipt-paper * { box-sizing: border-box; }
      .receipt-paper p, .receipt-paper h1, .receipt-paper h2, .receipt-paper h3, .receipt-paper h4 { margin: 0; }
      .receipt-paper-header { display: flex; justify-content: space-between; gap: 8mm; border-bottom: .6mm solid #191919; padding-bottom: 4mm; margin-bottom: 5mm; break-inside: avoid; }
      .receipt-paper-company { display: flex; align-items: flex-start; gap: 5mm; flex: 1; min-width: 0; }
      .receipt-paper-logo { width: 19mm; height: 19mm; object-fit: contain; flex-shrink: 0; }
      .receipt-paper-company h1 { font-size: 11pt; text-transform: uppercase; font-weight: bold; margin-bottom: 2mm; overflow-wrap: anywhere; }
      .receipt-paper-company p { font-size: 7pt; color: #5f5f5f; line-height: 1.6; }
      .receipt-paper-reference { flex-shrink: 0; max-width: 60mm; text-align: right; line-height: 1.6; }
      .receipt-paper-reference h2 { font-size: 12pt; font-weight: bold; }
      .receipt-paper-reference p { font-size: 8pt; color: #5f5f5f; }
      .receipt-paper-client { border: .4mm solid #222; border-radius: 1.5mm; padding: 3mm; margin-bottom: 5mm; break-inside: avoid; }
      .receipt-paper-label { display: block; font-size: 6.5pt; color: #646464; font-weight: bold; text-transform: uppercase; margin-bottom: 1.5mm; }
      .receipt-paper-client strong { display: block; font-size: 10pt; }
      .receipt-paper-client p { font-size: 7pt; margin-top: 1.5mm; color: #5f5f5f; white-space: pre-wrap; }
      .receipt-paper h3 { font-size: 10pt; font-weight: bold; margin-bottom: 5mm; }
      .receipt-paper h4 { font-size: 7pt; font-weight: bold; text-transform: uppercase; margin-bottom: 2mm; break-after: avoid; }
      .receipt-paper-description { font-size: 8pt; margin-bottom: 4mm !important; overflow-wrap: anywhere; }
      .receipt-paper table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .receipt-paper th { background: #f7f7f7; font-size: 6.5pt; font-weight: bold; text-transform: uppercase; text-align: left; border-top: .4mm solid #191919; border-bottom: .4mm solid #191919; padding: 2mm 1mm; }
      .receipt-paper td { font-size: 8pt; padding: 2.2mm 1mm; vertical-align: top; overflow-wrap: anywhere; }
      .receipt-paper-items td { border-bottom: .15mm solid #dcdfe3; }
      .receipt-paper th.receipt-paper-right, .receipt-paper td.receipt-paper-right { text-align: right; }
      .receipt-paper th.receipt-paper-center, .receipt-paper td.receipt-paper-center { text-align: center; }
      .receipt-paper td small { display: block; color: #646464; font-size: 7pt; margin-top: 1mm; }
      .receipt-paper-muted { color: #646464; }
      .receipt-paper-payments { margin-top: 5mm; margin-bottom: 4mm; }
      .receipt-paper-payments td { color: #464646; padding: 1.7mm; }
      .receipt-paper-payments td:first-child { width: 32mm; }
      .receipt-paper-payments td:last-child { width: 40mm; }
      .receipt-paper-ending { break-inside: avoid; }
      .receipt-paper-summary { border-top: .5mm solid #191919; margin-top: 5mm; padding-top: 3mm; display: flex; justify-content: space-between; gap: 5mm; align-items: center; }
      .receipt-paper-subtotals { font-size: 8pt; line-height: 1.8; }
      .receipt-paper-total { width: 68mm; flex-shrink: 0; text-align: right; background: #f8f8f8; border: .3mm solid #191919; border-radius: 1.3mm; padding: 3mm 4mm; }
      .receipt-paper-total strong { font-size: 16pt; }
      .receipt-paper-note { margin-top: 5mm !important; font-size: 7pt; color: #646464; }
      .receipt-paper footer { font-size: 8pt; color: #646464; text-align: center; margin-top: 4mm; padding-top: 4mm; border-top: .2mm solid #ddd; }
      .receipt-paper thead { display: table-header-group; }
      .receipt-paper tr { break-inside: avoid; }
    `}</style>
  </article>;
}
