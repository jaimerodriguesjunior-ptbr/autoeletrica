import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
    console.log("Limpando registros com descrição genérica 'Consulte o manual do fabricante'...");

    // Obter quais registros vamos deletar para logar
    const { data: selectData } = await supabase
        .from("obd2_codes")
        .select("code")
        .ilike("description_pt", "%Consulte o manual%");

    if (selectData && selectData.length > 0) {
        console.log(`Encontrados ${selectData.length} registros para deletar:`, selectData.map(d => d.code).join(", "));

        const { error, count } = await supabase
            .from("obd2_codes")
            .delete({ count: 'exact' })
            .ilike("description_pt", "%Consulte o manual%");

        if (error) {
            console.error("Erro ao limpar:", error.message);
        } else {
            console.log(`Removidos ${count} registros genéricos do banco.`);
        }
    } else {
        console.log("Nenhum registro genérico encontrado no banco.");
    }
}

cleanup();
