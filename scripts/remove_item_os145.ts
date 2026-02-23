import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log("Iniciando remoção cirúrgica do Serviço (R$ 30,00) na OS 145...");

    const osId = 145;

    // Buscar os itens da OS
    const { data: items, error } = await supabase
        .from("work_order_items")
        .select("*")
        .eq("work_order_id", osId);

    if (error) {
        console.error("Erro ao buscar itens da OS 145:", error);
        return;
    }

    // Encontrar o serviço de 30 reais
    const itemToRemove = items.find(i =>
        i.name.toLowerCase().includes("serviço") &&
        i.total_price === 30 &&
        i.tipo === "servico"
    );

    if (!itemToRemove) {
        console.log("Serviço de R$ 30,00 não encontrado na OS 145. Estes são os itens atuais:");
        console.log(items);
        return;
    }

    console.log("Encontrado item para remover:", itemToRemove);

    // Deletar o item
    const { error: deleteError } = await supabase
        .from("work_order_items")
        .delete()
        .eq("id", itemToRemove.id);

    if (deleteError) {
        console.error("Erro ao deletar o item:", deleteError);
        return;
    }

    console.log("Item deletado com sucesso do banco.");

    // Recalcular o Total
    const remainingItems = items.filter(i => i.id !== itemToRemove.id);
    const newTotal = remainingItems.reduce((acc, i) => acc + (i.peca_cliente ? 0 : i.total_price), 0);

    console.log(`Novo total da OS será R$ ${newTotal.toFixed(2)}`);

    // Atualizar o Total da OS
    const { error: updateError } = await supabase
        .from("work_orders")
        .update({ total: newTotal })
        .eq("id", osId);

    if (updateError) {
        console.error("Erro ao atualizar o total da OS:", updateError);
        return;
    }

    console.log("Total da OS 145 atualizado com sucesso!");
}

run();
