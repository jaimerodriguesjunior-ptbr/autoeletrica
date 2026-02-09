import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getNuvemFiscalToken() {
    const clientId = process.env.NUVEMFISCAL_PROD_CLIENT_ID;
    const clientSecret = process.env.NUVEMFISCAL_PROD_CLIENT_SECRET;

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

async function updateConfig(envType: 'production' | 'homologation') {
    console.log(`\n=== Alterando Configuração para ${envType.toUpperCase()} ===`);

    const { data: company } = await supabase.from('company_settings').select('*').limit(1).single();

    const isProd = envType === 'production';
    const cscToken = isProd ? company.csc_token_production : company.csc_token_homologation;
    const cscId = isProd ? company.csc_id_production : company.csc_id_homologation;

    const configPayload = {
        ambiente: isProd ? "producao" : "homologacao",
        CRT: 1,
        sefaz: {
            id_csc: Number(cscId),
            csc: cscToken
        }
    };

    console.log("Payload:", JSON.stringify(configPayload, null, 2));

    const token = await getNuvemFiscalToken();
    const baseUrl = "https://api.nuvemfiscal.com.br";

    const response = await fetch(`${baseUrl}/empresas/${company.cnpj.replace(/\D/g, "")}/nfce`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(configPayload)
    });

    if (!response.ok) {
        console.error("Erro ao atualizar:", await response.text());
    } else {
        console.log("✅ Configuração atualizada com sucesso!");
        const data = await response.json();
        console.log("Nova Config:", JSON.stringify(data, null, 2));
    }
}

async function main() {
    const targetEnv = process.argv[2] as 'production' | 'homologation';
    if (!targetEnv) {
        console.error("Uso: npx tsx scripts/switch_env.ts [production|homologation]");
        return;
    }
    await updateConfig(targetEnv);
}

main();
