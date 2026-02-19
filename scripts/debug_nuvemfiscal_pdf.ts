
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getNuvemFiscalToken(scope: string = "empresa:leitura") {
    const clientId = process.env.NUVEMFISCAL_CLIENT_ID;
    const clientSecret = process.env.NUVEMFISCAL_CLIENT_SECRET;
    const baseUrl = process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br";

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

    console.log(`Checking PDF for Invoice ID: ${invoice.id}`);
    console.log(`NuvemFiscal UUID: ${invoice.nuvemfiscal_uuid}`);

    try {
        const baseUrl = invoice.environment === 'production'
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        const token = await getNuvemFiscalToken();

        const endpoint = `${baseUrl}/nfse/${invoice.nuvemfiscal_uuid}/pdf`;
        console.log(`Fetching: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.log("Error Body:", text);
        } else {
            console.log("Success! PDF binary received (length: " + (await response.arrayBuffer()).byteLength + ")");
        }

    } catch (e) {
        console.error(e);
    }
}

run();
