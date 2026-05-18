import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const cep = request.nextUrl.searchParams.get("cep")?.replace(/\D/g, "") || "";

    if (cep.length !== 8) {
        return NextResponse.json({ error: "CEP invalido. Informe 8 digitos." }, { status: 400 });
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
            next: { revalidate: 60 * 60 * 24 * 30 },
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Nao foi possivel consultar o CEP." }, { status: response.status });
        }

        const data = await response.json();

        if (data?.erro) {
            return NextResponse.json({ error: "CEP nao encontrado." }, { status: 404 });
        }

        return NextResponse.json({
            cep: data.cep || cep,
            logradouro: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            uf: data.uf || "",
            codigo_municipio: data.ibge || "",
        });
    } catch (error: any) {
        console.error("[CEP] Erro ao consultar ViaCEP:", error);
        return NextResponse.json({ error: "Erro ao consultar CEP." }, { status: 500 });
    }
}
