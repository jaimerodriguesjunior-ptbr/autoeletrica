import { receiptMoney, type ReceiptItem } from '@/src/lib/receiptItems';

export type ReceiptCompany = {
  nome_fantasia?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  logo_impressos_url?: string | null;
  logo_url?: string | null;
};

export type ReceiptDocument = {
  kind: 'transaction' | 'sale';
  title: string;
  company: ReceiptCompany;
  companyName: string;
  orderNumber: string | null;
  date: string;
  clientName: string;
  clientDocument: string | null;
  clientPhone: string | null;
  description: string;
  status: 'paid' | 'pending';
  income: boolean;
  amount: number;
  orderTotal: number | null;
  items: ReceiptItem[];
  payments: { amount: number; method: string; date: string }[];
};

const paymentLabels: Record<string, string> = {
  pix: 'Pix', pix_maquininha: 'Pix na maquininha', dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito',
  boleto: 'Boleto', cheque_pre: 'Cheque', outros: 'Outros',
};

export function receiptPaymentLabel(method: string | null | undefined) {
  return method ? paymentLabels[method] || method.replace(/_/g, ' ') : 'Não informada';
}

export function receiptDate(value: string) {
  // Datas financeiras são dias civis; não deslocar o dia pelo fuso do navegador.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export function receiptAddress(company: ReceiptCompany) {
  return company.endereco?.trim() || [
    [company.logradouro, company.numero].filter(Boolean).join(', '), company.bairro,
    [company.cidade, company.uf].filter(Boolean).join(' - '),
  ].filter(Boolean).join(' · ');
}

export function receiptItemKind(item: ReceiptItem) {
  return item.tipo === 'servico' ? 'SV' : item.tipo === 'peca' ? 'PÇ' : 'Item';
}

export function receiptQuantity(value: number) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function receiptSummary(document: ReceiptDocument) {
  const parts = document.items.filter(i => !i.peca_cliente && i.tipo === 'peca').reduce((sum, i) => sum + Number(i.total_price), 0);
  const services = document.items.filter(i => !i.peca_cliente && i.tipo === 'servico').reduce((sum, i) => sum + Number(i.total_price), 0);
  const amountLabel = document.kind === 'sale' ? 'Total recebido' : document.status !== 'paid'
    ? 'Valor previsto' : document.income ? 'Valor recebido' : 'Valor pago';
  return { parts, services, amountLabel };
}

export function receiptNote(document: ReceiptDocument) {
  if (document.status !== 'paid') return 'Pagamento pendente de confirmação.';
  if (document.kind === 'transaction' && document.orderNumber) {
    return `Este recibo corresponde ao pagamento de ${receiptMoney(document.amount)} referente à OS #${document.orderNumber}.`;
  }
  return '';
}
