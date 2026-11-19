import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import { createAdminClient } from '@/src/utils/supabase/admin';

export async function GET(request: Request, { params }: { params: { ean: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const ean = params.ean;
  if (!/^\d{8,14}$/.test(ean)) return NextResponse.json({ error: 'EAN inválido.' }, { status: 400 });
  const token = process.env.COSMOS_TOKEN;
  if (!token) return NextResponse.json({ error: 'COSMOS_TOKEN não configurado.' }, { status: 500 });

  const { data: profile, error: profileError } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (profileError || !profile?.organization_id) {
    return NextResponse.json({ error: 'Não foi possível identificar a empresa para registrar a consulta.' }, { status: 403 });
  }

  const start = Date.now();
  let status: number | null = null;
  let outcome: 'found' | 'not_found' | 'error' = 'error';
  try {
    const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${ean}.json`, {
      method: 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Cosmos-Token': token, 'User-Agent': 'AutoEletrica-Inventory-Service' }
    });
    status = response.status;
    if (!response.ok) {
      outcome = response.status === 404 ? 'not_found' : 'error';
      return NextResponse.json({ error: `Erro na API Cosmos: ${response.status}` }, { status: response.status });
    }
    const data = await response.json();
    outcome = typeof data?.description === 'string' && data.description.trim() ? 'found' : 'not_found';
    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro no Proxy Cosmos:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar no Cosmos' }, { status: 500 });
  } finally {
    try {
      const { error } = await createAdminClient().from('cosmos_usage').insert({ organization_id: profile.organization_id, user_id: user.id, ean, outcome, http_status: status, duration_ms: Date.now() - start });
      if (error) console.error('Falha ao registrar consulta Cosmos:', error.message);
    } catch (error) {
      console.error('Falha ao registrar consulta Cosmos:', error);
    }
  }
}
