"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "../src/lib/supabase";
import { useAuth } from "../src/contexts/AuthContext";
import { Lock, User, Loader2, AlertCircle, Ban, Mail, ArrowRight, X, CheckCircle, Info, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const supabase = createClient();
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estado do Modal "Esqueci a Senha"
  const [forgotOpen, setForgotOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverStatus, setRecoverStatus] = useState<{ type: 'success' | 'info' | 'error' | null, msg: string }>({ type: null, msg: '' });
  const [loadingRecover, setLoadingRecover] = useState(false);

  // Estado do vídeo da logo
  const [videoEnded, setVideoEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Estado para mostrar/ocultar senha
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      window.location.href = "/dashboard";
    }
  }, [user]);

  const handleLogin = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('ativo')
          .eq('id', authData.user.id)
          .single();

        if (profile && profile.ativo === false) {
          await supabase.auth.signOut();
          setError("Acesso suspenso. Contate o gerente.");
          setLoading(false);
          return;
        }

        window.location.href = "/dashboard";
      }

    } catch (err: any) {
      console.error(err);
      if (err.message.includes("Invalid login")) {
        setError("E-mail ou senha incorretos.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("E-mail não confirmado.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoverEmail) return;
    setLoadingRecover(true);
    setRecoverStatus({ type: null, msg: '' });

    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail })
      });
      const data = await res.json();
      setRecoverStatus({ type: data.type, msg: data.message });
    } catch (err) {
      setRecoverStatus({ type: 'error', msg: 'Erro ao conectar com o servidor.' });
    } finally {
      setLoadingRecover(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] relative overflow-hidden">

      {/* --- VISUAL ORIGINAL (SEM FILTROS DE COR OU OPACIDADE) --- */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/fundologin.png')"
        }}
      ></div>

      {/* Mantive apenas um leve gradiente na base para não cortar o visual abruptamente, mas a imagem fica 100% visível */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0d1117] to-transparent opacity-80"></div>

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 shadow-2xl animate-in fade-in zoom-in duration-500">

          <div className="text-center mb-8 flex flex-col items-center">
            {/* Logo Animada: Vídeo primeiro, depois imagem estática */}
            <div className="w-32 h-32 relative mb-2">
              {!videoEnded && (
                <video
                  ref={videoRef}
                  src="/login.mp4"
                  autoPlay
                  muted
                  playsInline
                  onEnded={() => setVideoEnded(true)}
                  className="w-full h-full object-contain rounded-full transition-opacity duration-500"
                />
              )}
              {videoEnded && (
                <img
                  src="/login.jpg"
                  alt="Logo"
                  className="w-full h-full object-contain rounded-full animate-in fade-in duration-700"
                />
              )}
            </div>

            {/* Texto Centro Automotivo */}
            <span className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em] leading-relaxed mb-4">
              Centro<br />Automotivo
            </span>
          </div>
          <form onSubmit={handleLogin} method="post" className="space-y-4">
            {error && (
              <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm border ${error.includes("suspenso") ? "bg-red-500/20 border-red-500 text-red-200" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-200"}`}>
                {error.includes("suspenso") ? <Ban size={18} /> : <AlertCircle size={18} />}
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
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0d1117]/50 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder:text-stone-600 focus:outline-none focus:border-[#FACC15] transition"
                  placeholder="Sua senha"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-[#FACC15] hover:bg-[#ffe03d] text-[#1A1A1A] font-bold py-4 rounded-2xl shadow-lg shadow-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Verificando..." : "Acessar Sistema"}
              {loading && <Loader2 className="animate-spin" size={18} />}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setForgotOpen(true)}
              className="text-stone-500 text-xs hover:text-[#FACC15] transition hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
        </div>
      </div>

      {/* --- MODAL ESQUECI A SENHA --- */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative">
            <button onClick={() => setForgotOpen(false)} className="absolute top-4 right-4 text-stone-400 hover:text-red-500"><X /></button>

            <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">Recuperar Acesso</h3>
            <p className="text-stone-500 text-sm mb-4">Informe seu e-mail para localizarmos seu cadastro.</p>

            {!recoverStatus.type ? (
              <form onSubmit={handleRecover} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input
                    type="email"
                    value={recoverEmail}
                    onChange={(e) => setRecoverEmail(e.target.value)}
                    className="w-full bg-[#F8F7F2] rounded-2xl py-3 pl-12 pr-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]"
                    placeholder="seu@email.com"
                    autoFocus
                    required
                  />
                </div>
                <button disabled={loadingRecover} className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-3 rounded-2xl flex justify-center gap-2 hover:scale-105 transition">
                  {loadingRecover ? <Loader2 className="animate-spin" /> : <ArrowRight />} Consultar
                </button>
              </form>
            ) : (
              <div className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-2 animate-in zoom-in 
                        ${recoverStatus.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' :
                  recoverStatus.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-red-50 border-red-100 text-red-800'}`}
              >
                {recoverStatus.type === 'success' && <CheckCircle size={32} className="text-green-600" />}
                {recoverStatus.type === 'info' && <Info size={32} className="text-blue-600" />}
                {recoverStatus.type === 'error' && <AlertCircle size={32} className="text-red-500" />}

                <p className="font-bold text-sm">{recoverStatus.msg}</p>

                <button onClick={() => setForgotOpen(false)} className="text-xs underline mt-2 opacity-70 hover:opacity-100">
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
