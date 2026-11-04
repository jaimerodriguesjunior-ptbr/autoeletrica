import 'server-only';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/src/utils/supabase/server';
import { receiptMoney, type ReceiptItem } from '@/src/lib/receiptItems';

export async function receiptPdf(kind: string, id: string, organizationId: string) {
  const db = createClient();
  const { data: company, error: companyError } = await db.from('company_settings').select('nome_fantasia, razao_social').eq('organization_id', organizationId).limit(1).maybeSingle();
  const name = company?.nome_fantasia?.trim() || company?.razao_social?.trim();
  if (companyError || !name) throw new Error('Cadastre o nome da empresa nas configurações.');
  const table = kind === 'transaction' ? 'transactions' : 'work_orders';
  const selection = kind === 'transaction'
    ? '*, work_orders(id, total, clients(nome), work_order_items(id, name, tipo, quantity, unit_price, total_price, peca_cliente))'
    : '*, clients(nome), work_order_items(id, name, tipo, quantity, unit_price, total_price, peca_cliente), transactions(amount, status, type, payment_method, date)';
  const { data, error } = await db.from(table).select(selection).eq('id', id).eq('organization_id', organizationId).single();
  if (error || !data) throw new Error('Documento não encontrado para esta oficina.');
  // Relações dinâmicas diferem entre transação e venda.
  const record = data as unknown as Record<string, any>;
  if (record.status === 'cancelado' || (kind === 'transaction' && (record.type !== 'income' || record.status !== 'paid'))) throw new Error('Somente recebimentos efetivados e vendas não canceladas podem ser enviados.');
  const order = kind === 'transaction' ? record.work_orders : record;
  const doc = new jsPDF();
  const rows: string[][] = [
    ['Empresa', name], ['Documento', `${kind === 'transaction' ? 'Recibo de recebimento' : 'Extrato da venda'} #${id}`],
    ['Cliente', order?.clients?.nome || 'Não informado'], ['Referência', record.description || ''],
  ];
  if (order) rows.push(['OS', String(order.id)], ['Total da OS', receiptMoney(order.total)]);
  if (kind === 'transaction') rows.push(['Valor deste pagamento', receiptMoney(record.amount)], ['Forma de pagamento', record.payment_method || 'Não informada'], ['Data', record.date || ''], ['Observação', 'Este recibo comprova somente o pagamento acima, não a quitação integral da OS.']);
  else {
    const paid = (record.transactions || []).filter((t: any) => t.status === 'paid' && t.type === 'income');
    rows.push(['Total recebido', receiptMoney(paid.reduce((sum: number, t: any) => sum + Number(t.amount), 0))]);
    for (const t of paid) rows.push(['Pagamento', `${t.date || ''} — ${t.payment_method || ''}: ${receiptMoney(t.amount)}`]);
  }
  autoTable(doc, { head: [['Recibo / extrato', 'Dados']], body: rows, margin: 15, styles: { overflow: 'linebreak' } });
  const items: ReceiptItem[] = order?.work_order_items || [];
  autoTable(doc, { startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    head: [['Produto / serviço', 'Qtd.', 'Unitário', 'Total']],
    body: items.map(i => [`${i.tipo === 'servico' ? 'Serviço' : 'Produto'}: ${i.name}${i.peca_cliente ? ' (fornecido pelo cliente, sem cobrança)' : ''}`, String(i.quantity), i.peca_cliente ? '—' : receiptMoney(i.unit_price), i.peca_cliente ? '—' : receiptMoney(i.total_price)]), margin: 15 });
  return { buffer: Buffer.from(doc.output('arraybuffer')), filename: `recibo-${id}.pdf` };
}
