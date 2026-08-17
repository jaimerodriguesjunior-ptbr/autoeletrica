require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const ORG = 'e7bc8193-a8e6-4f91-9e5a-972ec8800f79';
const CSV = 'auditoria_duplicados_kabroski_refinada.csv';
const KEEP_SEPARATE = new Set(['P028', 'P050', 'P052', 'P054']);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ';' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift();
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

function distinct(values) { return [...new Set(values.filter((x) => x !== null && x !== undefined && String(x).trim() !== ''))]; }
function validNcm(value) { return /^\d{8}$/.test(String(value || '')) && value !== '00000000'; }

async function fetchByIds(table, ids) {
  const { data, error } = await supabase.from(table).select('*').eq('organization_id', ORG).in('id', ids);
  if (error) throw error;
  return data;
}

async function main() {
  const csvRows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const groups = new Map();
  for (const row of csvRows) {
    if (KEEP_SEPARATE.has(row.grupo)) continue;
    if (!groups.has(row.grupo)) groups.set(row.grupo, { tipo: row.tipo, ids: [] });
    groups.get(row.grupo).ids.push(row.id);
  }
  const productGroups = [...groups.values()].filter((x) => x.tipo === 'PRODUTO');
  const serviceGroups = [...groups.values()].filter((x) => x.tipo === 'SERVICO');
  const products = await fetchByIds('products', [...new Set(productGroups.flatMap((x) => x.ids))]);
  const services = await fetchByIds('services', [...new Set(serviceGroups.flatMap((x) => x.ids))]);
  const productById = new Map(products.map((x) => [x.id, x]));
  const serviceById = new Map(services.map((x) => [x.id, x]));

  const plan = [];
  const conflicts = [];
  for (const [groupId, group] of groups) {
    const map = group.tipo === 'PRODUTO' ? productById : serviceById;
    const members = group.ids.map((id) => map.get(id)).filter(Boolean);
    if (members.length !== group.ids.length || members.length < 2) throw new Error(`Grupo ${groupId} incompleto`);
    const ncmValues = distinct(members.map((x) => x.ncm).filter(validNcm));
    const priceValues = distinct(members.map((x) => String(group.tipo === 'PRODUTO' ? x.preco_venda ?? '' : x.price ?? '')));
    if (ncmValues.length > 1) conflicts.push(`${groupId}: NCMs ${ncmValues.join(', ')}`);
    if (priceValues.length > 1) conflicts.push(`${groupId}: preços ${priceValues.join(', ')}`);
    // Prefer a record carrying the useful fiscal/commercial values, then oldest.
    members.sort((a, b) => {
      const av = (validNcm(a.ncm) ? 2 : 0) + (Number(group.tipo === 'PRODUTO' ? a.preco_venda : a.price) > 0 ? 1 : 0);
      const bv = (validNcm(b.ncm) ? 2 : 0) + (Number(group.tipo === 'PRODUTO' ? b.preco_venda : b.price) > 0 ? 1 : 0);
      return bv - av || String(a.created_at).localeCompare(String(b.created_at));
    });
    plan.push({ groupId, tipo: group.tipo, master: members[0], duplicates: members.slice(1) });
  }

  if (conflicts.length) throw new Error(`Conflitos encontrados antes da união:\n${conflicts.join('\n')}`);

  const backup = { generated_at: new Date().toISOString(), groups: plan };
  fs.writeFileSync(`backup_merge_kabroski_${Date.now()}.json`, JSON.stringify(backup, null, 2), 'utf8');

  let movedProductItems = 0;
  let movedServiceItems = 0;
  for (const item of plan) {
    const duplicateIds = item.duplicates.map((x) => x.id);
    const masterId = item.master.id;
    const field = item.tipo === 'PRODUTO' ? 'product_id' : 'service_id';
    const { data: refs, error: refError } = await supabase.from('work_order_items').select('id').eq('organization_id', ORG).in(field, duplicateIds);
    if (refError) throw refError;
    if (refs.length) {
      const { error } = await supabase.from('work_order_items').update({ [field]: masterId }).eq('organization_id', ORG).in(field, duplicateIds);
      if (error) throw error;
    }
    if (item.tipo === 'PRODUTO') movedProductItems += refs.length;
    else movedServiceItems += refs.length;
    const { data: leftovers, error: leftError } = await supabase.from('work_order_items').select('id').eq('organization_id', ORG).in(field, duplicateIds);
    if (leftError) throw leftError;
    if (leftovers.length) throw new Error(`Referências restantes no grupo ${item.groupId}`);
    const { error: deleteError } = await supabase.from(item.tipo === 'PRODUTO' ? 'products' : 'services').delete().eq('organization_id', ORG).in('id', duplicateIds);
    if (deleteError) throw deleteError;
  }
  console.log(JSON.stringify({ groups: plan.length, product_groups: productGroups.length, service_groups: serviceGroups.length, moved_product_work_order_items: movedProductItems, moved_service_work_order_items: movedServiceItems }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
