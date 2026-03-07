require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data, error } = await supabase.from('transactions').select('*').eq('work_order_id', 232);
    if (error) console.error("ERRO:", error);
    else console.log("TRANSAÇÕES:", data);
    process.exit(0);
}

main();
