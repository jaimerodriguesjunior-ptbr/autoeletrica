
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastPayload() {
    console.log("Verificando payload da última nota...");

    const { data: invoices, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

    if (invoices && invoices.length > 0) {
        const inv = invoices[0];
        console.log("ID:", inv.id);
        console.log("Payload JSON:", JSON.stringify(inv.payload_json, null, 2));
    } else {
        console.log("Nenhuma nota encontrada.");
    }
}

checkLastPayload();
