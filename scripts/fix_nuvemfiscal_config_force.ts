
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
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId!);
    params.append('client_secret', clientSecret!);
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

    const { data: invoice } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (!invoice) { console.error("Invoice not found"); return; }

    const env = invoice.environment || 'production';
    console.log("Environment:", env);

    const { data: company } = await supabase
        .from('company_settings')
        .select('*')
        .eq('organization_id', invoice.organization_id)
        .single();

    if (!company) { console.error("Company not found"); return; }

    const cnpj = company.cnpj.replace(/\D/g, "");
    const token = await getNuvemFiscalToken(env);

    const baseUrl = env === 'production'
        ? "https://api.nuvemfiscal.com.br"
        : "https://api.sandbox.nuvemfiscal.com.br";

    // FETCH CSC FROM DB
    const cscId = env === 'production' ? company.csc_id_production : company.csc_id_homologation;
    const cscToken = env === 'production' ? company.csc_token_production : company.csc_token_homologation;

    if (!cscId || !cscToken) {
        console.error("CSC params missing in DB");
        return;
    }

    // FIX 1: PAD to 6 digits
    const paddedCscId = String(cscId).padStart(6, '0');
    console.log(`Fixing CSC ID: ${cscId} -> ${paddedCscId}`);

    // CONFIG PAYLOAD
    const nfcePayload = {
        ambiente: env === 'production' ? "producao" : "homologacao", // SEFAZ Environment
        sefaz: {
            id_csc: Number(cscId), // Reverting to Number as API requires Integer
            csc: cscToken
        },
        CRT: 1 // Forcing CRT 1 (Simples Nacional)
    };

    console.log(`Updating NFC-e Config at: ${baseUrl}/empresas/${cnpj}/nfce`);
    const resNfce = await fetch(`${baseUrl}/empresas/${cnpj}/nfce`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(nfcePayload)
    });

    if (resNfce.ok) {
        console.log("SUCCESS! NFC-e Config updated.");
        console.log(JSON.stringify(await resNfce.json(), null, 2));
    } else {
        console.log("Error updating NFC-e Config:", await resNfce.text());
    }
}

main();
