"use server";

type FiscalAuditPayload = {
    ambiente: string;
    operacao: string;
    natureza: string;
    tipo_nfe: string;
    finalidade_nfe: string;
    classificacao_destino: string;
    participante: Record<string, unknown>;
    itens: Array<Record<string, unknown>>;
    transporte: Record<string, unknown>;
    campos_tecnicos: Record<string, unknown>;
    observacoes: Record<string, unknown>;
    total: number;
};

type FiscalAuditFinding = {
    categoria?: "inconsistencia" | "confirmar_contador" | "observacao";
    severidade?: "ok" | "atencao" | "inconsistente";
    titulo?: string;
    detalhe?: string;
    sugestao?: string;
};

type FiscalAuditResponse = {
    status?: "parece_correta" | "atencao" | "inconsistente";
    resumo?: string;
    achados?: FiscalAuditFinding[];
    perguntas_contador?: string[];
    conclusao?: string;
};

export type FiscalAuditUiResult = {
    status: "parece_correta" | "atencao" | "inconsistente";
    resumo: string;
    inconsistencias: FiscalAuditFinding[];
    confirmar_contador: FiscalAuditFinding[];
    observacoes: FiscalAuditFinding[];
    perguntas_contador: string[];
    conclusao: string;
    aviso: string;
};

function getGeminiKeys() {
    return [
        process.env.GEMINI_SECRET_KEY_1,
        process.env.GEMINI_SECRET_KEY_2,
        process.env.GEMINI_SECRET_KEY_3,
        process.env.GEMINI_SECRET_KEY_4,
        process.env.GEMINI_SECRET_KEY_5,
        process.env.AUTOELETRICA_IA_KEY,
    ].filter(Boolean) as string[];
}

function normalizeAuditResult(result: FiscalAuditResponse): FiscalAuditUiResult {
    const achados = result.achados || [];
    return {
        status: result.status || "atencao",
        resumo: result.resumo || "Auditoria concluida com pontos para revisao.",
        inconsistencias: achados.filter((item) => item.categoria === "inconsistencia" || item.severidade === "inconsistente"),
        confirmar_contador: achados.filter((item) => item.categoria === "confirmar_contador" || (item.severidade === "atencao" && item.categoria !== "observacao")),
        observacoes: achados.filter((item) => item.categoria === "observacao" || item.severidade === "ok"),
        perguntas_contador: result.perguntas_contador || [],
        conclusao: result.conclusao || "Revise os pontos acima antes de transformar este rascunho em emissao real.",
        aviso: "Auditoria por IA nao substitui revisao do contador.",
    };
}

function formatAuditText(result: FiscalAuditResponse) {
    const normalized = normalizeAuditResult(result);
    const statusLabel: Record<string, string> = {
        parece_correta: "Parece coerente",
        atencao: "Requer atencao",
        inconsistente: "Inconsistente",
    };

    const lines = [
        `Status: ${statusLabel[normalized.status] || "Requer atencao"}`,
        normalized.resumo ? `Resumo: ${normalized.resumo}` : "",
    ].filter(Boolean);

    const allFindings = [...normalized.inconsistencias, ...normalized.confirmar_contador, ...normalized.observacoes];
    if (allFindings.length) {
        lines.push("", "Pontos para revisar:");
        allFindings.forEach((item, index) => {
            lines.push(`${index + 1}. [${item.severidade || "atencao"}] ${item.titulo || "Ponto de atencao"}`);
            if (item.detalhe) lines.push(`   ${item.detalhe}`);
            if (item.sugestao) lines.push(`   Sugestao: ${item.sugestao}`);
        });
    }

    if (normalized.perguntas_contador.length) {
        lines.push("", "Perguntas para o contador:");
        normalized.perguntas_contador.forEach((question) => lines.push(`- ${question}`));
    }

    lines.push("", `Conclusao: ${normalized.conclusao}`);

    lines.push("", `Aviso: ${normalized.aviso}`);
    return lines.join("\n");
}

