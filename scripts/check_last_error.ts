
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastError() {
    console.log("Buscando última nota com erro...");

    const { data: invoices, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .eq("status", "error")
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("Erro ao buscar:", error);
        return;
    }

    if (!invoices || invoices.length === 0) {
        console.log("Nenhuma nota com erro encontrada.");
        return;
    }

    const invoice = invoices[0];
    console.log("--- ÚLTIMO ERRO ---");
    console.log("ID:", invoice.id);
    console.log("Tipo:", invoice.tipo_documento);
    console.log("Data:", new Date(invoice.created_at).toLocaleString());
    console.log("Mensagem de Erro:", invoice.error_message);
    console.log("-------------------");
    console.log("Payload Enviado:", JSON.stringify(invoice.payload_json, null, 2));
}

checkLastError();
