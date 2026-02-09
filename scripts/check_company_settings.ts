import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data: companies, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1);

    if (companies && companies.length > 0) {
        const c = companies[0];
        console.log("Settings:", JSON.stringify(c, null, 2));
    } else {
        console.log("Nenhuma empresa encontrada.");
    }
}

checkSettings();
