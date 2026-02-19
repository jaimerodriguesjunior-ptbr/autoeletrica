
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectInvoice() {
    console.log("Fetching latest invoice...");

    const { data: invoice, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error("Error fetching invoice:", error);
        return;
    }

    if (!invoice) {
        console.log("Invoice not found.");
        return;
    }

    console.log("---------------------------------------------------");
    console.log(`ID: ${invoice.id}`);
    console.log(`NuvemFiscal UUID: ${invoice.nuvemfiscal_uuid}`);
    console.log(`Date: ${invoice.created_at}`);
    console.log(`Status: ${invoice.status}`);
    console.log(`Error Message: ${invoice.error_message}`);
    console.log(`PDF URL: ${invoice.pdf_url}`);

    try {
        const payload = typeof invoice.payload_json === 'string' ? JSON.parse(invoice.payload_json) : invoice.payload_json;
        console.log("Full Payload JSON:\n", JSON.stringify(payload, null, 2));
    } catch (e) {
        console.log("Could not parse payload:", e);
    }
    console.log("---------------------------------------------------");
}

inspectInvoice();
