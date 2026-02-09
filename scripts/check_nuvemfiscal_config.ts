
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
    // 1. Get Company CNPJ from DB (assuming the user's org)
    // We can hardcode specific CNPJ or query via invoices
    const invoiceId = "9e331070-c6d5-4178-8a59-c6c4e97b47f3"; // The last invoice

    const { data: invoice } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (!invoice) {
        console.error("Invoice not found to determine company");
        return;
    }

    // Determine Environment from Invoice or default
    const env = invoice.environment || 'production';
    console.log("Checking Environment:", env);

    const { data: company } = await supabase
        .from('company_settings')
        .select('*')
        .eq('organization_id', invoice.organization_id)
        .single();

    if (!company) {
        console.error("Company settings not found");
        return;
    }

    const cnpj = company.cnpj.replace(/\D/g, "");
    console.log("CNPJ:", cnpj);

    // 2. Get Token
    const token = await getNuvemFiscalToken(env);

    const baseUrl = env === 'production'
        ? "https://api.nuvemfiscal.com.br"
        : "https://api.sandbox.nuvemfiscal.com.br";

    // 3. Fetch Company Config in NuvemFiscal
    // Endpoint: /empresas/{cpf_cnpj}
    console.log(`Fetching Company Config from: ${baseUrl}/empresas/${cnpj}`);
    const resCompany = await fetch(`${baseUrl}/empresas/${cnpj}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (resCompany.ok) {
        console.log("Company Config:");
        console.log(JSON.stringify(await resCompany.json(), null, 2));
    } else {
        console.log("Error fetching Company:", await resCompany.text());
    }

    // 4. Fetch NFC-e Config
    // Endpoint: /empresas/{cpf_cnpj}/nfce
    console.log(`Fetching NFC-e Config from: ${baseUrl}/empresas/${cnpj}/nfce`);
    const resNfce = await fetch(`${baseUrl}/empresas/${cnpj}/nfce`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (resNfce.ok) {
        const nfceConfig = await resNfce.json();
        console.log("NFC-e Config:");
        console.log(JSON.stringify(nfceConfig, null, 2));

        // Debug ID Token format
        if (nfceConfig.sefaz && nfceConfig.sefaz.id_csc) {
            console.log("\n[CHECK] ID CSC format:", nfceConfig.sefaz.id_csc, "Type:", typeof nfceConfig.sefaz.id_csc);
        }
    } else {
        console.log("Error fetching NFC-e Config:", await resNfce.text());
    }
}

main();
