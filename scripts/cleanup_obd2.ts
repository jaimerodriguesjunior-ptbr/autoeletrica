import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanup() {
    console.log("Limpando registros com descrição corrompida ([object Object]) e códigos numéricos...");

    // Remover registros com descrição [object Object]
    const { error: err1, count: count1 } = await supabase
        .from("obd2_codes")
        .delete({ count: 'exact' })
        .eq("description_pt", "[object Object]");

    if (err1) {
        console.error("Erro ao limpar [object Object]:", err1.message);
    } else {
        console.log(`Removidos ${count1} registros com [object Object]`);
    }

    // Verificar quantos registros válidos restaram
    const { count } = await supabase
        .from("obd2_codes")
        .select("*", { count: "exact", head: true });

    console.log(`Total de registros válidos no banco: ${count}`);
}

cleanup();
