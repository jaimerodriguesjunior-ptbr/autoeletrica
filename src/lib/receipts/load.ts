import 'server-only';
import { createClient } from '@/src/utils/supabase/server';
import { receiptPaymentLabel, type ReceiptCompany, type ReceiptDocument } from './document';
import type { ReceiptItem } from '@/src/lib/receiptItems';

type Client = { nome?: string; cpf_cnpj?: string; whatsapp?: string };
type Order = {
  id: string | number; total: number; description?: string; created_at: string; status: string;
  clients?: Client | null; work_order_items?: ReceiptItem[];
  transactions?: { amount: number; status: string; type: string; payment_method: string; date: string }[];
};
type Transaction = {
  amount: number; status: string; type: string; date: string; description: string;
  payment_method: string; work_orders?: Order | null;
};

export async function loadReceiptDocument(kind: 'transaction' | 'sale', id: string, organizationId: string): Promise<ReceiptDocument> {
  const db = createClient();
  const companyResult = await db.from('company_settings')
    .select('nome_fantasia, razao_social, cnpj, endereco, logradouro, numero, bairro, cidade, uf, telefone, logo_impressos_url, logo_url')
    .eq('organization_id', organizationId).limit(1).maybeSingle();
  const company = companyResult.data as ReceiptCompany | null;
  const companyName = company?.nome_fantasia?.trim() || company?.razao_social?.trim();
  if (companyResult.error || !company || !companyName) throw new Error('Cadastre o nome da empresa nas configurações.');
  const selection = kind === 'transaction'
    ? 'amount, status, type, date, description, payment_method, work_orders(id, total, created_at, status, clients(nome, cpf_cnpj, whatsapp), work_order_items(id, name, tipo, quantity, unit_price, total_price, peca_cliente))'
    : 'id, total, created_at, status, description, clients(nome, cpf_cnpj, whatsapp), work_order_items(id, name, tipo, quantity, unit_price, total_price, peca_cliente), transactions(amount, status, type, payment_method, date)';
  const { data, error } = await db.from(kind === 'transaction' ? 'transactions' : 'work_orders')
    .select(selection).eq('id', id).eq('organization_id', organizationId).single();
  if (error || !data) throw new Error('Recibo não encontrado para esta oficina.');
  const tx = kind === 'transaction' ? data as unknown as Transaction : null;
  const order = tx ? tx.work_orders : data as unknown as Order;
  if (kind === 'sale' && order?.status === 'cancelado') throw new Error('Esta venda foi cancelada.');
  const paid = order?.transactions?.filter(t => t.status === 'paid' && t.type === 'income') || [];
  const payments = tx ? [{ amount: Number(tx.amount), method: receiptPaymentLabel(tx.payment_method), date: tx.date }]
    : paid.map(t => ({ amount: Number(t.amount), method: receiptPaymentLabel(t.payment_method), date: t.date }));
  const amount = tx ? Number(tx.amount) : paid.reduce((sum, t) => sum + Number(t.amount), 0);
  return {
    kind, title: kind === 'sale' ? 'Comprovante de venda' : tx?.status !== 'paid' ? 'Previsão de pagamento' : tx.type === 'income' ? 'Recibo de recebimento' : 'Recibo de pagamento',
    company, companyName, orderNumber: order ? String(order.id) : null,
    date: tx?.date || order?.created_at || '', clientName: order?.clients?.nome?.trim() || 'Não informado',
    clientDocument: order?.clients?.cpf_cnpj || null, clientPhone: order?.clients?.whatsapp || null,
    // A descrição livre só é necessária quando não há OS identificando a operação.
    description: order ? '' : tx?.description || '', status: tx ? tx.status === 'paid' ? 'paid' : 'pending' : paid.length ? 'paid' : 'pending',
    income: tx ? tx.type === 'income' : true, amount,
    orderTotal: order ? Number(order.total) : null, items: order?.work_order_items || [], payments,
  };
}
