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

        const prompt = `Você é um especialista em diagnóstico automotivo OBD-II.
Qual é a descrição do código de falha "${codeClean}"?
Responda APENAS com um JSON no formato: {"description":"descrição em português-BR usando termos técnicos de oficina mecânica"}
Se o código não existir ou for inválido, responda: {"description":""}
Não inclua markdown, apenas o JSON.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
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

        if (!description) {
            return NextResponse.json({ code: codeClean, description_pt: null, source: 'ia' });
        }

        // Salvar no banco como cache para futuras buscas
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
            // Não falha se cache der erro, continua retornando o resultado
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
