import 'server-only';
import { createAdminClient } from '@/src/utils/supabase/admin';

export async function whatsappEnabled(organizationId: string) {
  const { data, error } = await createAdminClient().from('whatsapp_settings')
    .select('enabled').eq('organization_id', organizationId).maybeSingle();
  if (error) throw new Error('Configuração do WhatsApp indisponível. Solicite a instalação da migração.');
  return data?.enabled === true;
}

export async function whatsappBridge(organizationId: string, action: string, payload = {}) {
  const url = process.env.MB_WHATSAPP_BRIDGE_URL?.trim();
  const token = process.env.MB_WHATSAPP_BRIDGE_TOKEN?.trim();
  if (!url || !token) throw new Error('Integração com a VPS ainda não configurada.');
  const response = await fetch(`${url.replace(/\/$/, '')}/organizations/${encodeURIComponent(organizationId)}/${action}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error('A VPS não concluiu a operação. Confira a conexão do WhatsApp.');
  return response.json();
}
