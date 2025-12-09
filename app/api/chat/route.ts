import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  // ⚠️ LEMBRETE: Se seu .env ainda não estiver lendo, cole a chave aqui:
  // const apiKey = "AIzaSyDqZx8...";
  // ⚠️ SUA CHAVE AQUI (Lembre de trocar quando arrumar o .env)
 const apiKey ="AIzaSyBzsYcRvblYb9a_PjT5ICvs1-sU3NcR_Nk" 
  const model = 'gemini-2.5-flash'; 
  if (!apiKey) {
    return NextResponse.json({ text: "Erro: Chave API não configurada." });
  }

  try {
    // AGORA RECEBEMOS O 'historyCount' TAMBÉM
    const { message, historyCount } = await req.json();

    // LÓGICA DE LIMITE DE DICAS 💡
    // Se o histórico for menor que 2 mensagens anteriores (ou seja, está no começo), mostra dicas.
    // Se não vier nada (undefined), assumimos 0 e mostramos.
    const contador = historyCount || 0;
    const mostrarDicas = contador < 2; 

    // 1. FINANCEIRO (Econômico: Últimos 30)
    const { data: transacoes } = await supabase
      .from('transactions')
      .select('description, amount, type, status, date')
      .order('date', { ascending: false })
      .limit(30);

    const receita = transacoes?.filter(t => t.type === 'income' && t.status === 'paid').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const despesa = transacoes?.filter(t => t.type === 'expense' && t.status === 'paid').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const aPagar = transacoes?.filter(t => t.type === 'expense' && t.status === 'pending').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const saldo = receita - despesa;

    const textoFinanceiro = transacoes?.map(t => {
      const status = t.status === 'paid' ? '✅' : '⚠️';
      const data = new Date(t.date).toLocaleDateString('pt-BR');
      return `- ${data} | ${t.type === 'income' ? '+' : '-'} R$ ${t.amount} | ${t.description} (${status})`;
    }).join('\n');

    // 2. ESTOQUE
    const { data: produtos } = await supabase
      .from('products')
      .select('nome, marca, estoque_atual, localizacao');

    const textoEstoque = produtos?.map(p => 
      `- ${p.nome} (${p.marca}) | Qtd: ${p.estoque_atual} | Local: ${p.localizacao}`
    ).join('\n');

    // 3. SERVIÇOS
    const { data: historico } = await supabase
      .from('work_orders')
      .select('created_at, status, description, clients(nome), vehicles(modelo)')
      .order('created_at', { ascending: false })
      .limit(30);

    const textoHistorico = historico?.map(os => {
      const data = new Date(os.created_at).toLocaleDateString('pt-BR');
      // @ts-ignore
      const cliente = os.clients?.nome || "Cli";
      // @ts-ignore
      const carro = os.vehicles?.modelo || "Auto";
      return `- ${data}: ${cliente} (${carro}) - ${os.description} [${os.status}]`;
    }).join('\n');

    // 4. MONTANDO A REGRA DE DICAS DINAMICAMENTE
    let regrasDica = "";
    if (mostrarDicas) {
      regrasDica = `
      3. IMPORTANTE - SUGESTÃO DE CONTINUIDADE (Gatilho Mental):
         - Como estamos no início da conversa, sugira o que o usuário deve digitar a seguir.
         - Exemplo: "💡 Dica: Você pode perguntar 'Quais contas vencem hoje?'"
         - Exemplo: "💡 Dica: Pergunte 'Onde está a peça X' para localizar."
      `;
    } else {
      regrasDica = `
      3. NÃO DÊ MAIS DICAS DE PERGUNTA. O usuário já sabe usar o sistema. Apenas responda e encerre.
      `;
    }

    const context = `
      ATUE COMO: Secretária Executiva da 'NHT Centro Automotivo'.
      
      DADOS:
      - Saldo Caixa: R$ ${saldo.toFixed(2)}
      - A Pagar (Pendente): R$ ${aPagar.toFixed(2)}
      
      MOVIMENTAÇÕES RECENTES:
      ${textoFinanceiro}

      ESTOQUE:
      ${textoEstoque}

      SERVIÇOS RECENTES:
      ${textoHistorico}

      REGRAS DE RESPOSTA (RIGOROSAS):
      1. RESPONDA APENAS O QUE FOI PERGUNTADO. Seja breve.
      2. Use listas com tópicos se houver mais de um item.
      ${regrasDica}

      PERGUNTA DO USUÁRIO: "${message}"
    `;

    // 5. ENVIO
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] })
    });

    if (!response.ok) {
       const err = await response.text();
       return NextResponse.json({ text: `Erro IA: ${err}` });
    }
    
    const data = await response.json();
    return NextResponse.json({ text: data?.candidates?.[0]?.content?.parts?.[0]?.text });

  } catch (error: any) {
    console.error("Erro:", error);
    return NextResponse.json({ text: "Erro interno." });
  }
}