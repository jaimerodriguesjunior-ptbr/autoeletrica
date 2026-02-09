
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastStatus() {
    console.log("Verificando status da última nota...");

    const { data: invoices, error } = await supabase
        .from("fiscal_invoices")
        .select("id, status, tipo_documento, created_at, error_message, provider_data")
        .order("created_at", { ascending: false })
        .limit(1);

    if (invoices && invoices.length > 0) {
        const inv = invoices[0];
        console.log("ID:", inv.id);
        console.log("Status:", inv.status);
        console.log("Tipo:", inv.tipo_documento);
        console.log("Erro (se houver):", inv.error_message);
        if (inv.provider_data) {
            console.log("Dados do Provedor:", JSON.stringify(inv.provider_data, null, 2));
        }
    } else {
        console.log("Nenhuma nota encontrada.");
    }
}

checkLastStatus();
