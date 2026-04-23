export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

const CHAT_LIMIT = 3;
const CHAT_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 horas

async function getAuthenticatedUser() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // noop
          }
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function getRateLimitCookieName(userId: string) {
  return `tutorial_chat_rl_${userId}`;
}

function parseRateState(raw?: string) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.count !== "number" || typeof parsed?.windowStart !== "number") return null;
    return parsed as { count: number; windowStart: number };
  } catch {
    return null;
  }
}

function computeRateStatus(state: { count: number; windowStart: number } | null) {
  const now = Date.now();
  if (!state || now - state.windowStart >= CHAT_WINDOW_MS) {
    const freshStart = now;
    return {
      count: 0,
      windowStart: freshStart,
      remaining: CHAT_LIMIT,
      resetAt: new Date(freshStart + CHAT_WINDOW_MS).toISOString(),
      blocked: false,
    };
  }

  const remaining = Math.max(0, CHAT_LIMIT - state.count);
  return {
    count: state.count,
    windowStart: state.windowStart,
    remaining,
    resetAt: new Date(state.windowStart + CHAT_WINDOW_MS).toISOString(),
    blocked: remaining <= 0,
  };
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const cookieStore = cookies();
  const raw = cookieStore.get(getRateLimitCookieName(user.id))?.value;
  const status = computeRateStatus(parseRateState(raw));

  return NextResponse.json({
    limit: CHAT_LIMIT,
    windowHours: 3,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const cookieStore = cookies();
  const cookieName = getRateLimitCookieName(user.id);
  const currentStatus = computeRateStatus(parseRateState(cookieStore.get(cookieName)?.value));
  if (currentStatus.blocked) {
    return NextResponse.json(
      {
        text: "Você atingiu o limite de 3 perguntas. Aguarde até a janela reiniciar.",
        limit: CHAT_LIMIT,
        windowHours: 3,
        remaining: 0,
        resetAt: currentStatus.resetAt,
      },
      { status: 429 }
    );
  }

  const apiKeys = [
    process.env.GEMINI_SECRET_KEY_1,
    process.env.GEMINI_SECRET_KEY_2,
    process.env.GEMINI_SECRET_KEY_3,
    process.env.GEMINI_SECRET_KEY_4,
    process.env.GEMINI_SECRET_KEY_5,
    process.env.AUTOELETRICA_IA_KEY,
  ].filter(Boolean) as string[];

  if (apiKeys.length === 0) {
    return NextResponse.json({ text: "Chave da IA não configurada." });
  }

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ text: "Pergunta vazia." });
  }

  const kbPath = path.join(process.cwd(), "public", "tutoriais", "knowledge-base.txt");
  const knowledgeBase = fs.existsSync(kbPath)
    ? fs.readFileSync(kbPath, "utf-8")
    : "(base de conhecimento não encontrada)";

  const tutoriais = `
TUTORIAIS DISPONÍVEIS (links clicáveis):
- Abrir uma OS ou Venda → /tutoriais/tutorial-abrir-os.html
- Estoque e Serviços (peças e mão de obra) → /tutoriais/tutorial-estoque.html
- Importação de XML (nota fiscal do fornecedor) → /tutoriais/tutorial-importacao-xml.html
- Clientes (cadastro, ficha, extrato) → /tutoriais/tutorial-clientes.html
- Portal do Cliente (rastreamento de OS) → /tutoriais/tutorial-portal-cliente.html
- Extrato do Cliente (link enviado ao cliente) → /tutoriais/tutorial-extrato-cliente.html
- Extrato Financeiro (caixa, entradas e despesas) → /tutoriais/tutorial-extrato-financeiro.html
- Notas Fiscais (NFC-e, NFS-e, homologação, notas avulsas) → /tutoriais/tutorial-notas-fiscais.html
- Agendamento (criar, enviar link, alertas, confirmar presença) → /tutoriais/tutorial-agendamento.html
- Configurações (Dados da Oficina, Opções de Uso e Gestão de Equipe) → /tutoriais/tutorial-opcoes-uso.html
`;

  const prompt = `Você é um assistente de suporte do sistema de gestão de uma autoelétrica/oficina mecânica.
Responda APENAS com base nas instruções abaixo. Se a resposta não estiver nas instruções, diga educadamente que não sabe e sugira consultar o gerente.

REGRAS DE RESPOSTA:
- Use linguagem simples e direta, como se estivesse explicando pessoalmente para alguém que não é familiarizado com tecnologia.
- Quando a resposta envolver clicar ou tocar em algo, oriente onde encontrar visualmente na tela. Exemplos: "role a tela para baixo até ver o botão", "procure no topo da OS", "o botão fica logo abaixo dos itens".
- Considere que o usuário pode estar usando o celular e talvez precise rolar a tela para encontrar o que precisa.
- Se a ação tiver mais de um passo, numere os passos.
- Nunca assuma que o usuário sabe onde fica algo — sempre dê uma dica de localização.
- Responda em português.

REGRA ESPECIAL — PERGUNTAS AMPLAS:
Quando o usuário fizer uma pergunta ampla ou geral sobre uma funcionalidade inteira do sistema (exemplos: "como funciona o portal do cliente?", "me explique a tela de atendimento", "o que posso fazer no estoque?", "como funciona o extrato financeiro?"), NÃO escreva uma explicação longa. Em vez disso, indique o tutorial correspondente com uma resposta curta e amigável, usando o link no formato markdown [texto do link](url). Exemplo: "Temos um tutorial completo sobre isso! Acesse: [Portal do Cliente](/tutoriais/tutorial-portal-cliente.html)".
Considere uma pergunta "ampla" quando ela pedir uma visão geral de uma tela ou funcionalidade inteira, e não um detalhe específico ou um passo pontual.
Quando a pergunta for específica (ex: "como cancelo uma OS?", "onde fica o botão de aprovar?"), responda normalmente com as instruções detalhadas.

${tutoriais}

BASE DE CONHECIMENTO DO SISTEMA:
${knowledgeBase}

PERGUNTA DO USUÁRIO: ${message}`;

  const model = "gemini-2.5-flash";
  let lastError = null;

  for (const key of apiKeys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      });

      if (!response.ok) {
        lastError = await response.text();
        continue;
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const finishReason = candidate?.finishReason;
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text || finishReason === "MAX_TOKENS" || finishReason === "RECITATION") {
        lastError = `finishReason: ${finishReason}`;
        continue;
      }

      const nextCount = currentStatus.count + 1;
      const nextRemaining = Math.max(0, CHAT_LIMIT - nextCount);
      const responseJson = NextResponse.json({
        text,
        limit: CHAT_LIMIT,
        windowHours: 3,
        remaining: nextRemaining,
        resetAt: currentStatus.resetAt,
      });

      responseJson.cookies.set(
        cookieName,
        JSON.stringify({ count: nextCount, windowStart: currentStatus.windowStart }),
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
          expires: new Date(currentStatus.resetAt),
        }
      );

      return responseJson;
    } catch (e) {
      lastError = e;
    }
  }

  console.error("[tutorial-chat] Todas as chaves falharam:", lastError);
  return NextResponse.json({
    text: "A IA está indisponível no momento. Tente novamente.",
    limit: CHAT_LIMIT,
    windowHours: 3,
    remaining: currentStatus.remaining,
    resetAt: currentStatus.resetAt,
  });
}
