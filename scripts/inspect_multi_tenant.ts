import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectMultiTenant() {
    console.log("=== PASSO 1: Inspecionando estrutura Multi-Tenant ===\n");

    // 1. Listar todas as organizações
    console.log("--- Tabela: organizations ---");
    const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("*");

    if (orgsError) {
        console.error("Erro ao buscar organizations:", orgsError.message);
    } else {
        console.log(`Total de organizações: ${orgs?.length || 0}`);
        orgs?.forEach((org, i) => {
            console.log(`  [${i + 1}] ID: ${org.id}`);
            console.log(`      Nome: ${org.name || org.nome || 'N/A'}`);
            console.log(`      Criado em: ${org.created_at || 'N/A'}`);
            // Print all fields
            Object.entries(org).forEach(([key, value]) => {
                if (!['id', 'name', 'nome', 'created_at'].includes(key)) {
                    console.log(`      ${key}: ${value}`);
                }
            });
        });
    }

    // 2. Listar perfis (profiles) vinculados
    console.log("\n--- Tabela: profiles ---");
    const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("*");

    if (profError) {
        console.error("Erro ao buscar profiles:", profError.message);
    } else {
        console.log(`Total de perfis: ${profiles?.length || 0}`);
        profiles?.forEach((p, i) => {
            console.log(`  [${i + 1}] ID: ${p.id}, Nome: ${p.full_name || p.nome || 'N/A'}, Org: ${p.organization_id || 'VAZIO!'}, Role: ${p.role || 'N/A'}`);
        });
    }

    // 3. Verificar cobertura de organization_id nas tabelas principais
    console.log("\n--- Cobertura de organization_id por tabela ---");
    const tables = ['clients', 'work_orders', 'work_order_items', 'transactions', 'products', 'services', 'vehicles', 'fiscal_invoices', 'company_settings'];

    for (const table of tables) {
        try {
            // Total
            const { count: total } = await supabase
                .from(table)
                .select("*", { count: 'exact', head: true });

            // Com organization_id preenchido
            const { count: comOrg } = await supabase
                .from(table)
                .select("*", { count: 'exact', head: true })
                .not("organization_id", "is", null);

            // Sem organization_id
            const { count: semOrg } = await supabase
                .from(table)
                .select("*", { count: 'exact', head: true })
                .is("organization_id", null);

            const coverage = total && total > 0 ? ((comOrg || 0) / total * 100).toFixed(1) : 'N/A';

            console.log(`  ${table.padEnd(22)} | Total: ${String(total || 0).padStart(5)} | Com Org: ${String(comOrg || 0).padStart(5)} | Sem Org: ${String(semOrg || 0).padStart(5)} | Cobertura: ${coverage}%`);
        } catch (e: any) {
            // Se a tabela não tem organization_id, vai dar erro diferente
            console.log(`  ${table.padEnd(22)} | ERRO: ${e.message || 'Coluna organization_id pode não existir'}`);
        }
    }

    console.log("\n=== Inspeção concluída ===");
}

inspectMultiTenant().catch(console.error);
