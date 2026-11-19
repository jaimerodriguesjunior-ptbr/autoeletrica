import { NextResponse } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('organization_id,cargo').eq('id', user.id).single();
  if (!profile?.organization_id || profile.cargo !== 'owner') return NextResponse.json({ error: 'Acesso restrito ao responsável.' }, { status: 403 });
  const date = new URL(request.url).searchParams.get('data') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  // São Paulo não utiliza horário de verão desde 2019.
  const start = new Date(date + 'T00:00:00-03:00');
  const end = new Date(start.getTime() + 86400000);
  const rows: { ean: string; outcome: string; http_status: number | null; created_at: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('cosmos_usage').select('ean,outcome,http_status,created_at').eq('organization_id', profile.organization_id).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()).order('id', { ascending: true }).range(offset, offset + 999);
    if (error) return NextResponse.json({ error: 'Não foi possível carregar o registro da Cosmos. Verifique se a migração foi aplicada.' }, { status: 500 });
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const byEan = new Map<string, number>();
  for (const row of rows) byEan.set(row.ean, (byEan.get(row.ean) || 0) + 1);
  const repeated = Array.from(byEan, ([ean, count]) => ({ ean, count })).filter(item => item.count > 1).sort ( (a, b) => b.count - a.count);
  return NextResponse.json({ total: rows.length, found: rows.filter(r => r.outcome === 'found').length, notFound: rows.filter(r => r.outcome === 'not_found').length, errors: rows.filter(r => r.outcome === 'error').length, repeats: repeated.reduce((sum, item) => sum + item.count - 1, 0), repeated, rows: rows.reverse() });
}
