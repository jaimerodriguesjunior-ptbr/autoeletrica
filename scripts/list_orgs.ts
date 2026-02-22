import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkOrgs() {
    const { data: orgs, error } = await supabaseAdmin
        .from('organizations')
        .select('*');

    if (error) {
        console.error("Erro:", error);
        return;
    }

    console.log("=== ORGANIZAÇÕES EXISTENTES ===");
    orgs.forEach(o => {
        console.log(`ID: ${o.id} | Nome: ${o.name}`);
    });
}

checkOrgs().catch(console.error);
