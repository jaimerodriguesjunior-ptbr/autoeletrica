"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  BookOpen,
  MessageCircle,
  Bot,
  User,
  X,
  Loader2,
  ArrowRight,
  ExternalLink,
  Mic,
  MicOff,
  Wrench,
  Users,
  Package,
  Wallet,
  FileText,
  CalendarDays,
  Settings,
  Globe,
  ReceiptText,
  FileCode2,
} from "lucide-react";

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^#{1,3} (.+)$/gm, "<strong>$1</strong>")
    .replace(/^[\*\-] (.+)$/gm, "• $1")
    .replace(/\n/g, "<br/>");
}

type TutorialCard = {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  Icon: any;
};

type Msg = { role: "ai" | "user"; text: string };
type ChatQuota = { remaining: number; limit: number; resetAt: string | null };

const TUTORIAIS_PRINCIPAIS: TutorialCard[] = [
  {
    id: "atendimento",
    titulo: "Atendimento",
    descricao: "Aprenda a abrir OS, Venda Direta de peças e Serviço de Bancada, do início ao fechamento.",
    href: "/tutoriais/tutorial-abrir-os.html",
    Icon: Wrench,
  },
  {
    id: "clientes",
    titulo: "Clientes",
    descricao: "Como buscar, cadastrar e gerenciar clientes com ficha completa e histórico.",
    href: "/tutoriais/tutorial-clientes.html",
    Icon: Users,
  },
  {
    id: "estoque",
    titulo: "Estoque e Serviços",
    descricao: "Cadastro e gestão de peças e serviços, com filtros, alertas e boas práticas do estoque.",
    href: "/tutoriais/tutorial-estoque.html",
    Icon: Package,
  },
  {
    id: "caixa",
    titulo: "Caixa",
    descricao: "Como registrar entradas e despesas, usar filtros e acompanhar o resultado financeiro.",
    href: "/tutoriais/tutorial-extrato-financeiro.html",
    Icon: Wallet,
  },
  {
    id: "notas-fiscais",
    titulo: "Notas Fiscais",
    descricao: "Emissão de NFC-e e NFS-e, campos obrigatórios, homologação e notas avulsas.",
    href: "/tutoriais/tutorial-notas-fiscais.html",
    Icon: FileText,
  },
  {
    id: "agenda",
    titulo: "Agenda",
    descricao: "Como criar agendamentos, enviar links ao cliente e gerenciar alertas e retornos.",
    href: "/tutoriais/tutorial-agendamento.html",
    Icon: CalendarDays,
  },
  {
    id: "configuracoes",
    titulo: "Configurações",
    descricao: "Guia das 3 abas: Dados da Oficina, Opções de Uso e Gestão de Equipe.",
    href: "/tutoriais/tutorial-opcoes-uso.html",
    Icon: Settings,
  },
];

const TUTORIAIS_ADICIONAIS: TutorialCard[] = [
  {
    id: "portal-cliente",
    titulo: "Portal do Cliente",
    descricao: "O que o cliente visualiza no portal de acompanhamento: status, orçamento, fotos e nota.",
    href: "/tutoriais/tutorial-portal-cliente.html",
    Icon: Globe,
  },
  {
    id: "extrato-cliente",
    titulo: "Extrato do Cliente",
    descricao: "Visão do extrato compartilhado com o cliente: pendências, histórico e resumo financeiro.",
    href: "/tutoriais/tutorial-extrato-cliente.html",
    Icon: ReceiptText,
  },
  {
    id: "importacao-xml",
    titulo: "Importação de XML",
    descricao: "Como importar nota fiscal de fornecedor para entrada automática no estoque.",
    href: "/tutoriais/tutorial-importacao-xml.html",
    Icon: FileCode2,
  },
];

