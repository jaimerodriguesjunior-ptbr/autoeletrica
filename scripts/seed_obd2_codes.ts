import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Carregar variáveis de ambiente do .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("ERRO: Variáveis NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY não encontradas no .env.local.");
    process.exit(1);
}

// Inicializar cliente do Supabase utilizando a chave de serviço para bypass do RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Obd2Code {
    code: string;
    description_pt: string;
    category: string;
    manufacturer: string | null;
}

async function seedObd2Codes() {
    console.log("Iniciando a importação de códigos OBD-II...");

    const dataPath = path.join(__dirname, "obd2_codes_data.json");

    if (!fs.existsSync(dataPath)) {
        console.error(`ERRO: Arquivo ${dataPath} não encontrado.`);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(dataPath, "utf-8");
    const codes: Obd2Code[] = JSON.parse(fileContent);

    console.log(`Lidos ${codes.length} códigos do arquivo JSON. Realizando upsert...`);

    // Dividir o array em lotes para evitar problemas de limite com muitos registros
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < codes.length; i += batchSize) {
        const batch = codes.slice(i, i + batchSize);

        console.log(`Enviando lote ${i / batchSize + 1} (${batch.length} registros)...`);

        const { error } = await supabase
            .from("obd2_codes")
            .upsert(batch, { onConflict: "code" }); // code é a primary key

        if (error) {
            console.error(`Erro ao inserir o lote ${i / batchSize + 1}:`, error.message);
            errorCount += batch.length;
        } else {
            successCount += batch.length;
        }
    }

    console.log("===============");
    console.log("Importação concluída!");
    console.log(`Registros importados/atualizados com sucesso: ${successCount}`);
    console.log(`Falhas: ${errorCount}`);
    console.log("===============");
}

seedObd2Codes().catch((err) => {
    console.error("Erro inesperado durante a execução do seed:", err);
    process.exit(1);
});
