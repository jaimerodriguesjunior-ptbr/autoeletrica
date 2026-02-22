import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPolicies() {
    const { data: policies, error } = await supabase.rpc('get_table_policies', { table_name: 'profiles' });

    if (error) {
        console.log("RPC get_table_policies não existe. Vou executar uma query crua no information_schema.");

        // Em um cliente JS a gente não consegue rodar query customizada,
        // mas vamos tentar usar o pg_policies via pg_meta se possível ou fazer 
        // um select numa API que o supabase exponha (se ele expuser).
        // Melhor ainda, vou usar a rest.
    }
}

// Em vez de usar supabase JS que tem limitações em meta queries, vamos gerar um script que usa fetch
// ou criar logo um script sql para o usuário rodar? Não, eu tenho db_url? Não na env local, mas o supabase-js pode
// não ser capaz de ler pg_policies.
// Vamos tentar buscar via REST /pg_policies

async function fetchPgPolicies() {
    console.log("Tentando acessar pg_policies via REST...");
    const { data, error } = await supabase.from('pg_policies').select('*').eq('tablename', 'profiles');
    if (error) {
        console.log("Erro ao ler pg_policies (provavelmente sem permissão na REST):", error.message);
    } else {
        console.log("Políticas em profiles:");
        data.forEach((p: any) => console.log(`- ${p.policyname} (${p.cmd}): ${p.qual}`));
    }
}

fetchPgPolicies().catch(console.error);
