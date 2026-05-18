import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const model = 'gemini-2.5-flash';
  const requestId = `ncm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { descricao } = await req.json();

    if (!descricao) {
      return NextResponse.json({ error: 'Descrição da peça não fornecida.' }, { status: 400 });
    }

    const normalizedDesc = String(descricao || '').toLowerCase();

    const promptBase = `NCM autopeça Brasil. Descrição: "${descricao}".
Retorne APENAS JSON curto:
{"recommendation":"12345678" ou null,"confidence":0-100,"needs_review":true/false,"reason":"curto","options":[{"code":"12345678","description":"curto","confidence":0-100}]}
Regras: code com 8 dígitos; 1-3 opções; se dúvida, needs_review=true.`;

    const estimatedInputTokens = Math.ceil((promptBase.length + String(descricao || '').length) / 4);
    console.log(`[NCM IA][${requestId}] Início | model=${model} | descricao="${descricao}" | est_input_tokens=${estimatedInputTokens}`);

    const apiKeys = [
      process.env.GEMINI_SECRET_KEY_1,
      process.env.GEMINI_SECRET_KEY_2,
      process.env.GEMINI_SECRET_KEY_3,
      process.env.GEMINI_SECRET_KEY_4,
      process.env.GEMINI_SECRET_KEY_5,
      process.env.AUTOELETRICA_IA_KEY
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      return NextResponse.json({ error: 'Nenhuma chave da IA configurada.' }, { status: 500 });
    }

    let lastError: unknown = null;
    let textResponse: string | null = null;
    let selectedKeyIndex: number | null = null;
    let selectedUsage: any = null;
    let selectedFinishReason: string | null = null;

    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentKey}`;

      const makeRequest = async (prompt: string, maxOutputTokens: number) =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  recommendation: { type: 'STRING', nullable: true },
                  confidence: { type: 'NUMBER' },
                  needs_review: { type: 'BOOLEAN' },
                  reason: { type: 'STRING' },
                  options: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        code: { type: 'STRING' },
                        description: { type: 'STRING' },
                        confidence: { type: 'NUMBER' }
                      },
                      required: ['code', 'description', 'confidence']
                    }
                  }
                },
                required: ['recommendation', 'confidence', 'needs_review', 'reason', 'options']
              }
            }
          })
        });

      try {
        console.log(`[NCM IA][${requestId}] Tentativa chave índice=${i}`);

        let response = await makeRequest(promptBase, 220);

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[NCM IA][${requestId}] Erro HTTP na chave índice=${i} status=${response.status}:`, errText);
          lastError = new Error(errText);
          continue;
        }

        let data = await response.json();
        textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        selectedUsage = data?.usageMetadata || null;
        selectedFinishReason = data?.candidates?.[0]?.finishReason || null;

        if (textResponse && selectedFinishReason === 'MAX_TOKENS') {
          console.warn(`[NCM IA][${requestId}] MAX_TOKENS detectado, retry rápido`);
          response = await makeRequest(`NCM da descrição "${descricao}". JSON mínimo no schema.`, 320);
          if (response.ok) {
            data = await response.json();
            const retryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (retryText) {
              textResponse = retryText;
              selectedUsage = data?.usageMetadata || selectedUsage;
              selectedFinishReason = data?.candidates?.[0]?.finishReason || selectedFinishReason;
            }
          }
        }

        if (textResponse) {
          selectedKeyIndex = i;
          const promptTokens = selectedUsage?.promptTokenCount ?? 'n/a';
          const outputTokens = selectedUsage?.candidatesTokenCount ?? 'n/a';
          const totalTokens = selectedUsage?.totalTokenCount ?? 'n/a';
          console.log(`[NCM IA][${requestId}] Sucesso | chave índice=${i} | finish_reason=${selectedFinishReason} | prompt_tokens=${promptTokens} | output_tokens=${outputTokens} | total_tokens=${totalTokens}`);
          break;
        }
      } catch (error: any) {
        console.error(`[NCM IA][${requestId}] Exceção na chave índice=${i}:`, error.message);
        lastError = error;
      }
    }

    if (!textResponse) {
      console.error(`[NCM IA][${requestId}] Todas as tentativas falharam. Último erro:`, lastError);
      return NextResponse.json({ error: 'Erro ao analisar descrição após múltiplas tentativas.' }, { status: 500 });
    }

    let resultData: any;
    try {
      const cleanText = textResponse.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
      resultData = JSON.parse(cleanText);
    } catch {
      const raw = String(textResponse || '');
      const extracted = raw.match(/\b\d{8}\b/g) || [];
      const uniqueCodes = Array.from(new Set(extracted)).slice(0, 3);
      if (uniqueCodes.length > 0) {
        console.warn(`[NCM IA][${requestId}] JSON parse failed, recovery por extração. Códigos=${uniqueCodes.join(',')}`);
        resultData = {
          recommendation: uniqueCodes[0],
          confidence: 65,
          needs_review: true,
          reason: 'Resposta parcial da IA; códigos extraídos para revisão.',
          options: uniqueCodes.map((code) => ({
            code,
            description: 'NCM extraído de resposta parcial da IA.',
            confidence: 65
          }))
        };
      } else {
        console.warn(`[NCM IA][${requestId}] JSON parse failed sem código extraível. Tentando fallback determinístico por descrição.`);
        // Fallback determinístico por palavras-chave (evita 502 para itens comuns)
        const fallback = getDeterministicNcmFallback(normalizedDesc);
        if (fallback) {
          return NextResponse.json(fallback);
        }
        return NextResponse.json({ error: 'A IA retornou resposta inválida. Tente novamente.' }, { status: 502 });
      }
    }

    const rawOptions = Array.isArray(resultData?.options) ? resultData.options : [];
    const options = rawOptions
      .map((opt: any) => ({
        code: String(opt?.code || '').replace(/\D/g, '').slice(0, 8),
        description: String(opt?.description || '').trim(),
        confidence: Number(opt?.confidence || 0)
      }))
      .filter((opt: any) => /^\d{8}$/.test(opt.code));

    const dedupMap = new Map<string, any>();
    for (const opt of options) {
      if (!dedupMap.has(opt.code)) dedupMap.set(opt.code, opt);
    }
    let cleanOptions = Array.from(dedupMap.values()).slice(0, 3);

    console.log(`[NCM IA][${requestId}] Pós-processamento | chave índice=${selectedKeyIndex} | options_brutas=${rawOptions.length} | options_validas=${cleanOptions.length}`);

    if (cleanOptions.length === 0) {
      const fallback = getDeterministicNcmFallback(normalizedDesc);
      if (fallback) {
        console.warn(`[NCM IA][${requestId}] Fallback aplicado por descrição.`);
        return NextResponse.json(fallback);
      }
      console.warn(`[NCM IA][${requestId}] Sem opções válidas e sem fallback aplicável.`);
      return NextResponse.json({ error: 'A IA não encontrou NCM confiável para esta descrição.' }, { status: 422 });
    }

    const rawConfidence = Number(resultData?.confidence || cleanOptions[0]?.confidence || 0);
    const confidence = rawConfidence > 0 && rawConfidence <= 1 ? Math.round(rawConfidence * 100) : Math.round(rawConfidence);
    const recommended = String(resultData?.recommendation || '').replace(/\D/g, '');
    const hasRecommendedInOptions = cleanOptions.some((opt: any) => opt.code === recommended);
    const canAutoRecommend = confidence >= 75 && hasRecommendedInOptions;

    const finalPayload = {
      recommendation: canAutoRecommend ? recommended : null,
      confidence,
      needs_review: !canAutoRecommend,
      reason: String(resultData?.reason || '').trim() || (canAutoRecommend ? 'Sugestão com confiança alta.' : 'Revisão manual recomendada.'),
      options: cleanOptions
    };

    console.log(`[NCM IA][${requestId}] Resultado final | recommendation=${finalPayload.recommendation} | confidence=${confidence} | needs_review=${finalPayload.needs_review} | reason="${finalPayload.reason}"`);
    return NextResponse.json(finalPayload);
  } catch (error: any) {
    console.error(`[NCM IA][${requestId}] Erro interno:`, error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

function getDeterministicNcmFallback(normalizedDesc: string) {
  // Bateria automotiva
  if (/(^|\s)bateria(\s|$)/i.test(normalizedDesc) || /\bah\b/i.test(normalizedDesc)) {
    return {
      recommendation: null,
      confidence: 72,
      needs_review: true,
      reason: 'Fallback por palavra-chave para bateria automotiva.',
      options: [
        {
          code: '85071090',
          description: 'Acumuladores de chumbo para arranque de motores de pistão (outros).',
          confidence: 72
        }
      ]
    };
  }

  // Bomba d'água / bomba de água / bomba injetora de água (peça de motor)
  if (/bomba/.test(normalizedDesc) && /(agua|água)/.test(normalizedDesc)) {
    return {
      recommendation: null,
      confidence: 70,
      needs_review: true,
      reason: "Fallback por palavra-chave para bomba d'água automotiva.",
      options: [
        {
          code: '84133090',
          description: "Bombas para líquidos, próprias para motores de ignição por faísca ou compressão (outras).",
          confidence: 70
        }
      ]
    };
  }

  // Aditivo radiador / anticongelante
  if (/aditivo/.test(normalizedDesc) && /radiador/.test(normalizedDesc)) {
    return {
      recommendation: null,
      confidence: 74,
      needs_review: true,
      reason: 'Fallback por palavra-chave para aditivo de radiador.',
      options: [
        {
          code: '38200000',
          description: 'Preparações anticongelantes e líquidos preparados para descongelamento.',
          confidence: 74
        }
      ]
    };
  }

  return null;
}
