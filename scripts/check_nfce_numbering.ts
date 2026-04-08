import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ORG_ID = '7b2d3a85-de90-4e57-adb7-91102c11094a'; // NHT - Norberto

async function checkNFCeNumbering() {
    console.log('=== ANÁLISE DE NUMERAÇÃO NFCe - NHT Norberto ===\n');

    // 1. Buscar todas as NFCe dessa organização
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('id, numero, serie, status, environment, created_at, chave_acesso')
        .eq('organization_id', ORG_ID)
        .eq('tipo_documento', 'NFCe')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erro ao buscar notas:', error.message);
        return;
    }

    if (!invoices || invoices.length === 0) {
        console.log('Nenhuma NFCe encontrada para esta organização.');
        return;
    }

    console.log(`Total de NFCe encontradas: ${invoices.length}\n`);

    // 2. Separar por ambiente e status
    const prodAuthorized = invoices.filter(i => i.environment === 'production' && i.status === 'authorized');
    const prodAll = invoices.filter(i => i.environment === 'production');
    const homAll = invoices.filter(i => i.environment === 'homologation');

    console.log(`--- PRODUÇÃO ---`);
    console.log(`Total: ${prodAll.length} | Autorizadas: ${prodAuthorized.length}`);
    console.log(`\nTodas as NFCe de Produção (por data):`);
    prodAll.forEach(inv => {
        console.log(`  nNF: ${String(inv.numero).padStart(6, ' ')} | Serie: ${inv.serie} | Status: ${inv.status.padEnd(12)} | Data: ${inv.created_at} | Chave: ${inv.chave_acesso || 'N/A'}`);
    });

    // 3. Análise dos números usados em produção
    const usedNumbers = prodAll.map(i => i.numero).filter(Boolean).sort((a: number, b: number) => a - b);
    const authorizedNumbers = prodAuthorized.map(i => i.numero).filter(Boolean).sort((a: number, b: number) => a - b);

    console.log(`\n--- NÚMEROS USADOS (PRODUÇÃO) ---`);
    console.log(`Todos os números usados (asc): [${usedNumbers.join(', ')}]`);
    console.log(`Números autorizados (asc): [${authorizedNumbers.join(', ')}]`);

    if (authorizedNumbers.length > 0) {
        console.log(`\nMenor número autorizado: ${authorizedNumbers[0]}`);
        console.log(`Maior número autorizado: ${authorizedNumbers[authorizedNumbers.length - 1]}`);
    }

    // 4. Sugestão de próximo número seguro
    const allNumbers = usedNumbers.map(Number);
    const maxUsed = allNumbers.length > 0 ? Math.max(...allNumbers) : 0;
    console.log(`\n--- RECOMENDAÇÃO ---`);
    console.log(`Maior número já usado (qualquer status): ${maxUsed}`);
    console.log(`Próximo número seguro para iniciar sequência: ${maxUsed + 1}`);

    // 5. Homologação (se houver)
    if (homAll.length > 0) {
        console.log(`\n--- HOMOLOGAÇÃO ---`);
        console.log(`Total: ${homAll.length}`);
        homAll.forEach(inv => {
            console.log(`  nNF: ${String(inv.numero).padStart(6, ' ')} | Status: ${inv.status.padEnd(12)} | Data: ${inv.created_at}`);
        });
    }
}

checkNFCeNumbering();
