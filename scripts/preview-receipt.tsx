// Amostras fictícias para conferir o PDF enviado e a folha de impressão.
import React from 'react';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderReceiptPdf } from '../src/lib/receipts/pdf';
import ReceiptPaper, { receiptPrintStyles } from '../src/components/receipts/ReceiptPaper';
import type { ReceiptDocument } from '../src/lib/receipts/document';

const output = 'tmp/pdfs';
mkdirSync(output, { recursive: true });
const logo = readFileSync('public/apple-touch-icon.png');
const sample: ReceiptDocument = {
  kind: 'transaction', title: 'Recibo de recebimento',
  companyName: 'Oficina Teste Auto',
  company: { nome_fantasia: 'Oficina Teste Auto', cnpj: '12.345.678/0001-90', endereco: 'Rua das Oficinas, 123', telefone: '(11) 99999-9999', logo_impressos_url: `data:image/png;base64,${logo.toString('base64')}` },
  orderNumber: '725', date: '2026-11-04', clientName: 'Ana Paula Silva', clientDocument: '123.456.789-00', clientPhone: '(45) 99999-0000',
  description: '', status: 'paid', income: true, amount: 2020, orderTotal: 2020,
  items: [
    { id: 1, name: 'Amortecedor', tipo: 'peca', quantity: 1, unit_price: 0, total_price: 0, peca_cliente: false },
    { id: 2, name: 'Bateria 60Ah', tipo: 'peca', quantity: 1, unit_price: 520, total_price: 520, peca_cliente: false },
    { id: 3, name: 'Central multimídia 7 polegadas Android', tipo: 'peca', quantity: 1, unit_price: 1200, total_price: 1200, peca_cliente: false },
    { id: 4, name: 'Amortecedor dianteiro Gol', tipo: 'peca', quantity: 1, unit_price: 300, total_price: 300, peca_cliente: false },
    { id: 5, name: 'Bateria 20Ah', tipo: 'peca', quantity: 1, unit_price: 0, total_price: 0, peca_cliente: false },
    { id: 6, name: 'Peça fornecida pelo cliente', tipo: 'peca', quantity: 1, unit_price: 200, total_price: 200, peca_cliente: true },
  ], payments: [{ amount: 2020, method: 'Dinheiro', date: '2026-11-04' }],
};
const samples: [string, ReceiptDocument][] = [
  ['recibo-exemplo', sample],
  ['recibo-parcial', { ...sample, amount: 500, payments: [{ amount: 500, method: 'Pix', date: '2026-11-04' }] }],
  ['recibo-muitas-paginas', { ...sample, clientName: 'Cliente com nome muito extenso para conferir a quebra de linha sem corte de informações no cabeçalho', items: Array.from({ length: 65 }, (_, i) => ({ ...sample.items[i % 6], id: i + 1, name: `${i + 1}. ${sample.items[i % 6].name} - descrição completa do produto ou serviço` })) }],
  ['comprovante-venda', { ...sample, kind: 'sale', title: 'Comprovante de venda', payments: [{ amount: 500, method: 'Pix', date: '2026-11-04' }, { amount: 1520, method: 'Cartão de crédito', date: '2026-11-05' }] }],
  ['pagamento-pendente', { ...sample, company: { nome_fantasia: 'Oficina sem logo' }, companyName: 'Oficina sem logo', title: 'Previsão de pagamento', income: false, status: 'pending', orderNumber: null, orderTotal: null, items: [], description: 'Pagamento de manutenção', payments: [{ amount: 2020, method: 'Boleto', date: '2026-11-04' }] }],
];
for (const [name, receipt] of samples) {
  const doc = renderReceiptPdf(receipt, receipt.company.logo_impressos_url ? { bytes: new Uint8Array(logo), format: 'PNG' } : undefined);
  writeFileSync(`${output}/${name}.pdf`, Buffer.from(doc.output('arraybuffer')));
  const markup = renderToStaticMarkup(<ReceiptPaper receipt={receipt} />);
  writeFileSync(`${output}/${name}.html`, `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${receipt.title}</title><style>${receiptPrintStyles}</style></head><body><div style="height:100vh;overflow:auto;transform:translateY(10px)"><aside>MENU DO PAINEL - NAO DEVE SER IMPRESSO</aside></div><div id="receipt-print-root">${markup}</div></body></html>`);
  console.log(`${name}: ${doc.getNumberOfPages()} página(s)`);
}
