require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const ORG = 'e7bc8193-a8e6-4f91-9e5a-972ec8800f79';
const OUT = 'auditoria_duplicados_kabroski_refinada.csv';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(value) {
  return String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/\bD\s+AGUA\b/g, 'DE AGUA')
    .replace(/\bJG\b/g, 'JOGO')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value) {
  return normalize(value).replace(/\s/g, '');
}

function tokens(value) {
  return new Set(normalize(value).split(' ').filter((x) => x.length > 1));
}

function similarity(a, b) {
  const ca = compact(a);
  const cb = compact(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  if (ca.includes(cb) || cb.includes(ca)) return Math.min(ca.length, cb.length) / Math.max(ca.length, cb.length);
  const ta = tokens(a);
  const tb = tokens(b);
  const intersection = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  const tokenScore = union ? intersection / union : 0;
  const bigrams = (s) => new Set([...s].map((_, i) => s.slice(i, i + 2)).filter((x) => x.length === 2));
  const ba = bigrams(ca);
  const bb = bigrams(cb);
  const bi = [...ba].filter((x) => bb.has(x)).length;
  const bu = new Set([...ba, ...bb]).size;
  const charScore = bu ? bi / bu : 0;
  return tokenScore * 0.7 + charScore * 0.3;
}

function confidence(a, b, score) {
  const na = normalize(a.nome);
  const nb = normalize(b.nome);
  if (na === nb) return ['ALTA', 'mesmo nome após normalizar acentos, pontuação e abreviações'];
  if (a.codigo_ref && b.codigo_ref && compact(a.codigo_ref) === compact(b.codigo_ref)) return ['ALTA', 'mesma referência/código'];
  if (score >= 0.92) return ['ALTA', 'nomes praticamente idênticos'];
  if (score >= 0.80) return ['MEDIA', 'nomes muito semelhantes; confirmar aplicação, marca ou referência'];
  return ['BAIXA', 'candidato por semelhança; revisar com atenção'];
}

function comparable(a, b, tipo) {
  const brandA = normalize(a.marca);
  const brandB = normalize(b.marca);
  if (brandA !== brandB) return false;
  const refA = compact(a.codigo_ref);
  const refB = compact(b.codigo_ref);
  if (refA && refB && refA !== refB) return false;
  if (tipo === 'PRODUTO') {
    const ncmA = validFiscalCode(a.ncm);
    const ncmB = validFiscalCode(b.ncm);
    if (ncmA && ncmB && ncmA !== ncmB) return false;
    const priceA = Number(a.preco_venda || 0);
    const priceB = Number(b.preco_venda || 0);
    if (priceA !== priceB) return false;
  } else if (Number(a.price || 0) !== Number(b.price || 0)) {
    return false;
  }
  return true;
}

function validFiscalCode(value) {
  return /^\d{8}$/.test(String(value || '')) && value !== '00000000' ? String(value) : '';
}

function csv(value) {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function fetchAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).eq('organization_id', ORG).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function main() {
  const products = await fetchAll('products', 'id,organization_id,nome,marca,codigo_ref,ean,ncm,estoque_atual,estoque_min,preco_venda,created_at');
  const services = await fetchAll('services', 'id,organization_id,nome,price,codigo_servico,aliquota_iss,created_at');
  const records = [
    ...products.map((x) => ({ ...x, tipo: 'PRODUTO', valor: x.preco_venda, estoque: x.estoque_atual })),
    ...services.map((x) => ({ ...x, tipo: 'SERVICO', valor: x.price, estoque: '' })),
  ];

  const groups = [];
  for (const tipo of ['PRODUTO', 'SERVICO']) {
    const list = records.filter((x) => x.tipo === tipo);
    const parent = new Map(list.map((x) => [x.id, x.id]));
    const find = (x) => parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x));
    const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(rb, ra); };
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!comparable(a, b, tipo)) continue;
        const score = similarity(a.nome, b.nome);
        const sameRef = a.codigo_ref && b.codigo_ref && compact(a.codigo_ref) === compact(b.codigo_ref);
        const exact = normalize(a.nome) === normalize(b.nome);
        const threshold = tipo === 'SERVICO' ? 0.88 : 0.90;
        if (exact || sameRef || score >= threshold) union(a.id, b.id);
      }
    }
    const byRoot = new Map();
    for (const item of list) {
      const root = find(item.id);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(item);
    }
    for (const members of byRoot.values()) {
      if (members.length < 2) continue;
      const groupId = `${tipo === 'PRODUTO' ? 'P' : 'S'}${String(groups.length + 1).padStart(3, '0')}`;
      const anchor = members[0];
      for (const member of members) {
        const score = member.id === anchor.id ? 1 : similarity(anchor.nome, member.nome);
        const [conf, reason] = confidence(anchor, member, score);
        groups.push({ groupId, tipo, member, score, conf, reason });
      }
    }
  }

  groups.sort((a, b) => a.groupId.localeCompare(b.groupId));
  const header = ['grupo', 'tipo', 'confianca', 'motivo', 'similaridade_base', 'id', 'nome', 'marca', 'codigo_ref', 'ean', 'ncm', 'estoque_atual', 'estoque_min', 'preco_ou_valor', 'codigo_servico', 'criado_em', 'MARCAR_DUPLICADO_SIM_NAO'];
  const lines = [header.join(';')];
  for (const row of groups) {
    const p = row.member;
    lines.push([
      row.groupId, p.tipo, row.conf, row.reason, row.score.toFixed(3), p.id, p.nome, p.marca || '', p.codigo_ref || '', p.ean || '', p.ncm || '', p.estoque ?? '', p.estoque_min ?? '', p.valor ?? '', p.codigo_servico || '', p.created_at || '', ''
    ].map(csv).join(';'));
  }
  // BOM makes Excel detect UTF-8 correctly on Windows while preserving the
  // semicolon separator used by Brazilian regional settings.
  fs.writeFileSync(OUT, '\uFEFF' + lines.join('\n'), 'utf8');
  const groupCount = new Set(groups.map((x) => x.groupId)).size;
  console.log(JSON.stringify({ products: products.length, services: services.length, candidate_groups: groupCount, candidate_rows: groups.length, output: OUT }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
