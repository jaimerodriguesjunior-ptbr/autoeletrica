import { NextResponse } from 'next/server';
import { getCurrentProfileAccess } from '@/src/lib/billing-guard';
import { createAdminClient } from '@/src/utils/supabase/admin';
import { whatsappBridge, whatsappEnabled } from '@/src/lib/whatsapp';

export async function GET() {
  try {
    const access = await getCurrentProfileAccess();
    return NextResponse.json({ enabled: await whatsappEnabled(access.organizationId), canManage: access.cargo === 'owner' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Não foi possível consultar o WhatsApp. Verifique o acesso e a instalação da integração.' }, { status: 400 }); }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentProfileAccess();
    if (access.cargo !== 'owner') return NextResponse.json({ error: 'Somente o gerente pode configurar o WhatsApp.' }, { status: 403 });
    const body = await request.json();
    if (body.action === 'toggle' && typeof body.enabled === 'boolean') {
      const { error } = await createAdminClient().from('whatsapp_settings').upsert({ organization_id: access.organizationId, enabled: body.enabled, updated_at: new Date().toISOString() });
      if (error) throw new Error('Não foi possível salvar a configuração.');
      return NextResponse.json({ enabled: body.enabled });
    }
    if (!['status', 'connect', 'disconnect'].includes(body.action)) return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 });
    if (body.action !== 'disconnect' && !await whatsappEnabled(access.organizationId)) throw new Error('Ative o WhatsApp primeiro.');
    return NextResponse.json(await whatsappBridge(access.organizationId, body.action), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao configurar WhatsApp.' }, { status: 400 }); }
}
