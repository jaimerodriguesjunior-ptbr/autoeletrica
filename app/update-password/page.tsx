"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../src/lib/supabase";
import { Lock, CheckCircle, AlertCircle, Loader2, ArrowRight } from "lucide-react";

export default function UpdatePassword() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: '' });

  // Verifica se o link é válido (se o usuário está logado via link mágico)
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus({ type: 'error', msg: 'Link inválido ou expirado. Solicite a recuperação novamente.' });
      }
    };
    checkSession();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setStatus({ type: 'error', msg: 'As senhas não coincidem.' });
      return;
    }

    if (password.length < 6) {
      setStatus({ type: 'error', msg: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    setLoading(true);
    setStatus({ type: null, msg: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password: password });

      if (error) throw error;

      setStatus({ type: 'success', msg: 'Senha atualizada com sucesso! Redirecionando...' });
      
      // Aguarda 2 segundos para o usuário ler e redireciona
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      setStatus({ type: 'error', msg: 'Erro ao atualizar: ' + error.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] relative overflow-hidden">
      
      {/* Fundo igual ao Login */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0d1117] to-transparent opacity-80"></div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in duration-500">
          
          <div className="text-center mb-8 flex flex-col items-center">
            {/* Logo Pequena */}
            <div className="w-16 h-16 relative mb-2 opacity-50 grayscale">
                <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Definir Nova Senha</h1>
            <p className="text-stone-500 text-xs">Digite sua nova credencial de acesso.</p>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            
            {status.msg && (
              <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm border ${status.type === 'error' ? "bg-red-500/20 border-red-500 text-red-200" : "bg-green-500/20 border-green-500 text-green-200"}`}>
                {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                {status.msg}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-500 ml-2">NOVA SENHA</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0d1117]/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FACC15] transition"
                  placeholder="******"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-500 ml-2">CONFIRMAR SENHA</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0d1117]/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FACC15] transition"
                  placeholder="******"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || status.type === 'success'}
              className="w-full bg-[#FACC15] hover:bg-[#ffe03d] text-[#1A1A1A] font-bold py-4 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? "Salvando..." : "Atualizar Senha"}
              {loading ? <Loader2 className="animate-spin" size={18}/> : <ArrowRight size={18}/>}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}