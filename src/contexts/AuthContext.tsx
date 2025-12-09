"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase";

type UserProfile = {
  id: string;
  organization_id: string | null;
  nome: string | null;
  cargo: string;
  email: string | null;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Ref para controlar se o componente está montado (evita vazamento de memória)
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string) => {
    try {
      // Timeout de segurança para a query do banco (5 segundos máximo)
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout banco")), 5000)
      );

      // Corrida entre o banco e o relógio para evitar travamento
      // @ts-ignore
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) throw error;

      if (data && mountedRef.current) {
        setProfile(data);
      }
    } catch (err) {
      console.error("⚠️ [Auth] Falha ao buscar perfil (liberando acesso sem perfil):", err);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let authListener: any = null;

    // Disjuntor Geral: Se NADA acontecer em 4 segundos, destrava a tela branca.
    const safetyTimeout = setTimeout(() => {
      if (loading && mountedRef.current) {
        setLoading(false);
      }
    }, 4000);

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mountedRef.current) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("❌ [Auth] Erro crítico na sessão:", error);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          clearTimeout(safetyTimeout); // Cancela o timeout se carregou normal
        }
      }
    };

    initializeAuth();

    const setupListener = async () => {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mountedRef.current) return;

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });
      authListener = data.subscription;
    };

    setupListener();

    return () => {
      mountedRef.current = false;
      if (authListener) authListener.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, [supabase]);

  const signOut = async () => {
    try {
      // 1. Limpeza BRUTA de Cookies (A CORREÇÃO PRINCIPAL)
      // Isso força o navegador a esquecer a sessão, impedindo o login automático ao recarregar
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
      });

      // 2. Limpeza local
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // 3. Reset de Estado
      setUser(null);
      setProfile(null);

      // 4. Logout no Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      // 5. Redirecionamento
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);