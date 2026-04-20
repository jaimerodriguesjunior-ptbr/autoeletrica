import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split(/\r?\n/).forEach(line => {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const tablesToCheck = [
  { name: 'clients', columns: ['nome', 'email', 'endereco'] },
  { name: 'products', columns: ['nome', 'descricao'] },
  { name: 'services', columns: ['nome'] },
  { name: 'fiscal_invoices', columns: ['error_message'] },
  { name: 'company_settings', columns: ['razao_social', 'nome_fantasia', 'logradouro', 'bairro', 'cidade'] },
  { name: 'transactions', columns: ['description', 'category'] }
];

const patterns = ['Ã£', 'Ã§', 'Ã¡', 'Ã©', 'Ã³', 'Ãµ', 'Ãª', 'Ã¢', 'Ã\xad', 'Ãƒ', 'Ã‡', 'Ã\u0081', 'Ã\u0089', 'Ã\u0093'];

const replaceMap: Record<string, string> = {
  'Ã£': 'ã', 'Ã§': 'ç', 'Ã¡': 'á', 'Ã©': 'é', 
  'Ã³': 'ó', 'Ãµ': 'õ', 'Ãª': 'ê', 'Ã¢': 'â', 
  'Ã\\xad': 'í', 'Ãƒ': 'Ã', 'Ã‡': 'Ç', 'Ã\\u0081': 'Á', 
  'Ã\\u0089': 'É', 'Ã\\u0093': 'Ó', 'Ã\u00ad': 'í',
  'Ã´': 'ô'
};

function fixString(str: string) {
  if (!str) return str;
  let fixed = str;
  for (const [bad, good] of Object.entries(replaceMap)) {
    fixed = fixed.split(bad).join(good);
  }
  return fixed;
}

async function fixDatabase() {
  console.log("Fixing database encoding issues...");
  
  const { data, error } = await supabase
    .from('fiscal_invoices')
    .select('id, error_message')
    .or(patterns.map(p => `error_message.ilike.%${p}%`).join(','));

  if (error) {
    console.log("Error querying fiscal_invoices:", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Found ${data.length} issues to fix in fiscal_invoices.error_message`);
    for (const row of data) {
      if (row.error_message) {
        const fixedStr = fixString(row.error_message);
        if (fixedStr !== row.error_message) {
          console.log(`Fixing ID: ${row.id}`);
          console.log(`  OLD: ${row.error_message}`);
          console.log(`  NEW: ${fixedStr}`);
          
          await supabase
            .from('fiscal_invoices')
            .update({ error_message: fixedStr })
            .eq('id', row.id);
        }
      }
    }
  }

  console.log("Database fix complete.");
}

fixDatabase();
