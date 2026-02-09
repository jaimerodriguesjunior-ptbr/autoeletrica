
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getNuvemFiscalToken(environment = 'production') {
    let clientId, clientSecret;

    if (environment === 'production') {
        clientId = process.env.NUVEMFISCAL_PROD_CLIENT_ID;
        clientSecret = process.env.NUVEMFISCAL_PROD_CLIENT_SECRET;
    } else {
        clientId = process.env.NUVEMFISCAL_HOM_CLIENT_ID;
        clientSecret = process.env.NUVEMFISCAL_HOM_CLIENT_SECRET;
    }

    const authUrl = "https://auth.nuvemfiscal.com.br/oauth/token";

    if (!clientId || !clientSecret) {
        throw new Error(`Credenciais da Nuvem Fiscal (${environment}) não encontradas no .env.local`);
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'empresa nfce nfe nfse');

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    });

    if (!response.ok) {
        throw new Error(`Auth failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}

async function main() {
    // 1. Get latest authorized/processing NFSe
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tipo_documento', 'NFSe')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error || !invoices || invoices.length === 0) {
        console.error("No invoices found", error);
        return;
    }

    const invoice = invoices[0];
    console.log(`Checking Invoice ID: ${invoice.id}, NuvemUUID: ${invoice.nuvemfiscal_uuid}`);

    if (!invoice.nuvemfiscal_uuid) {
        console.error("No NuvemFiscal UUID found");
        return;
    }

    try {
        const env = invoice.environment || 'production';
        const token = await getNuvemFiscalToken(env);

        const baseUrl = env === 'production'
            ? (process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br")
            : (process.env.NUVEMFISCAL_HOM_URL || "https://api.sandbox.nuvemfiscal.com.br");

        console.log(`Fetching ${baseUrl}/nfse/${invoice.nuvemfiscal_uuid}`);

        const response = await fetch(`${baseUrl}/nfse/${invoice.nuvemfiscal_uuid}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const result = await response.json();
        console.log(JSON.stringify(result, null, 2));

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main();
