import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ORG_ID = '7b2d3a85-de90-4e57-adb7-91102c11094a'; // NHT

async function testSequence() {
    console.log('--- TESTANDO SEQUENCIAL NFCe ---');

    // 1. Verificar se a tabela existe
    const { data: seq, error: seqError } = await supabase
        .from('nfce_sequences')
        .select('*')
        .eq('organization_id', ORG_ID);

    if (seqError) {
        console.error('ERRO: Tabela nfce_sequences não encontrada ou sem acesso. Execute a migração SQL primeiro.');
        return;
    }

    console.log('Tabela encontrada:', seq);

    // 2. Testar RPC
    console.log('\nChamando RPC get_next_nfce_number para Série 2...');
    const { data: nextNum, error: rpcError } = await supabase.rpc('get_next_nfce_number', {
        p_org_id: ORG_ID,
        p_serie: 2
    });

    if (rpcError) {
        console.error('ERRO ao chamar RPC:', rpcError.message);
        return;
    }

    console.log('Próximo número obtido:', nextNum);

    // 3. Verificar incremento
    const { data: seqAfter } = await supabase
        .from('nfce_sequences')
        .select('last_number')
        .eq('organization_id', ORG_ID)
        .eq('serie', 2)
        .single();

    console.log('Número no banco após incremento:', seqAfter?.last_number);

    if (nextNum === (seqAfter?.last_number)) {
        console.log('\n✅ SUCESSO: O sequencial está funcionando de forma atômica!');
    } else {
        console.log('\n❌ ERRO: Inconsistência no incremento.');
    }
}

testSequence();
