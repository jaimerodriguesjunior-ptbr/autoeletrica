
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const invoiceId = "21c9d7a4-b841-4ae4-8c07-03b39143ac81";

    const { data: invoice, error } = await supabase
        .from('fiscal_invoices')
        .select('id, tipo_documento, nuvemfiscal_uuid, pdf_url, xml_url, status, environment')
        .eq('id', invoiceId)
        .single();

    if (error) {
        console.error("Error fetching invoice:", error);
        return;
    }

    console.log("Invoice Data:");
    console.log(JSON.stringify(invoice, null, 2));
}

main();
