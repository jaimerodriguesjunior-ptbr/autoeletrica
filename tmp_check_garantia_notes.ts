import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function main() {
  const env = fs.readFileSync('.env.local','utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const k = m[1].trim();
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
    if (!(k in process.env)) process.env[k] = v;
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const nums = ['774460344','774460345'];
  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select('id,numero,tipo_documento,operation_kind,status,created_at,payload_json,valor_total,destinatario_nome')
    .in('numero', nums)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const out = (data || []).map((r: any) => {
    const p = r.payload_json || {};
    const infNFe = p?.infNFe || {};
    const ide = infNFe?.ide || p?.ide || {};
    const infAdic = infNFe?.infAdic || p?.infAdic || {};
    return {
      numero: r.numero,
      tipo_documento: r.tipo_documento,
      operation_kind: r.operation_kind,
      status: r.status,
      destinatario_nome: r.destinatario_nome,
      valor_total: r.valor_total,
      natOp: ide?.natOp || null,
      infCpl: infAdic?.infCpl || null,
      created_at: r.created_at,
    };
  });

  console.log(JSON.stringify(out, null, 2));
}
main().catch((e)=>{console.error(e); process.exit(1);});
