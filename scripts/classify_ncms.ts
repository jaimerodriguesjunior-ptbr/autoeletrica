import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error('Supabase URL/service role não configurados.');

const supabase = createClient(url, serviceRole);

type CatalogRow = { codigo: string; descricao: string };
type Classification = {
    segmento: string;
    relevancia_oficina: number;
    termos_busca: string;
};

const rules: Array<{ segmento: string; score: number; terms: string[] }> = [
    { segmento: 'autoeletrica', score: 100, terms: ['autoeletrico', 'automotivo', 'automoveis', 'veicular', 'ignicao', 'alternador', 'bateria', 'motor de partida', 'chicote', 'cabo', 'fio eletrico', 'conector', 'terminal eletrico', 'fusivel', 'rele', 'farol', 'lanterna', 'vela de ignicao', 'bobina'] },
    { segmento: 'som_automotivo', score: 75, terms: ['alto falante', 'altifalante', 'amplificador de som', 'amplificacao de som'] },
    { segmento: 'mecanica', score: 90, terms: ['motor', 'freio', 'embreagem', 'suspensao', 'direcao', 'transmissao', 'amortecedor', 'rolamento', 'junta', 'radiador', 'bomba', 'pistao', 'valvula', 'filtro de oleo', 'filtro de ar'] },
    { segmento: 'ferramentas', score: 85, terms: ['ferramenta', 'alicate', 'chave de', 'soquete', 'torquimetro', 'macaco', 'prensa', 'bancada', 'extrator', 'multimetro', 'testador'] },
    { segmento: 'epi_oficina', score: 80, terms: ['luva', 'oculos de protecao', 'protetor auricular', 'mascara de protecao', 'capacete', 'seguranca', 'vestuario de protecao', 'equipamento de protecao'] },
    { segmento: 'lubrificantes', score: 80, terms: ['lubrificante', 'oleo lubrificante', 'graxa', 'aditivo', 'fluido de freio', 'fluido hidraulico', 'anticongelante'] },
    { segmento: 'pneus_rodas', score: 80, terms: ['pneu', 'pneumatico', 'camara de ar', 'roda', 'aro', 'valvula de pneu'] },
    { segmento: 'consumiveis_oficina', score: 70, terms: ['abrasivo', 'lixa', 'solda', 'eletrodo', 'desengraxante', 'solvente', 'fita isolante', 'adesivo', 'selante', 'junta'] },
    { segmento: 'funilaria_pintura', score: 65, terms: ['tinta', 'verniz', 'massa para', 'pintura', 'carroceria', 'lataria', 'parachoque', 'para-choque'] },
];

// Subitens que descrevem efetivamente alto-falantes ou suas partes, e não apenas
// itens que compartilham o mesmo título hierárquico da NCM.
const automotiveAudioCodes = new Set(['85182100', '85182200', '85182910', '85182990', '85189010']);

function normalize(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsTerm(text: string, term: string): boolean {
    if (term === 'cabo' && !/eletric|isolad|tensao|bateria|ignicao|automot|veicular|conector|chicote|condutor|cobre/.test(text)) {
        return false;
    }
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Evita que "rele" classifique, por exemplo, "relevo". Aceita plural simples.
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:s|es)?(?=$|[^a-z0-9])`).test(text);
}

function classify(row: CatalogRow): Classification {
    const text = normalize(row.descricao);
    const leafText = normalize(row.descricao.split(' - ').slice(-2).join(' - '));

    if (automotiveAudioCodes.has(row.codigo)) {
        return {
            segmento: 'som_automotivo',
            relevancia_oficina: 100,
            termos_busca: 'alto falante; auto falante; altifalante; som automotivo',
        };
    }
    const matches = rules.flatMap(rule => rule.terms.filter(term => containsTerm(text, term)).map(term => ({ ...rule, term })));
    const best = matches.sort((a, b) => b.score - a.score || b.term.length - a.term.length)[0];

    if (!best) {
        return { segmento: 'geral', relevancia_oficina: 0, termos_busca: '' };
    }

    const aliases = [...new Set(matches.filter(match => match.segmento === best.segmento).map(match => match.term))];
    const isMedicalGlove = best.segmento === 'epi_oficina' && /medicina|cirurgia|odontologia|veterinaria/.test(text);
    const isGenericAudioParent = best.segmento === 'som_automotivo' && !containsTerm(leafText, best.term);
    return {
        segmento: best.segmento,
        relevancia_oficina: isMedicalGlove ? 30 : isGenericAudioParent ? 35 : best.score,
        termos_busca: aliases.join('; '),
    };
}

async function run() {
    const pageSize = 1000;
    let rows: CatalogRow[] = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase.from('ncm_catalog').select('codigo, descricao').order('codigo').range(from, from + pageSize - 1);
        if (error) throw error;
        rows = rows.concat((data || []) as CatalogRow[]);
        if (!data || data.length < pageSize) break;
    }

    // Linhas sem descrição oficial não podem ser classificadas e, se reenviadas,
    // violam o NOT NULL de "descricao" no upsert. São puladas e relatadas abaixo.
    const valid = rows.filter(row => row.descricao && row.descricao.trim().length > 0);
    const skipped = rows.length - valid.length;
    if (skipped > 0) {
        console.warn(`Aviso: ${skipped} NCM(s) sem descrição serão ignorados (não há como classificar nem reenviar sem violar o NOT NULL).`);
    }

    console.log(`Classificando ${valid.length} NCMs sem alterar código/descrição oficial...`);
    const now = new Date().toISOString();
    // O Supabase trata upsert como INSERT em caso de conflito; reenviamos
    // a descrição oficial para nunca violar o NOT NULL em uma nova linha.
    const classified = valid.map(row => ({ codigo: row.codigo, descricao: row.descricao, ...classify(row), classificacao_fonte: 'regras_ia', classificacao_atualizada_at: now }));

    for (let from = 0; from < classified.length; from += pageSize) {
        const { error } = await supabase.from('ncm_catalog').upsert(classified.slice(from, from + pageSize), { onConflict: 'codigo' });
        if (error) throw error;
        console.log(`Atualizados ${Math.min(from + pageSize, classified.length)}/${classified.length}`);
    }

    const summary = classified.reduce<Record<string, number>>((acc, row) => {
        acc[row.segmento] = (acc[row.segmento] || 0) + 1;
        return acc;
    }, {});
    console.log(JSON.stringify(summary, null, 2));
}

run().catch(error => {
    console.error('Falha ao classificar NCMs:', error);
    process.exitCode = 1;
});
