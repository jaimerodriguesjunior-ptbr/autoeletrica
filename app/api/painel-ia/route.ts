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
            ? `Analise esta foto de painel de embarcação/barco. Retorne APENAS um JSON (sem markdown) com:
{"horimetro":"horas","combustivel":"vazio|1/4|1/2|3/4|cheio","voltagem_bateria":"volts ou nao_identificado","alertas":[],"observacao":""}
Se houver alertas ou indicadores acesos, liste em alertas. Se não identificar um campo, use "nao_identificado".`
            : `Analise esta foto de painel automotivo. Retorne APENAS um JSON (sem markdown) com:
{"odometro":"km","combustivel":"vazio|1/4|1/2|3/4|cheio","temperatura":"normal|elevada|critica","luzes_alerta":[],"observacao":""}
Se houver luzes acesas, liste em luzes_alerta e escreva observacao com tom respeitoso de suporte ao técnico. Se não identificar um campo, use "".`;

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

        // Tenta cada chave até obter sucesso
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
                            maxOutputTokens: 2048,
                        }
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`⚠️ [Painel IA] Erro na tentativa com a chave índice ${i}:`, errText);
                    lastError = new Error(errText);
                    continue; // Tenta a próxima chave
                }

                const data = await response.json();
                textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (textResponse) {
                    console.log(`✅ [Painel IA] Sucesso com a chave índice ${i}`);
                    break; // Sai do loop com sucesso
                }
            } catch (error: any) {
                console.error(`⚠️ [Painel IA] Exceção na tentativa com a chave índice ${i}:`, error.message);
                lastError = error;
                continue; // Tenta a próxima chave em caso de erro de rede, por exemplo
            }
        }

        if (!textResponse) {
            console.error("❌ [Painel IA] Todas as tentativas falharam. Último erro:", lastError);
            return NextResponse.json({ error: 'Erro ao analisar imagem após múltiplas tentativas.' }, { status: 500 });
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

        const resultado = isBarco ? {
            odometro: extrair('horimetro'),
            combustivel: extrair('combustivel'),
            temperatura: '',
            luzes_alerta: [] as string[],
            observacao: extrair('observacao'),
            voltagem_bateria: extrair('voltagem_bateria'),
        } : {
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
