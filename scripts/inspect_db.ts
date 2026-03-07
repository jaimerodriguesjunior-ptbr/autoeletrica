import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role to see everything if possible, or just use anon

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
    console.log('--- Clients ---')
    const { data: clients } = await supabase.from('clients').select('*').limit(1)
    if (clients && clients.length > 0) console.log(Object.keys(clients[0]))

    console.log('--- Work Orders ---')
    const { data: os } = await supabase.from('work_orders').select('*').limit(1)
    if (os && os.length > 0) console.log(Object.keys(os[0]))

    console.log('--- Transactions ---')
    const { data: trans } = await supabase.from('transactions').select('*').limit(1)
    if (trans && trans.length > 0) console.log(Object.keys(trans[0]))
}

inspect()