function TutorialGrid({ items }: { items: TutorialCard[] }) {
  return (
    <>
      {items.map((t) => (
        <a
          key={t.id}
          href={t.href}
          className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm hover:shadow-md hover:border-[#FACC15] transition group flex items-start gap-4"
        >
          <div className="w-12 h-12 bg-[#FACC15]/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-[#FACC15]/40 transition">
            <t.Icon size={22} className="text-[#1A1A1A]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-[#1A1A1A] text-sm">{t.titulo}</p>
              <ExternalLink size={13} className="text-stone-300 group-hover:text-stone-500 transition shrink-0" />
            </div>
            <p className="text-stone-400 text-xs mt-1 leading-relaxed">{t.descricao}</p>
          </div>
        </a>
      ))}
    </>
  );
}

export default function TutorialPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "Olá! Pode me perguntar qualquer dúvida sobre o uso do sistema. Estou aqui para ajudar." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [quota, setQuota] = useState<ChatQuota>({ remaining: 3, limit: 3, resetAt: null });
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/tutorial-chat", { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      setQuota({
        remaining: typeof data.remaining === "number" ? data.remaining : 3,
        limit: typeof data.limit === "number" ? data.limit : 3,
        resetAt: data.resetAt || null,
      });
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (chatOpen) refreshQuota();
  }, [chatOpen, refreshQuota]);

  const formatReset = (iso: string | null) => {
    if (!iso) return "";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleMic = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Reconhecimento de voz não disponível neste navegador. Use o Chrome.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    rec.start();
    setListening(true);
  }, [listening]);

  const handleSend = async (texto: string) => {
    if (!texto.trim() || loading) return;
    if (quota.remaining <= 0) {
      setMessages([
        { role: "user", text: texto },
        {
          role: "ai",
          text: `Você atingiu o limite de ${quota.limit} perguntas. Aguarde até ${formatReset(quota.resetAt)} para perguntar novamente.`,
        },
      ]);
      setInput("");
      return;
    }

    const userMsg: Msg = { role: "user", text: texto };
    setMessages([userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/tutorial-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: texto }),
      });
      const data = await res.json();

      if (typeof data.remaining === "number") {
        setQuota({
          remaining: data.remaining,
          limit: typeof data.limit === "number" ? data.limit : quota.limit,
          resetAt: data.resetAt || quota.resetAt,
        });
      }

      setMessages([userMsg, { role: "ai", text: data.text || "Sem resposta." }]);
    } catch {
      setMessages([userMsg, { role: "ai", text: "Erro ao conectar com a IA." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1A1A1A] flex items-center gap-2">
            <BookOpen size={22} className="text-[#FACC15]" /> Tutoriais & Ajuda
          </h1>
          <p className="text-stone-500 text-sm mt-1">Guias de uso do sistema. Clique em um tutorial para abrir.</p>
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className="flex items-center gap-2 bg-[#1A1A1A] text-[#FACC15] px-4 py-2.5 rounded-xl font-bold text-sm shadow-md hover:scale-105 transition"
        >
          <MessageCircle size={16} /> Pergunte à IA
        </button>
      </div>

      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-500 mb-3">Itens principais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TutorialGrid items={TUTORIAIS_PRINCIPAIS} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-500 mb-3">Itens adicionais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TutorialGrid items={TUTORIAIS_ADICIONAIS} />
        </div>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 md:p-8 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-100 w-full max-w-md flex flex-col h-[520px]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#FACC15] rounded-full flex items-center justify-center">
                  <Bot size={16} className="text-[#1A1A1A]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] text-sm">Assistente de Uso</p>
                  <p className="text-[10px] text-stone-400">
                    {quota.remaining}/{quota.limit} perguntas disponíveis
                    {quota.remaining <= 0 && quota.resetAt ? ` • libera em ${formatReset(quota.resetAt)}` : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-stone-400 hover:text-stone-600 transition">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#1A1A1A]" : "bg-[#FACC15]"}`}>
                    {msg.role === "user"
                      ? <User size={13} className="text-white" />
                      : <Bot size={14} className="text-[#1A1A1A]" />}
                  </div>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[82%] ${msg.role === "user" ? "bg-[#1A1A1A] text-white rounded-tr-sm" : "bg-[#F8F7F2] text-[#1A1A1A] rounded-tl-sm"}`}
                    dangerouslySetInnerHTML={{ __html: msg.role === "ai" ? renderMarkdown(msg.text) : msg.text }}
                  />
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#FACC15] flex items-center justify-center shrink-0">
                    <Bot size={14} className="text-[#1A1A1A]" />
                  </div>
                  <div className="bg-[#F8F7F2] px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-75" />
                    <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="px-4 pb-4">
              <div className={`bg-[#F8F7F2] rounded-xl flex items-center gap-2 px-3 py-2 border transition ${listening ? "border-red-400 bg-red-50" : "border-stone-200 focus-within:border-[#FACC15]"}`}>
                <button
                  onClick={toggleMic}
                  title={listening ? "Parar gravação" : "Falar pergunta"}
                  className={`shrink-0 transition-all ${listening ? "text-red-500 animate-pulse" : "text-stone-400 hover:text-stone-600"}`}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
                  placeholder={listening ? "Ouvindo..." : "Como faço para..."}
                  className="flex-1 bg-transparent outline-none text-sm text-[#1A1A1A] placeholder:text-stone-400"
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || loading || quota.remaining <= 0}
                  className="w-8 h-8 bg-[#1A1A1A] text-[#FACC15] rounded-lg flex items-center justify-center hover:scale-105 transition disabled:opacity-40 shrink-0"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
