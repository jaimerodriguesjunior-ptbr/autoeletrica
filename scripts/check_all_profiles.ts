import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProfiles() {
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select(`
            id,
            nome,
            email,
            organization_id,
            organizations ( name )
        `);

    if (error) {
        console.error("Erro:", error);
        return;
    }

    console.log("=== TODOS OS PROFILES E SUAS ORGS ===");
    profiles.forEach(p => {
        console.log(`Nome: ${p.nome.padEnd(15)} | OrgID: ${p.organization_id} | OrgName: ${(p.organizations as any)?.name}`);
    });
}

checkProfiles().catch(console.error);
