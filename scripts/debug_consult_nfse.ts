
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getNuvemFiscalToken(scope: string = "empresa:leitura") {
    const clientId = process.env.NUVEMFISCAL_CLIENT_ID;
    const clientSecret = process.env.NUVEMFISCAL_CLIENT_SECRET;
    const baseUrl = process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br"; // Assuming Prod for now based on env

    // For homologation/production switching, the script assumes production from .env by default or checks logic
    // The previous code checked 'environment' field on invoice.

    // Auth request
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'empresa nfe nfce nfse cte mdfe');

    const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
    });

    const data = await response.json();
    if (!response.ok) throw new Error("Erro auth: " + JSON.stringify(data));
    return data.access_token;
}

async function run() {
    console.log("Fetching latest invoice...");

    const { data: invoice, error } = await supabase
        .from("fiscal_invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !invoice) {
        console.error("Error fetching invoice:", error);
        return;
    }

    if (!invoice.nuvemfiscal_uuid) {
        console.log("Invoice has no NuvemFiscal UUID.");
        return;
    }

    console.log(`Consulting invoice: ${invoice.id} (UUID: ${invoice.nuvemfiscal_uuid})`);
    console.log(`Environment: ${invoice.environment}`);

    try {
        const baseUrl = invoice.environment === 'production'
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const token = await getNuvemFiscalToken();

        const response = await fetch(`${baseUrl}/nfse/${invoice.nuvemfiscal_uuid}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();
        console.log("-------------------------------------------");
        console.log("FULL API RESPONSE JSON:");
        console.log(JSON.stringify(result, null, 2));
        console.log("-------------------------------------------");

        // Check for 00229
        const jsonString = JSON.stringify(result);
        if (jsonString.includes("00229") || (jsonString.includes("cadastro") && jsonString.includes("endereço"))) {
            console.log(">>> MATCHED ERROR 00229! <<<");
        } else {
            console.log(">>> did NOT match error 00229 <<<");
        }

    } catch (e) {
        console.error(e);
    }
}

run();
