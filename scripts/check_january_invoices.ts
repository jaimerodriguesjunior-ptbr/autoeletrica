import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
    const list = ['nfce', 'nfse', 'notas', 'emissoes', 'notas_fiscais', 'fiscal'];
    for (const name of list) {
        const { count, error } = await supabase.from(name).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`Table ${name}: Error ${error.code} - ${error.message}`);
        } else {
            console.log(`Table ${name}: EXISTS with ${count} rows`);
        }
    }
}

verifyTables();
