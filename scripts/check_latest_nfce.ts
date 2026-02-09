import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    // Get the latest invoices
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching invoices:", error);
        return;
    }

    if (!invoices || invoices.length === 0) {
        console.log("Nenhuma nota fiscal encontrada no banco de dados.");
        return;
    }

    console.log(`=== ÚLTIMAS ${invoices.length} NOTAS FISCAIS ===\n`);

    for (const inv of invoices) {
        console.log("-----------------------------------");
        console.log("ID:", inv.id);
        console.log("Tipo:", inv.tipo_documento);
        console.log("Status:", inv.status);
        console.log("NuvemFiscal UUID:", inv.nuvemfiscal_uuid);
        console.log("Motivo Rejeição:", inv.motivo_rejeicao || "(nenhum)");
        console.log("Criado em:", inv.created_at);
    }
}

main();
