import { NextResponse } from 'next/server';
import { getCurrentProfileAccess } from '@/src/lib/billing-guard';
import { loadReceiptDocument } from '@/src/lib/receipts/load';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { kind: string; id: string } }) {
  try {
    const access = await getCurrentProfileAccess();
    if (!['transaction', 'sale'].includes(params.kind) || !/^[\w-]{1,80}$/.test(params.id)) {
      return NextResponse.json({ error: 'Recibo inválido.' }, { status: 400 });
    }
    const receipt = await loadReceiptDocument(params.kind as 'transaction' | 'sale', params.id, access.organizationId);
    return NextResponse.json(receipt, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Não foi possível preparar o recibo. Verifique o acesso e o cadastro da oficina.' }, { status: 400 });
  }
}
