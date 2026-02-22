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

// O JSON original é um Array de objetos { Code: string, Description: string }
interface RawCode {
    Code: string;
    Description: string;
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

    const rawData: RawCode[] = await response.json();

    console.log(`Baixados ${rawData.length} códigos. Convertendo...`);

    const formatted: Obd2Code[] = rawData
        .filter((item) => item.Code && item.Description && item.Description.trim().length > 0)
        .map((item) => ({
            code: item.Code.trim(),
            description_pt: item.Description.trim(),
            category: getCategory(item.Code),
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

    // Mostrar exemplos
    console.log(`\n   Exemplos:`);
    formatted.slice(0, 5).forEach(c => {
        console.log(`   ${c.code}: ${c.description_pt}`);
    });
}

main().catch((err) => {
    console.error("Erro inesperado:", err);
    process.exit(1);
});
