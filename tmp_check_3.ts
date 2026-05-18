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

  const nums = ['774460346','774460345','774460344'];
  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select('numero,environment,status,payload_json,created_at,destinatario_nome')
    .in('numero', nums)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const out = (data || []).map((r: any) => ({
    numero: r.numero,
    destinatario: r.destinatario_nome,
    created_at: r.created_at,
    natOp: String(r?.payload_json?.infNFe?.ide?.natOp || ''),
    infCpl: String(r?.payload_json?.infNFe?.infAdic?.infCpl || ''),
  }));

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
