import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function main() {
  const envFile = fs.readFileSync('.env.local','utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    if (!(k in process.env)) process.env[k] = v;
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select('id,numero,environment,status,direction,tipo_documento,created_at,destinatario_nome,payload_json')
    .eq('tipo_documento', 'NFe')
    .eq('direction', 'output')
    .eq('status', 'authorized')
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw error;

  const out = (data || []).map((r: any) => {
    const natOp = String(r?.payload_json?.infNFe?.ide?.natOp || '').toUpperCase();
    const infCpl = String(r?.payload_json?.infNFe?.infAdic?.infCpl || '').toUpperCase();
    return {
      numero: r.numero,
      environment: r.environment,
      created_at: r.created_at,
      destinatario_nome: r.destinatario_nome,
      natOp,
      infCpl,
    };
  }).filter((r: any) => r.natOp.includes('REMESSA') || r.infCpl.includes('GARANTIA') || r.natOp.includes('RETORNO'));

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