function extractJsonStringField(text: string, field: string) {
    const match = text.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`));
    return match?.[1] || "";
}

function recoverAuditTextFromPartialJson(text: string) {
    const status = extractJsonStringField(text, "status") || "atencao";
    const resumo = extractJsonStringField(text, "resumo");
    const achados: FiscalAuditFinding[] = [];

    const objectMatches = text.match(/\{[^{}]*"severidade"[^{}]*\}/g) || [];
    for (const block of objectMatches.slice(0, 6)) {
        achados.push({
            severidade: extractJsonStringField(block, "severidade") as FiscalAuditFinding["severidade"],
            titulo: extractJsonStringField(block, "titulo") || "Ponto de atencao",
            detalhe: extractJsonStringField(block, "detalhe"),
            sugestao: extractJsonStringField(block, "sugestao"),
        });
    }

    if (achados.length === 0) {
        const isInconsistent = status === "inconsistente";
        achados.push({
            categoria: isInconsistent ? "inconsistencia" : "confirmar_contador",
            severidade: isInconsistent ? "inconsistente" : "atencao",
            titulo: isInconsistent ? "Possivel conflito fiscal no rascunho" : "Ponto para revisar com contador",
            detalhe: resumo || "A IA encontrou pontos de atencao, mas retornou detalhes incompletos.",
            sugestao: "Revise natureza da operacao, CFOP, pagamento e observacoes antes de emitir.",
        });
    }

    const recovered = {
        status: status as FiscalAuditResponse["status"],
        resumo: resumo || "A auditoria encontrou pontos de atencao, mas a resposta veio parcial.",
        achados,
        conclusao: "Revise os pontos acima antes de transformar este rascunho em emissao real.",
    };

    return {
        text: formatAuditText(recovered),
        audit: normalizeAuditResult(recovered),
    };
}

export async function auditarNFeAssistidaComIaAction(payload: FiscalAuditPayload) {
    const model = "gemini-2.5-flash";
    const apiKeys = getGeminiKeys();

    if (apiKeys.length === 0) {
        return {
            success: false,
            error: "Nenhuma chave de IA configurada.",
        };
    }

    const prompt = `
Voce e uma IA de auditoria fiscal para rascunhos de NF-e no Brasil.
Seu papel e agir como assistente de revisao para o contador, nao como autoridade fiscal.

Analise a coerencia semantica e fiscal do rascunho abaixo.
Procure especialmente:
- natureza da operacao versus CFOP dos itens;
- entrada/saida versus finalidade;
- pagamento versus operacao com/sem cobranca;
- observacoes complementares coerentes com remessa, retorno, demonstracao, doacao etc.;
- origem/CSOSN, IPI, PIS e COFINS preenchidos de forma aparentemente incoerente;
- campos que deveriam ser confirmados com contador.

Nao bloqueie por incerteza. Aponte riscos e perguntas.
Se a nota parecer coerente para a finalidade declarada, diga: "Se a intencao for X, o rascunho parece coerente, mas confirme com o contador."

Retorne APENAS JSON valido, sem markdown, no formato:
{
  "status": "parece_correta" | "atencao" | "inconsistente",
  "resumo": "texto curto",
  "achados": [
    {"categoria":"inconsistencia|confirmar_contador|observacao","severidade":"ok|atencao|inconsistente","titulo":"curto","detalhe":"explicacao curta","sugestao":"acao sugerida curta"}
  ],
  "perguntas_contador": ["pergunta objetiva"],
  "conclusao": "texto final curto"
}

Seja muito conciso:
- no maximo 2 inconsistencias;
- no maximo 3 pontos para confirmar com contador;
- no maximo 3 perguntas;
- detalhe e sugestao com ate 140 caracteres cada.

Rascunho:
${JSON.stringify(payload, null, 2)}
`;

    let lastError: unknown = null;
    let textResponse: string | null = null;

    for (let index = 0; index < apiKeys.length; index++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys[index]}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 2600,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                status: { type: "STRING" },
                                resumo: { type: "STRING" },
                                achados: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            categoria: { type: "STRING" },
                                            severidade: { type: "STRING" },
                                            titulo: { type: "STRING" },
                                            detalhe: { type: "STRING" },
                                            sugestao: { type: "STRING" },
                                        },
                                        required: ["categoria", "severidade", "titulo", "detalhe", "sugestao"],
                                    },
                                },
                                perguntas_contador: {
                                    type: "ARRAY",
                                    items: { type: "STRING" },
                                },
                                conclusao: { type: "STRING" },
                            },
                            required: ["status", "resumo", "achados", "perguntas_contador", "conclusao"],
                        },
                    },
                }),
            });

            if (!response.ok) {
                lastError = new Error(await response.text());
                continue;
            }

            const data = await response.json();
            textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (textResponse) break;
        } catch (error) {
            lastError = error;
        }
    }

    if (!textResponse) {
        console.error("[NFe IA] Falha na auditoria fiscal assistida:", lastError);
        return {
            success: false,
            error: "Nao foi possivel auditar o rascunho com IA.",
        };
    }

    try {
        const cleanText = textResponse.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleanText) as FiscalAuditResponse;
        const normalized = normalizeAuditResult(parsed);
        return {
            success: true,
            text: formatAuditText(parsed),
            audit: normalized,
            raw: parsed,
        };
    } catch {
        const recovered = recoverAuditTextFromPartialJson(textResponse);
        return {
            success: true,
            text: recovered.text,
            audit: recovered.audit,
        };
    }
}
