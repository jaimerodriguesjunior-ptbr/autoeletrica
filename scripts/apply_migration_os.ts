import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis do .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Faltam variáveis de ambiente SUPABASE_URL ou KEY.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- INSTRUÇÕES SOBRE O BANCO DE DADOS ---');
    console.log('Execute a seguinte query no SQL Editor do seu Supabase Dashboard:');
    console.log(`
    ALTER TABLE work_orders 
    ADD COLUMN IF NOT EXISTS defeitos_constatados TEXT,
    ADD COLUMN IF NOT EXISTS servicos_executados TEXT;
  `);
    console.log('Isso garantirá que os campos sejam criados na tabela work_orders de forma segura.');
}

run();
