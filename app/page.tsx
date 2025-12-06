"use client";

import { useState } from "react";
// Importamos o cliente Supabase usando caminho relativo
import { createClient } from "../src/lib/supabase";
import { Lock, User, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginScreen() {
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Redirecionamento forçado via navegador
      window.location.href = "/dashboard";
      
    } catch (err: any) {
      console.error("Erro no login:", err);
      if (err.message.includes("Invalid login")) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError("Erro ao conectar. Verifique suas credenciais.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-900">
      
      {/* Imagem de Fundo */}
      <div className="absolute inset-0 z-0">
       <img
          src="/fundologin.png" 
          alt="Oficina Fundo"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Card de Login */}
      <div className="relative z-10 w-full max-w-md p-8 m-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-[32px] p-8 shadow-2xl">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Auto<span className="text-[#FACC15]">Pro</span>
            </h1>
            <p className="text-stone-200 text-sm">Acesso restrito a colaboradores.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={20} />
              <input 
                type="email" 
                placeholder="E-mail corporativo"
                className="w-full bg-white/10 border border-white/10 rounded-full py-3 pl-12 pr-4 text-white placeholder:text-white/50 outline-none focus:border-[#FACC15]/50 transition"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={20} />
              <input 
                type="password" 
                placeholder="Senha"
                className="w-full bg-white/10 border border-white/10 rounded-full py-3 pl-12 pr-4 text-white placeholder:text-white/50 outline-none focus:border-[#FACC15]/50 transition"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

             {error && (
               <div className="flex items-center gap-2 text-red-300 text-sm bg-red-900/30 p-2 rounded-lg justify-center animate-in fade-in slide-in-from-top-2">
                 <AlertCircle size={14} /> {error}
               </div>
             )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#FACC15] hover:bg-[#e5ba14] text-[#1A1A1A] font-bold py-3 rounded-full shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? "Verificando..." : <>Acessar Sistema <ArrowRight size={20} /></>}
            </button>

          </form>
          
          <div className="mt-6 text-center text-xs text-white/30 space-y-1">
            <p>Esqueceu a senha? <span className="text-[#FACC15] hover:underline cursor-pointer">Falar com o gerente</span></p>
          </div>

        </div>
      </div>
    </main>
  );
}