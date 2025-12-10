"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// CORREÇÃO: Caminhos relativos
import { createClient } from "../utils/supabase/client";
import { getProfileServerAction } from "../actions/auth";

type UserProfile = {
  id: string;
  organization_id: string | null;
  nome: string | null;
  cargo: string | null;
  email: string | null;
  ativo: boolean | null;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  statusMessage?: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  statusMessage: "",
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Iniciando...");

  const fetchProfileBlindado = useCallback(async () => {
    try {
      const { success, data } = await getProfileServerAction();

      if (success && data) {
        // CORREÇÃO: Força o TypeScript a aceitar os dados (remove o vermelho)
        setProfile(data as any as UserProfile);
        console.log("✅ Perfil carregado via Server Action:", data.nome);
      } else {
        console.warn("⚠️ Perfil não encontrado ou erro no servidor.");
      }
    } catch (err) {
      console.error("Erro crítico ao buscar perfil:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        setStatusMessage("Carregando perfil...");
        await fetchProfileBlindado();
      } else {
        setLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;
          console.log(`🔐 Auth Event: ${event}`);

          if (session?.user) {
            setUser(session.user);
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
               await fetchProfileBlindado();
            }
          } else {
            setUser(null);
            setProfile(null);
            setLoading(false);
            if (event === 'SIGNED_OUT') {
              router.refresh();
              router.replace('/login');
            }
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [supabase, router, fetchProfileBlindado]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
    router.replace('/login');
  };

  const isAdmin = profile?.cargo === 'GERENTE' || profile?.cargo === 'ADMIN';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, statusMessage, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);