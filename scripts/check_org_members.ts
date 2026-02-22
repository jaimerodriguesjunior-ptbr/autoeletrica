import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkOrgMembers() {
    console.log("=== Checando tabela organization_members ===\n");

    // Check if organization_members exists
    const { data, error } = await supabase.from("organization_members").select("*").limit(1);
    if (error) {
        console.log("organization_members: NÃO EXISTE ou ERRO:", error.message);
    } else {
        console.log("organization_members: EXISTE, registros:", data?.length);
        if (data && data.length > 0) console.log("  Colunas:", Object.keys(data[0]).join(", "));
    }

    // Check profiles structure more deeply
    console.log("\n=== Profiles completo ===\n");
    const { data: profiles } = await supabase.from("profiles").select("*");
    profiles?.forEach(p => {
        console.log(`  ID: ${p.id}`);
        console.log(`    organization_id: ${p.organization_id}`);
        console.log(`    nome: ${p.nome}`);
        console.log(`    email: ${p.email}`);
        console.log(`    cargo: ${p.cargo}`);
        console.log(`    ativo: ${p.ativo}`);
        console.log("");
    });

    // Check how getUserProfile works
    console.log("\n=== A relação auth.uid() <-> profiles.id ===");
    console.log("Em Supabase, profiles.id = auth.users.id (UUID do auth).");
    console.log("Então: auth.uid() → profiles.id → profiles.organization_id");
    console.log("Essa é a cadeia que o RLS precisa usar.");
}

checkOrgMembers().catch(console.error);
