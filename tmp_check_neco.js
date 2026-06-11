const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// We need to find the supabase url and key. They are usually in .env or .env.local
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkNeco() {
  // Find client NECO
  const { data: clients } = await supabase.from('clients').select('id, nome').ilike('nome', '%NECO%');
  console.log('Clients:', clients);
  
  if (clients && clients.length > 0) {
    const clientId = clients[0].id;
    // Find OS for this client
    const { data: wos } = await supabase.from('work_orders').select('id').eq('client_id', clientId);
    console.log('Work Orders:', wos);
    
    if (wos && wos.length > 0) {
      const woIds = wos.map(w => w.id);
      // Find transactions
      const { data: txs } = await supabase.from('transactions').select('*').in('work_order_id', woIds);
      console.log('Transactions via OS:', txs);
    }
    
    // Check if transactions have client_id directly
    const { data: txsDirect } = await supabase.from('transactions').select('*').eq('client_id', clientId);
    if (txsDirect) {
        console.log('Transactions direct:', txsDirect);
    } else {
        console.log('Transactions direct: none or error');
    }
  }
}

checkNeco();
