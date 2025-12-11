import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- AJUSTE DE PERMISSÃO ---
// Usamos a SERVICE_ROLE_KEY para que a IA tenha acesso total aos dados (Admin),
// ignorando as travas de segurança (RLS) que escondiam os clientes.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' 
);

export async function POST(req: Request) {
  // --- LOG DE INÍCIO ---
  console.log("🤖 [IA] Iniciando requisição...");

  const apiKey = process.env.AUTOELETRICA_IA_KEY; 
  const model = 'gemini-2.5-flash'; // Mantido seu modelo exclusivo

  // --- LOG DE CONFIGURAÇÃO ---
  console.log(`🔑 [IA] Chave API definida? ${apiKey ? 'SIM' : 'NÃO'}`);
  console.log(`🧠 [IA] Modelo selecionado: ${model}`);

  if (!apiKey) {
    console.error("❌ [IA] ERRO CRÍTICO: Chave não encontrada no .env.local");
    return NextResponse.json({ 
      text: "Erro de Configuração: A chave da API não foi encontrada." 
    });
  }

  try {
    const { message, historyCount } = await req.json();
    console.log(`💬 [IA] Pergunta do usuário: "${message}"`);

    const contador = historyCount || 0;
    const mostrarDicas = contador < 2; 

    // 1. FINANCEIRO (Resumo)
    const { data: transacoes } = await supabase
      .from('transactions')
      .select('description, amount, type, status, date')
      .order('date', { ascending: false })
      .limit(20);

    const receita = transacoes?.filter(t => t.type === 'income' && t.status === 'paid').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const despesa = transacoes?.filter(t => t.type === 'expense' && t.status === 'paid').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const aPagar = transacoes?.filter(t => t.type === 'expense' && t.status === 'pending').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const aReceber = transacoes?.filter(t => t.type === 'income' && t.status === 'pending').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
    const saldo = receita - despesa;

    // 2. CLIENTES E ÚLTIMA VISITA (Permissão Admin agora)
    const { data: clientesData } = await supabase
      .from('clients')
      .select(`
        nome, 
        whatsapp,
        work_orders ( created_at )
      `)
      .order('nome', { ascending: true }) // Ordenar ajuda a manter a lista consistente
      .limit(100); // Aumentado para cobrir mais clientes

    const textoClientes = clientesData?.map(c => {
      // @ts-ignore
      const datas = c.work_orders?.map((os: any) => new Date(os.created_at).getTime()) || [];
      let ultimaVisita = "Nunca";
      
      if (datas.length > 0) {
        const maxData = Math.max(...datas);
        ultimaVisita = new Date(maxData).toLocaleDateString('pt-BR');
      }

      return `- ${c.nome} | Zap: ${c.whatsapp || "Sem nº"} | Última vez na oficina: ${ultimaVisita}`;
    }).join('\n');

    // 3. ESTOQUE
    const { data: produtos } = await supabase
      .from('products')
      .select('nome, marca, estoque_atual, localizacao')
      .limit(30);

    const textoEstoque = produtos?.map(p => 
      `- ${p.nome} (${p.marca}) | Qtd: ${p.estoque_atual} | Local: ${p.localizacao}`
    ).join('\n');

    // 4. SERVIÇOS RECENTES
    const { data: historico } = await supabase
      .from('work_orders')
      .select('created_at, status, description, clients(nome), vehicles(modelo)')
      .order('created_at', { ascending: false })
      .limit(15);

    const textoHistorico = historico?.map(os => {
      const data = new Date(os.created_at).toLocaleDateString('pt-BR');
      // @ts-ignore
      const cliente = os.clients?.nome || "Cli";
      // @ts-ignore
      const carro = os.vehicles?.modelo || "Auto";
      return `- ${data}: ${cliente} (${carro}) - ${os.description} [${os.status}]`;
    }).join('\n');

    // CONTEXTO INTELIGENTE
    const dataHoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    let regrasDica = mostrarDicas 
      ? `3. DICA RÁPIDA: Sugira uma ação útil baseada na pergunta.` 
      : `3. SEJA DIRETA: O usuário já conhece o sistema.`;

    const context = `
      ATUE COMO: Secretária Executiva da 'NHT Centro Automotivo'.
      HOJE É: ${dataHoje}
      
      DADOS FINANCEIROS:
      - Saldo Real (Caixa): R$ ${saldo.toFixed(2)}
      - A Pagar (Futuro): R$ ${aPagar.toFixed(2)}
      - A Receber (Futuro): R$ ${aReceber.toFixed(2)}

      BASE DE CLIENTES (CONSULTE AQUI PARA SABER QUEM É):
      ${textoClientes}

      ESTOQUE:
      ${textoEstoque}

      HISTÓRICO RECENTE DE SERVIÇOS:
      ${textoHistorico}

      REGRAS:
      1. Se perguntarem de um cliente, procure por aproximação no nome (ex: "Raquel" pode ser "Raquel Cardoso").
      2. Se perguntarem "quando veio", use a data de "Última vez na oficina" que está na lista de clientes.
      ${regrasDica}

      PERGUNTA DO USUÁRIO: "${message}"
    `;

    console.log("📤 [IA] Enviando contexto para o Google...");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: context }] }] })
    });

    console.log(`📡 [IA] Status da resposta Google: ${response.status} (${response.statusText})`);

    if (!response.ok) {
       const errTexto = await response.text();
       console.error("❌ [IA] ERRO NO CORPO DA RESPOSTA GOOGLE:", errTexto);
       return NextResponse.json({ text: `A IA está indisponível no momento.` });
    }
    
    const data = await response.json();
    const respostaFinal = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log("✅ [IA] Resposta gerada com sucesso!");
    return NextResponse.json({ text: respostaFinal });

  } catch (error: any) {
    console.error("❌ [IA] ERRO DE EXCEÇÃO (CATCH):", error);
    return NextResponse.json({ text: "Erro interno no servidor." });
  }
}