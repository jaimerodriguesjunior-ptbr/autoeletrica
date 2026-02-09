
import { getNuvemFiscalToken } from "../src/lib/nuvemfiscal";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testCredentials() {
    const cnpj = "35181069000143";
    const password = "Deusebom10@";

    console.log(`Testando credenciais para CNPJ: ${cnpj}`);
    console.log("Ambiente: Production");

    try {
        const token = await getNuvemFiscalToken('production');
        const baseUrl = process.env.NUVEMFISCAL_PROD_URL || "https://api.nuvemfiscal.com.br";

        const payload = {
            ambiente: "producao",
            prefeitura: {
                login: cnpj,
                senha: password
            },
            rps: { lote: 1, serie: "1", numero: 1 }
        };

        console.log("Enviando payload para Nuvem Fiscal:", JSON.stringify(payload, null, 2));

        const response = await fetch(`${baseUrl}/empresas/${cnpj}/nfse`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.text();
        console.log(`Status Code: ${response.status}`);
        console.log("Resposta:", result);

        if (response.ok) {
            console.log(">>> SUCESSO: Nuvem Fiscal aceitou as credenciais (Configuração Atualizada).");
        } else {
            console.log(">>> ERRO: Nuvem Fiscal rejeitou a configuração.");
        }

    } catch (error: any) {
        console.error("Erro fatal:", error.message);
    }
}

testCredentials();
