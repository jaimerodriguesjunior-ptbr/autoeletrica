import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const start = '2026-07-01T00:00:00-03:00';
const end = '2026-08-01T00:00:00-03:00';

function key(row: any) {
  return String(row.numero ?? '').trim();
}

function xmlNumbers(xml: string | null) {
  if (!xml) return [];
  return [...xml.matchAll(/<numero_nfse[^>]*>\s*([0-9]+)\s*<\//g)].map(m => m[1]);
}

function xmlTag(xml: string | null, tag: string) {
  if (!xml) return null;
  return xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]+)\\s*</${tag}>`))?.[1]?.trim() || null;
}

async function main() {
  const { data: orgs, error: orgError } = await supabase.from('organizations').select('*');
  if (orgError) throw orgError;
  console.log('ORGS', JSON.stringify(orgs, null, 2));

  const org = (orgs || []).find((o: any) => /norberto|nht/i.test(JSON.stringify(o)));
  if (!org) throw new Error('Organização Norberto/NHT não encontrada');
  console.log('ORG_SELECTED', org.id, org.nome_fantasia || org.name || org.razao_social || '');

  for (const table of ['nfce_sequences', 'company_settings']) {
    const { data: config, error: configError } = await supabase.from(table).select('*').eq('organization_id', org.id);
    console.log('CONFIG', table, configError ? configError.message : JSON.stringify(config?.map((c: any) => ({ id: c.id, serie: c.serie, last_number: c.last_number, cnpj: c.cnpj, inscricao_municipal: c.inscricao_municipal, nfse_login: c.nfse_login }))));
  }

  const { data: allRows, error: allError } = await supabase.from('fiscal_invoices').select('id,tipo_documento,direction,status,environment,numero,serie,data_emissao,created_at,chave_acesso,error_message').eq('organization_id', org.id).order('created_at', { ascending: true });
  if (allError) throw allError;
  for (const tipo of ['NFCe', 'NFSe']) {
    const items = (allRows || []).filter((r: any) => r.tipo_documento === tipo);
    console.log('ALL_TYPE', tipo, JSON.stringify({ rows: items.length, min: Math.min(...items.map((r: any) => Number(r.numero)).filter(Number.isFinite)), max: Math.max(...items.map((r: any) => Number(r.numero)).filter(Number.isFinite)), status: items.reduce((a: any, r: any) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}) }, null, 2));
  }

  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select('*')
    .eq('organization_id', org.id)
    .gte('data_emissao', start)
    .lt('data_emissao', end)
    .order('data_emissao', { ascending: true });
  if (error) throw error;

  const rows = data || [];
  console.log('TOTAL_ROWS', rows.length);
  const total = (items: any[]) => items.reduce((sum, row) => sum + Number(row.valor_total || 0), 0);
  const julySystemSummary = ['NFCe', 'NFe', 'NFSe'].map(tipo => {
    const items = rows.filter((r: any) => r.tipo_documento === tipo);
    const authorizedProduction = items.filter((r: any) => r.status === 'authorized' && r.environment === 'production');
    const cancelled = items.filter((r: any) => r.status === 'cancelled');
    return { tipo, total_rows: items.length, authorized_production_rows: authorizedProduction.length, authorized_production_value: total(authorizedProduction), cancelled_rows: cancelled.length, cancelled_value: total(cancelled) };
  });
  const systemNfseAuthorized = rows.filter((r: any) => r.tipo_documento === 'NFSe' && r.status === 'authorized' && r.environment === 'production');
  const duplicatedNfseKeys = Object.entries(systemNfseAuthorized.reduce((acc: Record<string, any[]>, row: any) => { const k = String(row.chave_acesso || ''); (acc[k] ||= []).push(row); return acc; }, {})).filter(([key, items]) => key && (items as any[]).length > 1).map(([key, items]) => ({ chave: key, rows: (items as any[]).map(r => ({ numero: r.numero, valor: r.valor_total, data: r.data_emissao })) }));
  console.log('SYSTEM_VALUE_SUMMARY', JSON.stringify(julySystemSummary));
  console.log('NFSE_DUPLICATED_KEYS', JSON.stringify(duplicatedNfseKeys));
  const nfceRows = rows.filter((r: any) => r.tipo_documento === 'NFCe');
  const nfceChecks = nfceRows.map((r: any) => ({ numero: r.numero, status: r.status, environment: r.environment, tpAmb: xmlTag(r.xml_content, 'tpAmb'), chave: r.chave_acesso, xmlChave: xmlTag(r.xml_content, 'chNFe'), data: r.data_emissao }));
  console.log('NFCE_ENV_SUMMARY', JSON.stringify({ by_environment: nfceRows.reduce((a: any, r: any) => { a[r.environment] = (a[r.environment] || 0) + 1; return a; }, {}), by_tpAmb: nfceChecks.reduce((a: any, r: any) => { a[r.tpAmb] = (a[r.tpAmb] || 0) + 1; return a; }, {}), authorized_by_environment: nfceChecks.filter((r: any) => r.status === 'authorized').reduce((a: any, r: any) => { if (!a[r.environment]) a[r.environment] = []; a[r.environment].push(r.numero); return a; }, {}), mismatched_environment_tpAmb: nfceChecks.filter((r: any) => (r.environment === 'production' && r.tpAmb !== '1') || (r.environment !== 'production' && r.tpAmb === '1')).map((r: any) => ({ numero: r.numero, status: r.status, environment: r.environment, tpAmb: r.tpAmb })) }));
  console.log('NFCE_AUTH_HOMOLOGATION_DETAILS', JSON.stringify(nfceChecks.filter((r: any) => r.status === 'authorized' && r.tpAmb === '2')));
  const firstNfse = rows.find((r: any) => r.tipo_documento === 'NFSe' && r.status === 'authorized');
  console.log('NFSE_XML_SAMPLE', String(firstNfse?.xml_content || '').slice(0, 1800));
  const fields = ['tipo_documento', 'direction', 'status', 'environment', 'numero', 'serie', 'data_emissao', 'created_at', 'nuvemfiscal_uuid', 'chave_acesso'];
  console.log('FIELDS_SAMPLE', JSON.stringify(rows.slice(0, 2).map((r: any) => Object.fromEntries(fields.map(f => [f, r[f]]))), null, 2));

  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const k = `${row.tipo_documento || row.type || '(sem tipo)'}|${row.status || '(sem status)'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  for (const [k, items] of groups) {
    const nums = items.map(key).filter(Boolean);
    const unique = new Set(nums);
    console.log('GROUP', k, 'rows=', items.length, 'unique_numero=', unique.size, 'min=', Math.min(...nums.map(Number).filter(Number.isFinite)), 'max=', Math.max(...nums.map(Number).filter(Number.isFinite)));
  }

  for (const tipo of ['NFCe', 'NFSe']) {
    const items = rows.filter((r: any) => String(r.tipo_documento || r.type || '').toLowerCase() === tipo.toLowerCase());
    const authorized = items.filter((r: any) => /authorized|autorizada|autorizado/i.test(String(r.status || '')));
    const cancelled = items.filter((r: any) => /cancel/i.test(String(r.status || '')));
    const rejected = items.filter((r: any) => /reject|denied|error/i.test(String(r.status || '')));
    console.log('DETAIL', tipo, JSON.stringify({ rows: items.length, authorized: authorized.length, cancelled: cancelled.length, rejected: rejected.length, uniqueNumbers: new Set(authorized.map(key).filter(Boolean)).size }, null, 2));
    console.log('DUPLICATE_NUMBERS', tipo, JSON.stringify([...new Set(authorized.map(key).filter(Boolean).filter((n, i, a) => a.indexOf(n) !== i))]));
    if (tipo === 'NFSe') {
      const pairs = authorized.map((r: any) => ({ local: Number(r.numero), official: Number(xmlNumbers(r.xml_content)[0]) })).filter((r: any) => Number.isFinite(r.local) && Number.isFinite(r.official));
      const offsets = pairs.reduce((a: any, r: any) => { const k = String(r.official - r.local); a[k] = (a[k] || 0) + 1; return a; }, {});
      console.log('OFFICIAL_SUMMARY', JSON.stringify({ local_min: Math.min(...pairs.map((p: any) => p.local)), local_max: Math.max(...pairs.map((p: any) => p.local)), official_min: Math.min(...pairs.map((p: any) => p.official)), official_max: Math.max(...pairs.map((p: any) => p.official)), pairs: pairs.length, offset_distribution: offsets }));
    }
    console.log('NON_AUTHORIZED', tipo, JSON.stringify(items.filter((r: any) => !authorized.includes(r)).map((r: any) => ({ numero: r.numero, status: r.status, issue_date: r.issue_date, error_message: r.error_message, uuid: r.nuvemfiscal_uuid })), null, 2));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
