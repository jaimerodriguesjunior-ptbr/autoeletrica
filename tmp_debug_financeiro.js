require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');

// Usar ANON KEY (como o browser faz) para testar RLS
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NECO_CLIENT_ID = '36ae0090-d42c-4120-add1-18f7048ee6b3';

async function run() {
  // Passo 1: Buscar work_orders do NECO
  const { data: wos, error: wosErr } = await s
    .from('work_orders')
    .select('id')
    .eq('client_id', NECO_CLIENT_ID);
  
  console.log('1. work_orders:', JSON.stringify(wos));
  console.log('   wos error:', wosErr);

  const woIds = (wos || []).map(w => w.id);
  console.log('2. woIds:', woIds);

  if (woIds.length === 0) {
    console.log('PROBLEMA: woIds está vazio! RLS pode estar bloqueando.');
    return;
  }

  // Passo 2: Buscar transactions
  const { data: txs, error: txsErr } = await s
    .from('transactions')
    .select('id, amount, status, type, date, description')
    .in('work_order_id', woIds)
    .eq('type', 'income');

  console.log('3. transactions:', JSON.stringify(txs));
  console.log('   txs error:', txsErr);

  // Passo 3: Simular a lógica do componente
  const pago = (txs || []).filter(t => t.status === 'paid').reduce((s, t) => s + (t.amount || 0), 0);
  const pendente = (txs || []).filter(t => t.status === 'pending').reduce((s, t) => s + (t.amount || 0), 0);
  console.log('4. totalPago:', pago, '  saldoDevedor:', pendente);

  const pagasList = (txs || []).filter(t => t.status === 'paid');
  console.log('5. pagasList.length:', pagasList.length);
  console.log('6. pagasList:', JSON.stringify(pagasList));
}

run();
