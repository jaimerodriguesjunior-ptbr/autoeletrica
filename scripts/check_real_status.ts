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
    // Get the latest NFC-e invoice
    const { data: invoice } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('tipo_documento', 'NFCe')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!invoice) {
        console.error("No NFC-e invoice found");
        return;
    }

    console.log("=== Verificando Invoice na Nuvem Fiscal ===");
    console.log("DB ID:", invoice.id);
    console.log("DB Status:", invoice.status);
    console.log("DB Chave Acesso:", invoice.chave_acesso);
    console.log("NuvemFiscal UUID:", invoice.nuvemfiscal_uuid);
    console.log("");

    // Get token
    const token = await getNuvemFiscalToken('production');
    const baseUrl = "https://api.nuvemfiscal.com.br";

    // Fetch REAL status from NuvemFiscal
    console.log(`Consultando: ${baseUrl}/nfce/${invoice.nuvemfiscal_uuid}`);
    const response = await fetch(`${baseUrl}/nfce/${invoice.nuvemfiscal_uuid}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
        console.error("Erro ao consultar NuvemFiscal:", response.status, await response.text());
        return;
    }

    const nuvemData = await response.json();

    console.log("\n=== RESPOSTA COMPLETA DA NUVEM FISCAL ===");
    console.log(JSON.stringify(nuvemData, null, 2));

    console.log("\n=== ANÁLISE ===");
    console.log("Status NuvemFiscal:", nuvemData.status);
    console.log("Ambiente:", nuvemData.ambiente);

    if (nuvemData.autorizacao) {
        console.log("Código Status SEFAZ:", nuvemData.autorizacao.codigo_status);
        console.log("Motivo Status:", nuvemData.autorizacao.motivo_status);
        console.log("Protocolo:", nuvemData.autorizacao.numero_protocolo);
    }

    if (nuvemData.status === 'rejeitado') {
        console.log("\n⚠️  NOTA FOI REJEITADA!");
    } else if (nuvemData.status === 'autorizado') {
        console.log("\n✅ Nota realmente autorizada na Nuvem Fiscal");
    } else {
        console.log("\n❓ Status desconhecido:", nuvemData.status);
    }
}

main();
