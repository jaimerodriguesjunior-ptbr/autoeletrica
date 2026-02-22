import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    const apiKey = process.env.AUTOELETRICA_IA_KEY;
    const model = 'gemini-2.5-flash';

    if (!apiKey) {
        return NextResponse.json({ error: 'Chave da IA não configurada.' }, { status: 500 });
    }

    try {
        const { code } = await req.json();

        if (!code || typeof code !== 'string' || code.trim().length < 2) {
            return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
        }

        const codeClean = code.trim().toUpperCase();

        const prefix = codeClean.charAt(0);
        const categoryHint = prefix === 'P' ? 'Powertrain (motor e transmissão)'
            : prefix === 'C' ? 'Chassis (freios, suspensão, direção)'
                : prefix === 'B' ? 'Body (carroceria, airbag, ar condicionado, iluminação)'
                    : prefix === 'U' ? 'Network/Communication (rede CAN, comunicação entre módulos)'
                        : 'automotivo';

        const prompt = `Você é um engenheiro automotivo especialista em diagnóstico OBD-II/EOBD.

O código "${codeClean}" pertence à categoria ${categoryHint}.

Códigos OBD-II seguem o padrão SAE J2012. Exemplos:
- P0420 = Eficiência do catalisador abaixo do limite (banco 1)
- C0035 = Circuito do sensor de velocidade da roda dianteira esquerda
- B1000 = Avaria no circuito do módulo de controle ECM/PCM
- U0100 = Perda de comunicação com o módulo de controle do motor (ECM/PCM)

Qual é a descrição técnica do código "${codeClean}" em português-BR?
Responda APENAS com um JSON: {"description":"descrição aqui"}
Se realmente não souber, responda: {"description":"Código ${codeClean} – Consulte o manual do fabricante"}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 256,
                }
            })
        });

        if (!response.ok) {
            console.error("❌ [OBD2 IA] Erro na API:", await response.text());
            return NextResponse.json({ error: 'Erro ao consultar IA.' }, { status: 500 });
        }

        const data = await response.json();
        const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`🔍 [OBD2 IA] Código: ${codeClean} | Resposta bruta:`, textResponse);

        if (!textResponse) {
            return NextResponse.json({ error: 'IA não retornou resposta.' }, { status: 500 });
        }

        // Extrair JSON da resposta
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        let description = '';

        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                description = parsed.description || '';
            } catch {
                // Fallback: tenta extrair direto do texto
                const match = textResponse.match(/"description"\s*:\s*"([^"]*)"/i);
                description = match?.[1] || '';
            }
        }

        // Se ainda não tem descrição, usa fallback genérico
        const isGeneric = !description;
        if (isGeneric) {
            description = `Código ${codeClean} – Consulte o manual do fabricante`;
        }

        // Salvar no banco como cache SOMENTE se não for a resposta genérica
        if (!isGeneric) {
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
                const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
                const supabase = createClient(supabaseUrl, supabaseServiceKey);

                await supabase
                    .from('obd2_codes')
                    .upsert({
                        code: codeClean,
                        description_pt: description,
                        category: 'IA (Gemini)',
                        manufacturer: null,
                    }, { onConflict: 'code' });

                console.log(`✅ [OBD2 IA] Código ${codeClean} salvo no cache: ${description}`);
            } catch (cacheErr) {
                console.warn("⚠️ [OBD2 IA] Erro ao salvar cache:", cacheErr);
            }
        } else {
            console.log(`ℹ️ [OBD2 IA] Código ${codeClean} retornou reposta genérica. Não salvo no cache.`);
        }

        return NextResponse.json({
            code: codeClean,
            description_pt: description,
            source: 'ia'
        });

    } catch (error: any) {
        console.error("❌ [OBD2 IA] Erro:", error);
        return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }
}
