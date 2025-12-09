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
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) setProfile(data);
    } catch (err) {
      console.error("Erro perfil:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (mounted && initialSession?.user) {
         setUser(initialSession.user);
         await fetchProfile(initialSession.user.id);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (mounted) {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
          } else if (session?.user) {
            setUser(session.user);
            if (!profile) await fetchProfile(session.user.id);
          }
          setLoading(false);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    };

    initAuth();
  }, [supabase]);

  // === AQUI ESTÁ A MUDANÇA (FORÇA BRUTA) ===
  const signOut = async () => {
    try {
      // 1. Limpa o navegador PRIMEIRO (Garante o logout local)
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // 2. Limpa estado React
      setUser(null);
      setProfile(null);

      // 3. Avisa o Supabase (Se falhar, não importa, já limpamos local)
      await supabase.auth.signOut();
      
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      // 4. Redireciona
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