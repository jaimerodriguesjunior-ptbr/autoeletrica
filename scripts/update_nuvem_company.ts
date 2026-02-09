
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { getNuvemFiscalToken } from "../src/lib/nuvemfiscal";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCompanyRegime() {
    console.log("Atualizando Regime Tributário na Nuvem Fiscal...");

    // 1. Pegar CNPJ do banco
    const { data: companies } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1);

    if (!companies || companies.length === 0) {
        console.error("Empresa não encontrada no banco.");
        return;
    }

    const company = companies[0];
    const cnpj = (company.cnpj || company.cpf_cnpj).replace(/\D/g, "");
    const env = 'production'; // Forçando produção pois é onde o erro ocorre

    console.log(`Empresa: ${cnpj} - Ambiente: ${env}`);

    try {
        const token = await getNuvemFiscalToken(env);

        // Endpoint para atualizar dados da empresa (PUT /empresas/{cpf_cnpj})
        // Documentação: https://dev.nuvemfiscal.com.br/docs/api#tag/Empresa/operation/AtualizarEmpresa
        const url = `https://api.nuvemfiscal.com.br/empresas/${cnpj}`;

        const payload = {
            regime_tributario: 6 // 6 - Simples Nacional (ME EPP)
        };

        console.log("Enviando payload:", payload);

        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("Status:", response.status);
        console.log("Resposta:", JSON.stringify(result, null, 2));

        if (response.ok) {
            console.log("✅ Regime Tributário atualizado com sucesso!");
        } else {
            console.error("❌ Erro ao atualizar regime.");
        }

    } catch (error: any) {
        console.error("Erro:", error.message);
    }
}

updateCompanyRegime();
