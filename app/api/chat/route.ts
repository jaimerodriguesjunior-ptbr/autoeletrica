import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  // Lê a chave correta do .env.local
  const apiKey = process.env.AUTOELETRICA_IA_KEY; 
  const model = 'gemini-2.5-flash';

  if (!apiKey) {
    return NextResponse.json({ 
      text: "Erro de Configuração: A chave da API (AUTOELETRICA_IA_KEY) não foi encontrada." 
    });
  }

  try {
    const { message, historyCount } = await req.json();

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
      
      // CORREÇÃO DE DATA: Evita o new Date() que muda o fuso horário.
      // O banco retorna YYYY-MM-DD (ex: 2025-12-09). Vamos apenas inverter a string.
      let dataFormatada = t.date;
      if (t.date && t.date.includes('-')) {
        const partes = t.date.split('-'); // [2025, 12, 09]
        dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`; // 09/12/2025
      }

      return `- ${dataFormatada} | ${t.type === 'income' ? '+' : '-'} R$ ${t.amount} | ${t.description} (${status})`;
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
      3. NÃO DÊ MAIS DICAS DE PERGUNTA.
      O usuário já sabe usar o sistema. Apenas responda e encerre.
      `;
    }

    // CORREÇÃO: Pegamos a data atual do servidor (Brasil) para orientar a IA
    const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const context = `
      ATUE COMO: Secretária Executiva da 'NHT Centro Automotivo'.
      HOJE É: ${dataHoje}
      
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
       console.error("Erro API Google:", err);
       return NextResponse.json({ text: `Erro na comunicação com a IA.` });
    }
    
    const data = await response.json();
    return NextResponse.json({ text: data?.candidates?.[0]?.content?.parts?.[0]?.text });

  } catch (error: any) {
    console.error("Erro Geral:", error);
    return NextResponse.json({ text: "Erro interno no servidor." });
  }
}