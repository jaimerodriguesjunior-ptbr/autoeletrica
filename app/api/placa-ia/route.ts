import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const model = 'gemini-2.5-flash';

    try {
        const { imageBase64, categoria } = await req.json();

        if (!imageBase64) {
            return NextResponse.json({ error: 'Imagem não fornecida.' }, { status: 400 });
        }

        const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const isBarco = categoria === 'barco';

        const prompt = isBarco
            ? `Analise esta foto de uma embarcação/barco. Retorne APENAS um JSON (sem formatação markdown, sem crases) com a propriedade "placa" contendo o Nome ou o Prefixo da embarcação identificada na imagem. Se não encontrar nada, retorne vazio: {"placa": ""}`
            : `Analise esta foto de um veículo automotivo (carro ou moto). Retorne APENAS um JSON (sem formatação markdown, sem crases) com a propriedade "placa" contendo a placa identificada na imagem. A placa deve conter APENAS letras e números (remova traços ou espaços). Se não encontrar nada, retorne vazio: {"placa": ""}`;

        // Busca chaves disponíveis
        const apiKeys = [
            process.env.GEMINI_SECRET_KEY_1,
            process.env.GEMINI_SECRET_KEY_2,
            process.env.GEMINI_SECRET_KEY_3,
            process.env.GEMINI_SECRET_KEY_4,
            process.env.GEMINI_SECRET_KEY_5,
            process.env.AUTOELETRICA_IA_KEY // Fallback legado
        ].filter(Boolean) as string[];

        if (apiKeys.length === 0) {
            return NextResponse.json({ error: 'Nenhuma chave da IA configurada.' }, { status: 500 });
        }

        let lastError = null;
        let textResponse = null;

        for (let i = 0; i < apiKeys.length; i++) {
            const currentKey = apiKeys[i];
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: "image/jpeg", data: base64Clean } }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 1024,
                        }
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`⚠️ [Placa IA] Erro na tentativa com a chave índice ${i}:`, errText);
                    lastError = new Error(errText);
                    continue;
                }

                const data = await response.json();
                textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

                if (textResponse) {
                    console.log(`✅ [Placa IA] Sucesso com a chave índice ${i}`);
                    break;
                }
            } catch (error: any) {
                console.error(`⚠️ [Placa IA] Exceção na tentativa com a chave índice ${i}:`, error.message);
                lastError = error;
                continue;
            }
        }

        if (!textResponse) {
            console.error("❌ [Placa IA] Todas as tentativas falharam. Último erro:", lastError);
            return NextResponse.json({ error: 'Erro ao analisar imagem após múltiplas tentativas.' }, { status: 500 });
        }

        // Tenta extrair JSON completo via regex para evitar erros caso a IA retorne texto extra
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log("✅ [Placa IA] Placa identificada:", parsed.placa);
                return NextResponse.json(parsed);
            } catch {
                console.warn("⚠️ [Placa IA] JSON mal formatado, usando fallback de regex");
            }
        }

        // Fallback: extrai a propriedade "placa"
        const match = textResponse.match(/"placa"\s*:\s*"([^"]*)"/i);
        const placa = match ? match[1] : '';

        console.log("✅ [Placa IA] Placa via regex:", placa);
        return NextResponse.json({ placa });

    } catch (error: any) {
        console.error("❌ [Placa IA] Erro:", error);
        return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
    }
}
