import fs from "fs";
import path from "path";

const SOURCE_URL = "https://raw.githubusercontent.com/fabiovila/OBDIICodes/master/Codigos-ptbr.json";
const OUTPUT_PATH = path.join(__dirname, "obd2_codes_data.json");

interface Obd2Code {
    code: string;
    description_pt: string;
    category: string;
    manufacturer: string | null;
}

// Determinar categoria baseada no prefixo do código
function getCategory(code: string): string {
    const prefix = code.charAt(0).toUpperCase();
    switch (prefix) {
        case "P": return "Powertrain (Motor/Transmissão)";
        case "C": return "Chassis";
        case "B": return "Body (Carroceria)";
        case "U": return "Rede/Comunicação";
        default: return "Geral";
    }
}

async function main() {
    console.log(`Baixando códigos de: ${SOURCE_URL}`);

    const response = await fetch(SOURCE_URL);

    if (!response.ok) {
        console.error(`Erro ao baixar: ${response.status} ${response.statusText}`);
        process.exit(1);
    }

    const rawData: Record<string, string> = await response.json();
    const keys = Object.keys(rawData);

    console.log(`Baixados ${keys.length} códigos. Convertendo...`);

    const formatted: Obd2Code[] = keys
        .filter((code) => {
            const val = rawData[code];
            return val != null && String(val).trim().length > 0;
        })
        .map((code) => ({
            code: code.trim(),
            description_pt: String(rawData[code]).trim(),
            category: getCategory(code),
            manufacturer: null,
        }));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(formatted, null, 2), "utf-8");

    console.log(`✅ Sucesso! ${formatted.length} códigos convertidos e salvos em obd2_codes_data.json`);
    console.log(`   Categorias encontradas:`);

    const categories: Record<string, number> = {};
    formatted.forEach(c => {
        categories[c.category] = (categories[c.category] || 0) + 1;
    });
    Object.entries(categories).forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count}`);
    });
}

main().catch((err) => {
    console.error("Erro inesperado:", err);
    process.exit(1);
});
