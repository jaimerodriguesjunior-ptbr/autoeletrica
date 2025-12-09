"use client";

import { useState, useEffect } from "react";
import { createClient } from "../src/lib/supabase"; // Verifique se o caminho ../ está correto para sua estrutura
import { useAuth } from "../src/contexts/AuthContext";
import { Lock, User, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function Login() {
  const supabase = createClient();
  const { user } = useAuth(); // Apenas verificamos se já existe usuário
  
  // 1. DADOS JÁ PREENCHIDOS (Para facilitar sua vida)
  const [email, setEmail] = useState("jaimerodriguesjunior@outlook.com");
  const [password, setPassword] = useState(""); 
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se o AuthContext já carregar logado, te joga pra dentro
  useEffect(() => {
    if (user) {
      console.log("⚡ [Login] Usuário detectado via Context. Redirecionando...");
      window.location.href = "/dashboard";
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🚀 [Login] Botão clicado...");
    setError("");
    setLoading(true);

    try {
      // Tenta logar no Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("❌ [Login] Erro:", error);
        throw error;
      }

      // SE CHEGOU AQUI, O LOGIN FUNCIONOU!
      console.log("✅ [Login] Sucesso! Forçando entrada no Dashboard...");
      
      // Força bruta: Redireciona via navegador (ignora qualquer delay do React)
      window.location.href = "/dashboard";

    } catch (err: any) {
      console.error(err);
      if (err.message.includes("Invalid login")) {
        setError("E-mail ou senha incorretos.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("E-mail não confirmado.");
      } else {
        setError(err.message);
      }
      setLoading(false); // Só para o loading se der erro
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] relative overflow-hidden">
      {/* Background Tech (Visual) */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1635326444826-06c8f84991a9?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0d1117] to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              <span className="text-[#FACC15]">Auto</span>Pro
            </h1>
            <p className="text-stone-400 text-sm">Acesso restrito a colaboradores.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-200 text-sm">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d1117]/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FACC15] transition"
                  placeholder="Seu e-mail corporativo"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0d1117]/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FACC15] transition"
                  placeholder="Sua senha"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#FACC15] hover:bg-[#ffe03d] text-[#1A1A1A] font-bold py-4 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Entrando..." : "Acessar Sistema"}
              {loading && <Loader2 className="animate-spin" size={18}/>}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-stone-500 text-xs">
              Esqueceu a senha? <span className="text-[#FACC15] cursor-pointer hover:underline">Falar com o gerente</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}