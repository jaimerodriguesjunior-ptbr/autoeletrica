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

type GeminiUsageMetadata = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
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
        achados.push({
            categoria: "confirmar_contador",
            severidade: "atencao",
            titulo: "Resposta da IA incompleta",
            detalhe: "A IA nao trouxe conflitos objetivos com campos concretos.",
            sugestao: "Refazer a auditoria. Sem diagnostico claro, nao use este parecer para decidir emissao.",
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

function containsAny(text: string, needles: string[]) {
    const value = String(text || "").toLowerCase();
    return needles.some((needle) => value.includes(needle));
}

function isVagueAuditResponse(result: FiscalAuditResponse) {
    const status = String(result.status || "");
    if (status === "parece_correta") return false;

    const achados = result.achados || [];
    if (achados.length === 0) return true;

    const fieldHints = ["cfop", "natureza", "csosn", "cst", "crt", "observ", "modfrete", "pis", "cofins", "ipi", "finalidade", "tpnf"];
    const vagueHints = ["possivel", "pode estar", "requer atencao", "ponto para revisar", "validar com contador", "ajustar conforme"];

    let concreteMentions = 0;
    for (const item of achados) {
        const pack = `${item.titulo || ""} ${item.detalhe || ""} ${item.sugestao || ""}`;
        if (containsAny(pack, fieldHints)) concreteMentions += 1;
    }

    const resumo = String(result.resumo || "");
    const fullText = `${resumo} ${achados.map((a) => `${a.titulo || ""} ${a.detalhe || ""} ${a.sugestao || ""}`).join(" ")}`;
    const isMostlyVague = containsAny(fullText, vagueHints) && concreteMentions === 0;

    return concreteMentions === 0 || isMostlyVague;
}

function isCnaeNoiseText(text: string) {
    const value = String(text || "").toLowerCase();
    return (
        value.includes("cnae")
        || value.includes("objeto social")
        || value.includes("atividade da empresa")
        || value.includes("enquadramento societario")
        || value.includes("atividade secundaria")
        || value.includes("atividade secundária")
    );
}

function stripCnaeNoise(result: FiscalAuditResponse): FiscalAuditResponse {
    const achados = (result.achados || []).filter((item) => {
        const packed = `${item?.titulo || ""} ${item?.detalhe || ""} ${item?.sugestao || ""}`;
        return !isCnaeNoiseText(packed);
    });

    const perguntas = (result.perguntas_contador || []).filter((q) => !isCnaeNoiseText(q));
    const resumo = isCnaeNoiseText(result.resumo || "") ? "Rascunho sem inconsistências objetivas de preenchimento." : result.resumo;
    const conclusao = isCnaeNoiseText(result.conclusao || "") ? "Sem conflitos objetivos de preenchimento detectados." : result.conclusao;

    const sanitized: FiscalAuditResponse = {
        ...result,
        resumo,
        achados,
        perguntas_contador: perguntas,
        conclusao,
    };

    if ((sanitized.achados || []).length === 0 && (sanitized.status === "atencao" || sanitized.status === "inconsistente")) {
        sanitized.status = "parece_correta";
    }

    return sanitized;
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

    const basePrompt = `
Voce e uma IA de auditoria fiscal para rascunhos de NF-e no Brasil.
Seu papel e agir como assistente de revisao para o contador, nao como autoridade fiscal.

ESCOPO OBRIGATORIO:
- Analise APENAS consistencia de preenchimento da NF-e (coerencia entre campos da nota).
- Assuma que a empresa esta habilitada para emitir nota.
- Nao trate CNAE, objeto social, permissao de atividade ou enquadramento societario como bloqueio de emissao.
- Se citar CNAE, use no maximo como observacao secundaria e NUNCA como principal motivo de "atencao" ou "inconsistente".

PASSO OBRIGATORIO INICIAL (antes de qualquer analise):
1) Ler campos_tecnicos.company_fiscal_context e identificar o enquadramento da empresa:
   - regime_tributario
   - crt
   - cnae
   - inscricao_estadual
   - inscricao_municipal
2) Usar esse enquadramento como base para TODAS as validacoes seguintes.
3) Se faltar algum dado essencial de enquadramento, registrar isso explicitamente em achados/perguntas_contador
   antes de concluir sobre os demais pontos.

Analise a coerencia semantica e fiscal do rascunho abaixo.
Procure especialmente:
- natureza da operacao versus CFOP dos itens;
- entrada/saida versus finalidade;
- pagamento versus operacao com/sem cobranca;
- observacoes complementares coerentes com remessa, retorno, demonstracao, doacao etc.;
- origem/CSOSN, IPI, PIS e COFINS preenchidos de forma aparentemente incoerente;
- campos que deveriam ser confirmados com contador.
- validar CSOSN/CST usando o contexto fiscal da empresa em campos_tecnicos.company_fiscal_context
  (regime_tributario, crt, cnae, inscricao_estadual, inscricao_municipal).

Regra obrigatoria para CSOSN/CST:
- quando houver risco em CSOSN/CST, descreva no "detalhe" qual campo esta conflitando
  (ex.: "CRT=1 com CST 00", "CRT=3 com CSOSN 102") e cite ao menos 1 alternativa objetiva na "sugestao".

Regra geral obrigatoria de coerencia:
- Nao use frases vagas como "possivel inconsistencia" sem apontar qual combinacao de campos gerou o alerta.
- Sempre cite os campos concretos que motivaram cada achado (ex.: natureza, cfop, crt, csosn, observacoes, modfrete).

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
    let parsedResponse: FiscalAuditResponse | null = null;

    const prompts = [
        basePrompt,
        `${basePrompt}

CORRECAO OBRIGATORIA DE QUALIDADE:
- Sua resposta anterior ficou generica.
- Reescreva com conflito objetivo e campo concreto em cada achado.
- Se nao houver conflito, use status "parece_correta" e explique em 1 frase objetiva.
`,
    ];

    for (let promptIndex = 0; promptIndex < prompts.length; promptIndex++) {
        const prompt = prompts[promptIndex];
        for (let index = 0; index < apiKeys.length; index++) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys[index]}`;
            const attemptLabel = `[NFe IA] tentativa=${promptIndex + 1}.${index + 1} model=${model}`;

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
                    const errText = await response.text();
                    console.warn(`${attemptLabel} falhou status=${response.status} body=${errText.slice(0, 300)}`);
                    lastError = new Error(errText);
                    continue;
                }

                const data = await response.json();
                const usage = (data?.usageMetadata || {}) as GeminiUsageMetadata;
                console.log(
                    `${attemptLabel} ok tokens_in=${usage.promptTokenCount ?? "?"} tokens_out=${usage.candidatesTokenCount ?? "?"} tokens_total=${usage.totalTokenCount ?? "?"}`
                );
                textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
                if (!textResponse) continue;

                try {
                    const cleanText = textResponse.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
                    const parsedRaw = JSON.parse(cleanText) as FiscalAuditResponse;
                    const parsed = stripCnaeNoise(parsedRaw);
                    if (isVagueAuditResponse(parsed)) {
                        parsedResponse = parsed;
                        continue;
                    }
                    parsedResponse = parsed;
                    break;
                } catch {
                    continue;
                }
            } catch (error) {
                lastError = error;
            }
        }
        if (parsedResponse && !isVagueAuditResponse(parsedResponse)) break;
    }

    if (!textResponse && !parsedResponse) {
        console.error("[NFe IA] Falha na auditoria fiscal assistida:", lastError);
        return {
            success: false,
            error: "Nao foi possivel auditar o rascunho com IA.",
        };
    }

    if (parsedResponse && isVagueAuditResponse(parsedResponse)) {
        return {
            success: true,
            text: [
                "Status: Atenção.",
                "Resumo: A IA não conseguiu gerar um diagnóstico fiscal objetivo com este rascunho.",
                "Revisar: Refazer auditoria após revisar dados fiscais e conferir com o contador.",
                "Opções de ajuste:",
                "- Refaça a auditoria após validar enquadramento da empresa e tributação dos itens.",
            ].join("\n"),
            audit: {
                status: "atencao",
                resumo: "A IA nao conseguiu gerar diagnostico objetivo para este rascunho.",
                inconsistencias: [],
                confirmar_contador: [],
                observacoes: [],
                perguntas_contador: [],
                conclusao: "Sem diagnostico objetivo. Revise com contador antes de emitir.",
                aviso: "Auditoria por IA nao substitui revisao do contador.",
            },
            raw: parsedResponse,
        };
    }

    try {
        const parsed = parsedResponse
            || stripCnaeNoise(JSON.parse(textResponse!.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim()) as FiscalAuditResponse);
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
