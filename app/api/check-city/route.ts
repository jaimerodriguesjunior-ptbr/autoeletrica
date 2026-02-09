import { NextResponse } from "next/server";
import { getNuvemFiscalToken } from "@/src/lib/nuvemfiscal";

export async function GET() {
    try {
        const token = await getNuvemFiscalToken();
        const response = await fetch(`${process.env.NUVEMFISCAL_URL}/nfse/cidades`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar cidades: ${response.status} ${await response.text()}`);
        }

        const cidades = await response.json();
        console.log("Resposta Cidades:", JSON.stringify(cidades).substring(0, 200) + "..."); // Logar início da resposta

        const listaCidades = cidades.data || cidades; // Tentar adaptar caso não tenha .data

        if (!Array.isArray(listaCidades)) {
            throw new Error("Formato de resposta inesperado da Nuvem Fiscal");
        }

        const guaira = listaCidades.find((c: any) => c.codigo_ibge === "4108809");

        return NextResponse.json({
            suportada: !!guaira,
            detalhes: guaira || "Cidade não encontrada na lista de atendidas."
        });

    } catch (error: any) {
        console.error("Erro no check-city:", error);
        // Fallback debug: write to file
        const fs = require('fs');
        fs.writeFileSync('debug_error.txt', `Error: ${error.message}\nStack: ${error.stack}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
