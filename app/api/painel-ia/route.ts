import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const apiKey = process.env.AUTOELETRICA_IA_KEY;
    const model = 'gemini-2.5-flash';

    if (!apiKey) {
        return NextResponse.json({ error: 'Chave da IA não configurada.' }, { status: 500 });
    }

    try {
        const { imageBase64 } = await req.json();

        if (!imageBase64) {
            return NextResponse.json({ error: 'Imagem não fornecida.' }, { status: 400 });
        }

        const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');

        const prompt = `Analise esta foto de painel automotivo. Retorne APENAS um JSON (sem markdown) com:
{"odometro":"km","combustivel":"vazio|1/4|1/2|3/4|cheio","temperatura":"normal|elevada|critica","luzes_alerta":[],"observacao":""}
Se houver luzes acesas, liste em luzes_alerta e escreva observacao com tom respeitoso de suporte ao técnico. Se não identificar um campo, use "".`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("❌ [Painel IA] Erro na API:", errText);
            return NextResponse.json({ error: 'Erro ao analisar imagem.' }, { status: 500 });
        }

        const data = await response.json();
        const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            return NextResponse.json({ error: 'IA não retornou resposta.' }, { status: 500 });
        }

        // Tenta extrair JSON completo
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log("✅ [Painel IA] JSON parseado:", parsed);
                return NextResponse.json(parsed);
            } catch {
                console.warn("⚠️ [Painel IA] JSON truncado, extraindo campos via regex...");
            }
        }

        // Fallback: extrai campos individuais do texto (mesmo que JSON esteja quebrado)
        const extrair = (campo: string) => {
            const match = textResponse.match(new RegExp(`"${campo}"\\s*:\\s*"([^"]*)"`, 'i'));
            return match?.[1] || '';
        };

        const resultado = {
            odometro: extrair('odometro'),
            combustivel: extrair('combustivel'),
            temperatura: extrair('temperatura'),
            luzes_alerta: [] as string[],
            observacao: extrair('observacao'),
        };

        // Tenta extrair luzes_alerta como array
        const luzMatch = textResponse.match(/"luzes_alerta"\s*:\s*\[([\s\S]*?)\]/);
        if (luzMatch) {
            const luzesStr = luzMatch[1];
            resultado.luzes_alerta = [...luzesStr.matchAll(/"([^"]+)"/g)].map(m => m[1]);
        }

        console.log("✅ [Painel IA] Dados extraídos via regex:", resultado);
        return NextResponse.json(resultado);

    } catch (error: any) {
        console.error("❌ [Painel IA] Erro:", error);
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }
}
