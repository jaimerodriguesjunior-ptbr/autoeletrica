require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data, error } = await supabase.from('transactions').insert([{ organization_id: 'a60e0d8b-e045-467e-9bcb-9dc463639589', description: 'Teste', amount: 100, type: 'income', category: 'Vendas', status: 'pending', payment_method: 'cheque_pre', date: '2026-04-10' }]);
    if (error) console.error("ERRO:", error);
    else console.log("SUCESSO:", data);
    process.exit(0);
}

main();
