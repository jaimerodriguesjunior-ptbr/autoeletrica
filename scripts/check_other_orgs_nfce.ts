import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('organization_id, tipo_documento, status, numero')
        .eq('tipo_documento', 'NFCe')
        .neq('organization_id', '7b2d3a85-de90-4e57-adb7-91102c11094a');

    if (error) {
        console.error('Erro:', error.message);
        return;
    }

    const orgs = [...new Set((data || []).map(d => d.organization_id))];
    console.log('Outras orgs com NFCe:', orgs.length > 0 ? orgs : 'NENHUMA');
    console.log('Total registros:', (data || []).length);
}

check();
