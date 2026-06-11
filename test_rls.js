require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const {data, error} = await s.rpc('exec_sql', {sql: "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('work_orders', 'transactions');"});
  console.log('error', error);
  console.log(data);
}
run();
