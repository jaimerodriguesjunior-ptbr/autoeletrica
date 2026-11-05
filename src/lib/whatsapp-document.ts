import 'server-only';
import { createClient } from '@/src/utils/supabase/server';
import { loadReceiptDocument } from '@/src/lib/receipts/load';
import { renderReceiptPdf } from '@/src/lib/receipts/pdf';
import { receiptLogo } from '@/src/lib/receipts/logo';

export async function workshopName(organizationId: string) {
  const db = createClient();
  const { data: company, error: companyError } = await db.from('company_settings').select('nome_fantasia, razao_social').eq('organization_id', organizationId).limit(1).maybeSingle();
  const name = company?.nome_fantasia?.trim() || company?.razao_social?.trim();
  if (companyError || !name) throw new Error('Cadastre o nome da empresa nas configurações.');
  return name;
}

export function documentFilename(kind: string, name: string, reference?: string | number | null) {
  const company = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'oficina';
  const type = kind === 'invoice' ? 'nota-fiscal' : kind === 'sale' ? 'comprovante-de-venda' : 'recibo';
  const suffix = reference == null ? '' : `-${String(reference).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20)}`;
  return `${type}-${company}${suffix}.pdf`;
}

export async function receiptPdf(kind: string, id: string, organizationId: string, _name: string) {
  if (kind !== 'transaction' && kind !== 'sale') throw new Error('Tipo de recibo inválido.');
  const receipt = await loadReceiptDocument(kind, id, organizationId);
  if (kind === 'transaction' && (!receipt.income || receipt.status !== 'paid')) {
    throw new Error('Somente recebimentos efetivados podem ser enviados.');
  }
  const logo = await receiptLogo(receipt.company);
  const doc = renderReceiptPdf(receipt, logo);
  return { buffer: Buffer.from(doc.output('arraybuffer')), filename: documentFilename(kind, receipt.companyName, receipt.orderNumber) };
}
