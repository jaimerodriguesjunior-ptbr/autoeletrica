"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Send, Sparkles, Bot, User, Mic, 
  ArrowRight, BarChart3, PackageSearch 
} from "lucide-react";

export default function AssistenteIA() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Olá! Sou a Secretária da NHT. Posso ajudar com financeiro, estoque ou serviços." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const handleSend = async (texto: string) => {
    if (!texto.trim()) return;

    // 1. CONTAGEM DE MENSAGENS ANTERIORES DO USUÁRIO
    // Isso serve para o Backend decidir se manda dicas ou não.
    // Se tiver 0 ou 1 mensagem anterior, ele manda dica. Se tiver 2 ou mais, para.
    const historyCount = messages.filter(msg => msg.role === 'user').length;

    const userMsg = { role: "user", text: texto };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: texto,
          historyCount: historyCount // <--- ENVIANDO A CONTAGEM AQUI
        })
      });

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.text }]);

    } catch (error) {
      setMessages((prev) => [...prev, { role: "ai", text: "Erro ao conectar com a IA." }]);
    } finally {
      setLoading(false);
    }
  };

  const sugestoes = [
    { icon: BarChart3, text: "Como está o financeiro?" },
    { icon: PackageSearch, text: "O que falta no estoque?" },
    { icon: User, text: "Quantos carros em serviço?" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-40px)] gap-4">
      
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A1A] flex items-center gap-2">
          <Sparkles className="text-[#FACC15]" fill="#FACC15" /> Assistente IA
        </h1>
        <p className="text-stone-500 text-sm mt-1">Secretária Virtual da NHT Centro Automotivo.</p>
      </div>

      <div className="flex-1 bg-white rounded-[32px] p-4 md:p-6 shadow-sm border border-stone-100 overflow-y-auto relative">
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Bot size={200} />
        </div>

        <div className="space-y-6 relative z-10 pb-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-[#1A1A1A] text-white' : 'bg-[#FACC15] text-[#1A1A1A]'}`}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={20} />}
              </div>
              <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'bg-[#1A1A1A] text-white rounded-tr-sm' : 'bg-[#F8F7F2] text-[#1A1A1A] border border-stone-100 rounded-tl-sm'}`}>
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

      <div className="space-y-4">
        {messages.length < 3 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {sugestoes.map((s, i) => (
              <button key={i} onClick={() => handleSend(s.text)} className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-stone-100 text-xs font-bold text-stone-600 hover:bg-[#FACC15] hover:text-[#1A1A1A] transition whitespace-nowrap shadow-sm">
                <s.icon size={14} /> {s.text}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white p-2 rounded-[24px] shadow-lg border border-stone-100 flex items-center gap-2">
          <button className="p-3 text-stone-400 hover:bg-stone-50 rounded-full transition"><Mic size={20} /></button>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Digite sua pergunta..." 
            className="flex-1 bg-transparent outline-none text-[#1A1A1A] placeholder:text-stone-400 font-medium"
          />
          <button onClick={() => handleSend(input)} disabled={!input.trim() || loading} className="p-3 bg-[#1A1A1A] text-[#FACC15] rounded-xl hover:scale-105 transition disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin"></div> : <ArrowRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}