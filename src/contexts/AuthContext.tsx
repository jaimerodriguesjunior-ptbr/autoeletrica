"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  // CORREÇÃO CRÍTICA: Inicializa o cliente apenas UMA vez para evitar loop
  const [supabase] = useState(() => createClient());
  
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Erro ao buscar perfil:", error);
      } else {
        setProfile(data);
        // Backup no localStorage para acesso rápido
        if (typeof window !== 'undefined') {
          localStorage.setItem("userRole", data.cargo);
          localStorage.setItem("userName", data.nome || "Usuário");
        }
      }
    } catch (err) {
      console.error("Erro fetchProfile:", err);
    }
  };

  useEffect(() => {
    // 1. Verifica sessão inicial
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 2. Escuta mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      // Só atualiza se o usuário realmente mudou
      setUser(prevUser => {
        if (prevUser?.id === session?.user?.id) return prevUser;
        return session?.user ?? null;
      });

      if (event === 'SIGNED_IN' && session?.user) {
        // Busca perfil apenas no login
        await fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        if (typeof window !== 'undefined') {
          localStorage.clear();
          // Redirecionamento seguro para a Home se não estiver lá
          if (window.location.pathname !== "/") {
             window.location.href = "/";
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);