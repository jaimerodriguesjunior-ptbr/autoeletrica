
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log("Investigating address issue for invoices #8 and #10...");

    const { data: invoices, error } = await supabase
        .from("fiscal_invoices")
        .select("id, numero, status, payload_json, nuvemfiscal_uuid, created_at")
        .in("numero", [8, 10])
        .order("numero", { ascending: true });

    if (error) {
        console.error("Error fetching invoices:", error);
        return;
    }

    if (!invoices || invoices.length === 0) {
        console.log("No invoices found with number 8 or 10 via integer check. Trying string...");
        const { data: invoicesStr } = await supabase
            .from("fiscal_invoices")
            .select("id, numero, status, payload_json, nuvemfiscal_uuid, created_at")
            .in("numero", ["8", "10"])
            .order("numero", { ascending: true });

        if (invoicesStr && invoicesStr.length > 0) {
            printInvoices(invoicesStr);
        } else {
            console.log("Still no invoices found. Listing last 5...");
            const { data: last5 } = await supabase.from("fiscal_invoices").select("numero, payload_json").limit(5).order("created_at", { ascending: false });
            printInvoices(last5 || []);
        }
        return;
    }

    printInvoices(invoices);
}

function printInvoices(invoices: any[]) {
    invoices.forEach(inv => {
        console.log(`\n--- Invoice #${inv.numero} ---`);
        console.log(`Status: ${inv.status}`);
        console.log(`UUID: ${inv.nuvemfiscal_uuid}`);

        let payload = inv.payload_json;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (e) {
                console.log("Payload is not valid JSON string");
            }
        }

        if (payload && payload.infDPS && payload.infDPS.toma) {
            console.log("Tomador (Payload):", JSON.stringify(payload.infDPS.toma, null, 2));
            if (!payload.infDPS.toma.end) {
                console.log(">>> WARNING: Address (end) is MISSING in payload. This likely triggered the use of municipal registry data.");
            }
        } else {
            console.log("Payload structure invalid or missing infDPS.toma");
            console.log(JSON.stringify(payload, null, 2));
        }
    });
}

run();
