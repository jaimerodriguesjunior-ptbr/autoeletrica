import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const model = 'gemini-2.5-flash';

    try {
        const { descricao } = await req.json();

        if (!descricao) {
            return NextResponse.json({ error: 'Descrição da peça não fornecida.' }, { status: 400 });
        }

        const prompt = `Você é um especialista em classificação fiscal de mercadorias no Brasil. 
Dado a seguinte descrição de peça automotiva: "${descricao}"

Qual é o código NCM (Nomenclatura Comum do Mercosul) mais adequado?
Retorne APENAS um JSON (sem usar blocos markdown \`\`\`) no seguinte formato:
{
    "recommendation": "12345678",
    "options": [
        {"code": "12345678", "description": "Breve justificativa e descrição oficial primária"},
        {"code": "87082999", "description": "Outra alternativa viável caso a primeira não se aplique..."}
    ]
}
Sempre retorne códigos NCM com exatamente 8 dígitos, sem usar pontos. Forneça de 1 a 3 opções no array "options" ordenadas da mais provável para a menos provável. A chave "recommendation" deve conter a sua sugestão principal.`;

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
                                { text: prompt }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 500,
                        }
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`⚠️ [NCM IA] Erro na tentativa com a chave índice ${i}:`, errText);
                    lastError = new Error(errText);
                    continue; // Tenta a próxima chave
                }

                const data = await response.json();
                textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                
                if (textResponse) {
                    console.log(`✅ [NCM IA] Sucesso com a chave índice ${i}`);
                    break; // Sai do loop com sucesso
                }
            } catch (error: any) {
                console.error(`⚠️ [NCM IA] Exceção na tentativa com a chave índice ${i}:`, error.message);
                lastError = error;
                continue; // Tenta a próxima chave
            }
        }

        if (!textResponse) {
            console.error("❌ [NCM IA] Todas as tentativas falharam. Último erro:", lastError);
            return NextResponse.json({ error: 'Erro ao analisar descrição após múltiplas tentativas.' }, { status: 500 });
        }

        let resultData;
        try {
            // Clean markdown blocks if AI ignored prompt instruction
            const cleanText = textResponse.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
            resultData = JSON.parse(cleanText);
        } catch (e) {
            console.warn("⚠️ [NCM IA] JSON parse failed, returning fallback extraction", textResponse);
            // Fallback to simple regex if JSON parsing completely fails
            const matches = textResponse.match(/\b\d{8}\b/g) || [];
            if(matches.length > 0) {
               resultData = { recommendation: matches[0], options: matches.map((m: string) => ({code: m, description: "NCM Extraído."})) };
            } else {
               throw new Error("Não foi possível extrair NCM válido.");
            }
        }

        console.log(`✅ [NCM IA] Resultado processado para "${descricao}":`, resultData.recommendation);
        return NextResponse.json(resultData);

    } catch (error: any) {
        console.error("❌ [NCM IA] Erro:", error);
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }
}
