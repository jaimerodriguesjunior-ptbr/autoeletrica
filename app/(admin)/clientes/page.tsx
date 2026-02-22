"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/contexts/AuthContext";
import {
  Search, Plus, Phone, ArrowRight, Loader2, UserX
} from "lucide-react";

// Tipo local para exibição
type VehicleInfo = { placa: string; modelo: string };
type ClientView = {
  id: string;
  nome: string;
  whatsapp: string | null;
  veiculos_count: number;
  veiculos: VehicleInfo[];
  created_at: string;
};

export default function Clientes() {
  const supabase = createClient();
  const { profile, loading: authLoading } = useAuth();

  const [clients, setClients] = useState<ClientView[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (profile) {
      fetchClients();
    }
  }, [profile]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, 
          nome, 
          whatsapp, 
          created_at,
          vehicles (placa, modelo)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((c: any) => ({
        id: c.id,
        nome: c.nome,
        whatsapp: c.whatsapp,
        veiculos_count: c.vehicles ? c.vehicles.length : 0,
        veiculos: (c.vehicles || []) as VehicleInfo[],
        created_at: c.created_at
      })) || [];

      setClients(formattedData);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtro local (nome, telefone, placa ou modelo do veículo)
  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    if (c.nome.toLowerCase().includes(term)) return true;
    if (c.whatsapp && c.whatsapp.includes(searchTerm)) return true;
    if (c.veiculos?.some(v =>
      v.placa?.toLowerCase().includes(term) ||
      v.modelo?.toLowerCase().includes(term)
    )) return true;
    return false;
  });

  if (authLoading) return null;

  return (
    <div className="space-y-8 pb-32">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A1A1A]">Base de Clientes</h1>
        </div>

        <Link href="/clientes/novo">
          <button className="bg-[#1A1A1A] hover:bg-black text-[#FACC15] px-6 py-3 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 transition hover:scale-105">
            <Plus size={20} /> Novo Cliente
          </button>
        </Link>
      </div>

      {/* Barra de Busca */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="text-stone-400" size={24} />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, telefone, placa ou modelo..."
          className="w-full bg-white pl-14 pr-4 py-5 rounded-[24px] shadow-sm border-2 border-[#1A1A1A] text-lg outline-none focus:ring-4 focus:ring-[#FACC15]/30 focus:border-[#1A1A1A] transition text-[#1A1A1A] placeholder:text-stone-400 font-bold"
        />
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-[32px] shadow-sm border-2 border-stone-300 overflow-hidden min-h-[300px]">
        <div className="p-6 border-b-2 border-stone-300 flex justify-between items-center bg-stone-100">
          <h3 className="font-extrabold text-[#1A1A1A] text-lg">Todos os Clientes</h3>
          <span className="text-xs font-bold bg-white border-2 border-stone-300 shadow-sm text-[#1A1A1A] px-3 py-1.5 rounded-xl">
            Total Registros: {filteredClients.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-2">
              <Loader2 className="animate-spin text-[#FACC15]" size={32} />
              <p className="text-xs font-medium">Buscando dados no servidor...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-200 text-[#1A1A1A] text-[11px] font-black uppercase tracking-wider border-b-2 border-stone-300">
                <tr>
                  <th className="px-6 py-5">Nome / Contato</th>
                  <th className="px-6 py-5">Veículos</th>
                  <th className="px-6 py-5 hidden md:table-cell">Cadastro</th>
                  <th className="px-6 py-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="border-b border-stone-300 hover:bg-stone-100 transition group">
                    <td className="px-6 py-5">
                      <p className="font-extrabold text-[#1A1A1A] text-lg md:text-base">{c.nome}</p>
                      <div className="flex items-center gap-2 mt-1 text-stone-500 text-xs font-medium">
                        <Phone size={12} /> {c.whatsapp || "Sem número"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {c.veiculos_count > 0 ? (
                        <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-xs font-bold border border-stone-200">
                          {c.veiculos_count} Carros
                        </span>
                      ) : (
                        <span className="text-stone-300 text-xs italic">Nenhum</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-stone-500 font-mono text-xs hidden md:table-cell">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {/* CORREÇÃO AQUI: Link para a página de edição */}
                      <Link href={`/clientes/${c.id}`}>
                        <button className="p-3 hover:bg-stone-100 rounded-full text-stone-400 hover:text-[#1A1A1A] transition">
                          <ArrowRight size={20} />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}

                {!loading && filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-stone-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-stone-50 p-4 rounded-full">
                          <UserX size={32} />
                        </div>
                        <p>Nenhum cliente encontrado.</p>
                        <Link href="/clientes/novo" className="text-[#FACC15] font-bold text-sm hover:underline">
                          Cadastrar o primeiro agora?
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}