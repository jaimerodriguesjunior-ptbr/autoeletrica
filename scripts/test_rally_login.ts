import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRLS() {
    console.log("Logando como admin@rallyautocenter.com.br...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: "admin@rallyautocenter.com.br",
        password: "Rally@2026"
    });

    if (authError) {
        console.error("Erro login:", authError.message);
        return;
    }

    console.log("Login OK! UID:", authData.user.id);

    // Testar fetch de profiles
    const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('*');

    if (profError) {
        console.error("Erro RLS:", profError.message);
    } else {
        console.log(`\nProfiles retornados: ${profiles.length}`);
        profiles.forEach(p => {
            console.log(`- ${p.nome} (Org: ${p.organization_id})`);
        });
    }

    // Testar a function get_my_organization_id via RPC para ver o que ela retorna
    const { data: myOrg, error: rpcError } = await supabase.rpc('get_my_organization_id');
    console.log(`\nResultado de get_my_organization_id():`, myOrg, rpcError ? rpcError.message : "");
}

testRLS().catch(console.error);
