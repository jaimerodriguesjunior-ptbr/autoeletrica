
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log("Testing fiscal invoices query...");

    // Using a known organization_id if possible, or just listing all to see error
    // fetch one row to test syntax
    const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*, work_orders(clients(nome, cel))')
        .limit(5);

    if (error) {
        console.error("QUERY ERROR:", error);
    } else {
        console.log("Query Successful. Rows:", data?.length);
        if (data && data.length > 0) {
            console.log("Sample:", JSON.stringify(data[0], null, 2));
        }
    }
}

run();
