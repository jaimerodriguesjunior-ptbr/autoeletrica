import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRLS() {
    console.log("=== DIAGNÓSTICO DE RLS ===\n");

    // 1. Check if RLS is enabled on each table
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('check_rls_status');

    if (rlsError) {
        console.log("Função check_rls_status não existe. Tentando via information_schema...\n");

        // Alternative: Query pg_tables via a raw query workaround
        // Since we can't run raw SQL directly, let's try to check existing policies
        // by attempting operations
    }

    // 2. Try listing existing policies via pg_policies view
    // This might not be accessible, but let's try
    const tables = ['clients', 'work_orders', 'work_order_items', 'transactions', 'products', 'services', 'vehicles', 'fiscal_invoices', 'company_settings', 'organizations', 'profiles'];

    console.log("--- Verificando existência de organization_id em cada tabela ---");
    for (const table of tables) {
        try {
            // Try to select a single row with organization_id column
            const { data, error } = await supabase
                .from(table)
                .select("organization_id")
                .limit(1);

            if (error) {
                if (error.message.includes('organization_id')) {
                    console.log(`  ${table.padEnd(22)} | ❌ SEM coluna organization_id`);
                } else {
                    console.log(`  ${table.padEnd(22)} | ⚠️  Erro: ${error.message}`);
                }
            } else {
                console.log(`  ${table.padEnd(22)} | ✅ TEM coluna organization_id`);
            }
        } catch (e: any) {
            console.log(`  ${table.padEnd(22)} | ⚠️  Exception: ${e.message}`);
        }
    }

    // 3. Check how profiles links auth.uid() to organization_id
    console.log("\n--- Estrutura da tabela profiles (amostra) ---");
    const { data: profileSample } = await supabase
        .from("profiles")
        .select("*")
        .limit(1);

    if (profileSample && profileSample.length > 0) {
        console.log("  Colunas:", Object.keys(profileSample[0]).join(", "));
    }

    // 4. Test: Can the anon key access data from a different org?
    // Let's check if RLS is actually blocking with the anon key
    console.log("\n--- Teste de isolamento com chave anon ---");
    const anonSupabase = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: anonClients, error: anonError } = await anonSupabase
        .from("clients")
        .select("id")
        .limit(5);

    if (anonError) {
        console.log(`  clients (anon, sem login): ❌ BLOQUEADO - ${anonError.message}`);
        console.log("  → RLS parece estar ATIVO nesta tabela!");
    } else {
        console.log(`  clients (anon, sem login): ⚠️  ACESSÍVEL - retornou ${anonClients?.length || 0} registros`);
        if (anonClients && anonClients.length > 0) {
            console.log("  → ⚠️  CUIDADO: Dados acessíveis sem autenticação! RLS pode não estar configurado.");
        } else {
            console.log("  → Retornou 0 registros (pode ser RLS ou tabela vazia).");
        }
    }

    // Test other tables with anon
    for (const table of ['work_orders', 'transactions', 'products', 'fiscal_invoices']) {
        const { data, error } = await anonSupabase.from(table).select("id").limit(1);
        if (error) {
            console.log(`  ${table.padEnd(22)} (anon): ❌ BLOQUEADO`);
        } else {
            console.log(`  ${table.padEnd(22)} (anon): ⚠️  ACESSÍVEL (${data?.length || 0} registros)`);
        }
    }

    console.log("\n=== Diagnóstico concluído ===");
}

checkRLS().catch(console.error);
