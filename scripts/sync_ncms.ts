import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function checkIsVigente(dataFim?: string | null): boolean {
    if (!dataFim) return true;
    const clean = String(dataFim).trim();
    if (clean === "31/12/9999" || clean === "9999-12-31") return true;

    let endDate: Date | null = null;
    if (clean.includes("/")) {
        const parts = clean.split("/");
        if (parts.length === 3) {
            endDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
    } else if (clean.includes("-")) {
        endDate = new Date(clean);
    }

    if (!endDate || isNaN(endDate.getTime())) return true;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate >= today;
}

async function run() {
    console.log("==================================================");
    console.log("  SINCRONIZADOR DE CATÁLOGO NCM (SISCOMEX)        ");
    console.log("==================================================");
    console.log("1. Baixando arquivo JSON oficial do governo...");

    const url = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
    const res = await fetch(url, {
        headers: {
            "Accept": "application/json",
            "User-Agent": "AutoEletrica-NCM-Sync/1.0"
        }
    });

    if (!res.ok) {
        throw new Error(`Falha no download (${res.status}): ${res.statusText}`);
    }

    const json = await res.json();
    const rawList = Array.isArray(json) ? json : (json.Nomenclaturas || json.nomenclaturas || []);

    console.log(`2. Total de nomenclaturas brutas: ${rawList.length}. Mapeando hierarquia...`);

    const byCode = new Map<string, string>();
    for (const item of rawList) {
        const cleanCode = String(item.Codigo || item.codigo || "").replace(/\D/g, "");
        const rawDesc = String(item.Descricao || item.descricao || "").replace(/^[-—\s]+/, "").trim();
        if (cleanCode && rawDesc) {
            byCode.set(cleanCode, rawDesc);
        }
    }

    const formatted = rawList
        .filter((item: any) => {
            const code = String(item.Codigo || item.codigo || "").replace(/\D/g, "");
            return code.length === 8;
        })
        .map((item: any) => {
            const code = String(item.Codigo || item.codigo || "").replace(/\D/g, "").slice(0, 8);
            const dataFim = item.Data_Fim || item.data_fim || null;

            const prefixes = [
                code.slice(0, 4),
                code.slice(0, 5),
                code.slice(0, 6),
                code.slice(0, 7),
                code
            ];
            const parts: string[] = [];
            const seen = new Set<string>();
            for (const p of prefixes) {
                const desc = byCode.get(p);
                if (desc && !seen.has(desc.toLowerCase())) {
                    parts.push(desc);
                    seen.add(desc.toLowerCase());
                }
            }

            const fullDescription = parts.length > 0 ? parts.join(" - ") : (item.Descricao || item.descricao || "").trim();

            return {
                codigo: code,
                descricao: fullDescription,
                data_inicio: item.Data_Inicio || item.data_inicio || null,
                data_fim: dataFim,
                tipo: item.Tipo || item.tipo || "NCM",
                vigente: checkIsVigente(dataFim),
                updated_at: new Date().toISOString()
            };
        });

    const vigentesCount = formatted.filter((f: any) => f.vigente).length;
    console.log(`3. Total de NCMs (8 dígitos): ${formatted.length} (Vigentes: ${vigentesCount}, Históricos: ${formatted.length - vigentesCount})`);
    console.log("4. Realizando upsert enriquecido no Supabase em lotes de 1000...");

    const CHUNK_SIZE = 1000;
    let total = 0;

    for (let i = 0; i < formatted.length; i += CHUNK_SIZE) {
        const chunk = formatted.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
            .from("ncm_catalog")
            .upsert(chunk, { onConflict: "codigo" });

        if (error) {
            console.error(`\nErro ao inserir lote ${i} a ${i + chunk.length}:`, error);
            process.exit(1);
        }

        total += chunk.length;
        process.stdout.write(`\r   Progresso: ${total} / ${formatted.length} (${Math.round((total / formatted.length) * 100)}%)`);
    }

    console.log("\n5. Sincronização enriquecida concluída com sucesso!");
}

run().catch(err => {
    console.error("\nErro fatal na sincronização:", err);
    process.exit(1);
});
