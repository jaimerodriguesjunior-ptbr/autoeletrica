import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileAccess } from '@/src/lib/billing-guard';
import { createAdminClient } from '@/src/utils/supabase/admin';
import { createClient } from '@/src/utils/supabase/server';
import { whatsappBridge, whatsappEnabled } from '@/src/lib/whatsapp';
import { receiptPdf } from '@/src/lib/whatsapp-document';
import { GET as fiscalPdf } from '@/app/api/fiscal/print/[id]/route';

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const access = await getCurrentProfileAccess();
    const body = await request.json();
    if (!['transaction', 'sale', 'invoice'].includes(body.kind) || typeof body.id !== 'string' || !/^[\w-]{1,80}$/.test(body.id) || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new Error('Documento inválido.');
    let phone = String(body.phone || '').replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
    if (!/^55[1-9]\d{9,10}$/.test(phone)) throw new Error('Informe DDD e número de WhatsApp brasileiro válidos.');
    if (!await whatsappEnabled(access.organizationId)) throw new Error('Ative o WhatsApp em Configurações.');
    const state = await whatsappBridge(access.organizationId, 'status');
    if (state.state !== 'open') throw new Error('Conecte o WhatsApp da oficina em Configurações.');
    let pdf;
    if (body.kind === 'invoice') {
      const { data, error } = await createClient().from('fiscal_invoices').select('id, status, direction').eq('id', body.id).eq('organization_id', access.organizationId).single();
      if (error || !data || data.direction === 'entry' || data.status !== 'authorized') throw new Error('Nota autorizada não encontrada para esta oficina.');
      const response = await fiscalPdf(new NextRequest('http://localhost/api/fiscal/print'), { params: { id: body.id } });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('PDF fiscal indisponível na Nuvem Local Fiscal.');
      pdf = { buffer: Buffer.from(await response.arrayBuffer()), filename: `nota-${body.id}.pdf` };
    } else pdf = await receiptPdf(body.kind, body.id, access.organizationId);
    if (pdf.buffer.length > 10 * 1024 * 1024 || pdf.buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('O documento precisa ser um PDF de até 10 MiB.');
    const db = createAdminClient();
    const { error: reserveError } = await db.from('whatsapp_sends').insert({ id: body.requestId, organization_id: access.organizationId, user_id: access.userId, document_type: body.kind, document_id: body.id, status: 'pending' });
    if (reserveError) throw new Error('Solicitação já registrada ou registro indisponível. Confira a conversa antes de reenviar.');
    try {
      // Revalidar após a geração do documento para respeitar o desligamento.
      if (!await whatsappEnabled(access.organizationId)) throw new Error('Envio desativado.');
      const result = await whatsappBridge(access.organizationId, 'send', { phone, filename: pdf.filename, media: pdf.buffer.toString('base64') });
      if (!result.messageId) throw new Error('Resposta sem confirmação.');
      const { error } = await db.from('whatsapp_sends').update({ status: 'accepted', provider_id: result.messageId }).eq('id', body.requestId).eq('organization_id', access.organizationId);
      return NextResponse.json({ message: error ? 'Envio aceito pelo WhatsApp, mas o histórico não foi atualizado. Não reenvie.' : 'Envio aceito pelo WhatsApp. Isso ainda não confirma a entrega ou leitura pelo cliente.' });
    } catch {
      await db.from('whatsapp_sends').update({ status: 'unknown' }).eq('id', body.requestId).eq('organization_id', access.organizationId);
      return NextResponse.json({ error: 'Não foi possível confirmar o envio. Confira a conversa antes de tentar novamente; o PDF pode ter sido enviado.' }, { status: 502 });
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao enviar documento.' }, { status: 400 }); }
}
