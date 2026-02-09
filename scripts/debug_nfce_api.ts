
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
        throw new Error(`Credenciais da Nuvem Fiscal (${environment}) não encontradas`);
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'empresa nfce nfe nfse');

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
    });
    if (!response.ok) throw new Error(`Auth failed: ${response.statusText}`);
    const data = await response.json();
    return data.access_token;
}

async function main() {
    const invoiceId = "9e331070-c6d5-4178-8a59-c6c4e97b47f3";

    const { data: invoice, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (error || !invoice) {
        console.error("Error fetching invoice:", error);
        return;
    }

    console.log("Invoice UUID:", invoice.nuvemfiscal_uuid);
    console.log("Environment:", invoice.environment);

    const env = invoice.environment || 'production';
    const token = await getNuvemFiscalToken(env);

    const baseUrl = env === 'production'
        ? "https://api.nuvemfiscal.com.br"
        : "https://api.sandbox.nuvemfiscal.com.br";

    // Query NFC-e status
    const statusUrl = `${baseUrl}/nfce/${invoice.nuvemfiscal_uuid}`;
    console.log(`Fetching: ${statusUrl}`);

    const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });

    const statusResult = await statusResponse.json();
    console.log("NFC-e Status Response:");
    console.log(JSON.stringify(statusResult, null, 2));

    // Try to get PDF
    const pdfUrl = `${baseUrl}/nfce/${invoice.nuvemfiscal_uuid}/pdf`;
    console.log(`Fetching PDF from: ${pdfUrl}`);

    const pdfResponse = await fetch(pdfUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });

    console.log("PDF Response Status:", pdfResponse.status);
    console.log("PDF Content-Type:", pdfResponse.headers.get('content-type'));
}

main();
