"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Send, Sparkles, Bot, User, Mic, 
  ArrowRight, BarChart3, PackageSearch 
} from "lucide-react";

export default function AssistenteIA() {
  // Estado das mensagens
  const [messages, setMessages] = useState([
    { role: "ai", text: "Olá! Sou a IA da AutoPro. Posso analisar seu estoque, financeiro ou status de serviços. Como posso ajudar hoje?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Referência para rolar o chat para o final
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Função Fake de Resposta
  const handleSend = async (texto: string) => {
    if (!texto.trim()) return;

    // 1. Adiciona mensagem do usuário
    const userMsg = { role: "user", text: texto };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // 2. Simula "Pensando..."
    setTimeout(() => {
      let respostaIA = "Desculpe, não entendi. Pode reformular?";
      
      // Lógica Fake Simples
      const t = texto.toLowerCase();
      if (t.includes("faturamento") || t.includes("vendeu")) {
        respostaIA = "Hoje o faturamento está em **R$ 2.450,00**. Isso é 15% acima da média das últimas segundas-feiras. Parabéns!";
      } else if (t.includes("estoque") || t.includes("falta")) {
        respostaIA = "Encontrei **3 itens com estoque crítico**: \n\n1. Lâmpada H4 (0 un)\n2. Óleo 5W30 (2 un)\n3. Fusível 10A (5 un)\n\nDeseja gerar um pedido de compra agora?";
      } else if (t.includes("joão") || t.includes("cliente")) {
        respostaIA = "O cliente **João da Silva** tem o **Gol G5 (ABC-1234)** na oficina. O status atual é: **Aguardando Peça**. A previsão de entrega é amanhã às 14h.";
      }

      setMessages((prev) => [...prev, { role: "ai", text: respostaIA }]);
      setLoading(false);
    }, 1500);
  };

  const sugestoes = [
    { icon: BarChart3, text: "Quanto faturei hoje?" },
    { icon: PackageSearch, text: "O que preciso comprar?" },
    { icon: User, text: "Status do João da Silva" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-40px)] gap-4">
      
      {/* 1. CABEÇALHO */}
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] flex items-center gap-2">
          <Sparkles className="text-[#FACC15]" fill="#FACC15" /> Assistente IA
        </h1>
        <p className="text-stone-500 text-sm mt-1">Pergunte sobre sua oficina em linguagem natural.</p>
      </div>

      {/* 2. ÁREA DE CHAT (Scrollável) */}
      <div className="flex-1 bg-white rounded-[32px] p-4 md:p-6 shadow-sm border border-stone-100 overflow-y-auto relative">
        
        {/* Fundo Decorativo */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Bot size={200} />
        </div>

        <div className="space-y-6 relative z-10 pb-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#1A1A1A] text-white' : 'bg-[#FACC15] text-[#1A1A1A]'}`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={20} />}
              </div>

              {/* Balão */}
              <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-[#1A1A1A] text-white rounded-tr-sm' 
                  : 'bg-[#F8F7F2] text-[#1A1A1A] border border-stone-100 rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FACC15] flex items-center justify-center shrink-0"><Bot size={20} /></div>
              <div className="bg-[#F8F7F2] p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. ÁREA DE INPUT E SUGESTÕES */}
      <div className="space-y-4">
        
        {/* Sugestões Rápidas (Só aparecem se o chat estiver curto) */}
        {messages.length < 3 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {sugestoes.map((s, i) => (
              <button 
                key={i}
                onClick={() => handleSend(s.text)}
                className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-stone-100 text-xs font-bold text-stone-600 hover:bg-[#FACC15] hover:text-[#1A1A1A] hover:border-[#FACC15] transition whitespace-nowrap shadow-sm"
              >
                <s.icon size={14} /> {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="bg-white p-2 rounded-[24px] shadow-lg border border-stone-100 flex items-center gap-2">
          <button className="p-3 text-stone-400 hover:bg-stone-50 rounded-full transition">
            <Mic size={20} />
          </button>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Digite sua pergunta..." 
            className="flex-1 bg-transparent outline-none text-[#1A1A1A] placeholder:text-stone-400 font-medium"
          />
          
          <button 
            onClick={() => handleSend(input)}
            disabled={!input.trim() || loading}
            className="p-3 bg-[#1A1A1A] text-[#FACC15] rounded-xl hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <div className="w-5 h-5 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin"></div> : <ArrowRight size={20} />}
          </button>
        </div>
      </div>

    </div>
  );
}