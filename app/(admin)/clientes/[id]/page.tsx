"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import { 
  ArrowLeft, User, MapPin, 
  Car, Save, Phone, FileText, Trash2, Loader2, Edit, X
} from "lucide-react";

export default function EditarCliente() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Estados do Formulário Cliente
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  
  // Endereço
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");

  // Lista de Veículos do Cliente
  const [veiculos, setVeiculos] = useState<any[]>([]);

  // --- NOVO: Estados para Edição de Veículo ---
  const [modalVeiculoOpen, setModalVeiculoOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vPlaca, setVPlaca] = useState("");
  const [vModelo, setVModelo] = useState("");
  const [vFabricante, setVFabricante] = useState("");
  const [vCor, setVCor] = useState("");
  const [vAno, setVAno] = useState("");
  const [vObs, setVObs] = useState("");
  const [savingVeiculo, setSavingVeiculo] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCliente();
    }
  }, [id]);

  const fetchCliente = async () => {
    try {
      // 1. Busca Cliente
      const { data: cliente, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (cliente) {
        setNome(cliente.nome || "");
        setCpfCnpj(cliente.cpf_cnpj || "");
        setWhatsapp(cliente.whatsapp || "");
        setEmail(cliente.email || "");
        
        if (cliente.endereco) {
          const end = cliente.endereco;
          setCep(end.cep || "");
          setRua(end.rua || "");
          setNumero(end.numero || "");
          setBairro(end.bairro || "");
        }
      }

      fetchVeiculos();

    } catch (error) {
      console.error(error);
      alert("Erro ao carregar cliente.");
      router.push("/clientes");
    } finally {
      setLoading(false);
    }
  };

  const fetchVeiculos = async () => {
    const { data: cars } = await supabase
        .from('vehicles')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });
      
    setVeiculos(cars || []);
  }

  const handleSalvarCliente = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          nome,
          cpf_cnpj: cpfCnpj,
          whatsapp,
          email,
          endereco: { cep, rua, numero, bairro }
        })
        .eq('id', id);

      if (error) throw error;
      alert("Dados do cliente atualizados!");
    } catch (error: any) {
      alert("Erro ao atualizar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirCliente = async () => {
    if (!confirm("ATENÇÃO: Excluir este cliente apagará também o histórico de veículos dele. Continuar?")) return;
    
    setDeleting(true);
    try {
        await supabase.from('vehicles').delete().eq('client_id', id);
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;

        router.push('/clientes');
    } catch (error: any) {
        alert("Erro ao excluir: " + error.message);
    } finally {
        setDeleting(false);
    }
  };

  // --- NOVAS FUNÇÕES: VEÍCULO ---
  const abrirModalEdicao = (v: any) => {
    setEditingVehicleId(v.id);
    setVPlaca(v.placa);
    setVModelo(v.modelo);
    setVFabricante(v.fabricante);
    setVCor(v.cor || "");
    setVAno(v.ano || "");
    setVObs(v.obs || "");
    setModalVeiculoOpen(true);
  };

  const handleSalvarVeiculo = async () => {
    if (!editingVehicleId) return;
    setSavingVeiculo(true);
    try {
        const { error } = await supabase
            .from('vehicles')
            .update({
                placa: vPlaca.toUpperCase(),
                modelo: vModelo,
                fabricante: vFabricante,
                cor: vCor,
                ano: vAno,
                obs: vObs
            })
            .eq('id', editingVehicleId);

        if (error) throw error;
        
        await fetchVeiculos(); // Recarrega a lista
        setModalVeiculoOpen(false);
        alert("Veículo atualizado!");
    } catch (error: any) {
        alert("Erro ao salvar veículo: " + error.message);
    } finally {
        setSavingVeiculo(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#FACC15]" size={40}/></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      
      {/* 1. CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Link href="/clientes">
            <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition">
                <ArrowLeft size={20} />
            </button>
            </Link>
            <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Editar Cliente</h1>
            <p className="text-stone-500 text-xs">Gerencie dados e veículos</p>
            </div>
        </div>
        <button onClick={handleExcluirCliente} disabled={deleting} className="text-red-400 hover:text-red-600 font-bold text-sm flex items-center gap-2">
            {deleting ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={18}/>} Excluir
        </button>
      </div>

      {/* 2. DADOS PESSOAIS */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4 relative overflow-hidden">
        <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
          <FileText size={18} /> Dados Básicos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">NOME COMPLETO</label>
            <input 
              type="text" 
              value={nome}
              onChange={e => setNome(e.target.value)}
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" 
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">CPF / CNPJ</label>
            <input 
              type="text" 
              value={cpfCnpj}
              onChange={e => setCpfCnpj(e.target.value)}
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">WHATSAPP</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="tel" 
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                className="w-full bg-[#F8F7F2] rounded-2xl p-4 pl-12 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" 
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">E-MAIL</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" 
            />
          </div>
        </div>
      </div>

      {/* 3. ENDEREÇO */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
        <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
          <MapPin size={18} /> Endereço
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">CEP</label>
            <input type="text" value={cep} onChange={e => setCep(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">RUA</label>
            <input type="text" value={rua} onChange={e => setRua(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">NÚMERO</label>
            <input type="text" value={numero} onChange={e => setNumero(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">BAIRRO</label>
            <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
        </div>
      </div>

      {/* 4. VEÍCULOS JÁ CADASTRADOS */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100">
        <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2 mb-4">
            <Car size={18} /> Veículos Cadastrados
        </h3>
        
        {veiculos.length === 0 ? (
            <p className="text-stone-400 text-sm">Nenhum veículo vinculado.</p>
        ) : (
            <div className="space-y-3">
                {veiculos.map(v => (
                    <div key={v.id} className="bg-[#F8F7F2] p-4 rounded-2xl flex justify-between items-center group">
                        <div>
                            <p className="font-bold text-[#1A1A1A]">{v.modelo}</p>
                            <p className="text-xs text-stone-500 font-mono">{v.placa}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] bg-white border border-stone-200 px-2 py-1 rounded font-bold text-stone-400">
                                {v.fabricante}
                            </span>
                            <button 
                                onClick={() => abrirModalEdicao(v)}
                                className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-stone-400 hover:text-[#1A1A1A] shadow-sm transition"
                            >
                                <Edit size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* 5. AÇÃO FLUTUANTE (SALVAR CLIENTE) */}
      <div className="fixed bottom-24 md:bottom-6 right-6 left-6 md:left-auto md:w-96 z-40">
        <button 
          onClick={handleSalvarCliente}
          disabled={saving}
          className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-full shadow-lg flex justify-center items-center gap-2 hover:scale-105 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* --- MODAL DE EDIÇÃO DE VEÍCULO --- */}
      {modalVeiculoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
                <Car size={24} /> Editar Veículo
              </h2>
              <button onClick={() => setModalVeiculoOpen(false)}><X /></button>
            </div>

            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                   <div>
                        <label className="text-xs font-bold text-stone-400 ml-2">PLACA</label>
                        <input 
                            type="text" 
                            value={vPlaca} 
                            onChange={e=>setVPlaca(e.target.value.toUpperCase())} 
                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-bold text-[#1A1A1A] uppercase outline-none" 
                        />
                   </div>
                   <div>
                        <label className="text-xs font-bold text-stone-400 ml-2">FABRICANTE</label>
                        <input 
                            type="text" 
                            value={vFabricante} 
                            onChange={e=>setVFabricante(e.target.value)} 
                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none" 
                        />
                   </div>
               </div>

               <div>
                    <label className="text-xs font-bold text-stone-400 ml-2">MODELO</label>
                    <input 
                        type="text" 
                        value={vModelo} 
                        onChange={e=>setVModelo(e.target.value)} 
                        className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none" 
                    />
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div>
                        <label className="text-xs font-bold text-stone-400 ml-2">COR</label>
                        <input 
                            type="text" 
                            value={vCor} 
                            onChange={e=>setVCor(e.target.value)} 
                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none" 
                        />
                   </div>
                   <div>
                        <label className="text-xs font-bold text-stone-400 ml-2">ANO</label>
                        <input 
                            type="text" 
                            value={vAno} 
                            onChange={e=>setVAno(e.target.value)} 
                            className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none" 
                        />
                   </div>
               </div>

               <div>
                    <label className="text-xs font-bold text-stone-400 ml-2">OBSERVAÇÕES</label>
                    <input 
                        type="text" 
                        value={vObs} 
                        onChange={e=>setVObs(e.target.value)} 
                        className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none" 
                    />
               </div>
            </div>

            <button 
              onClick={handleSalvarVeiculo} 
              disabled={savingVeiculo} 
              className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-2xl flex justify-center gap-2 hover:scale-105 transition"
            >
              {savingVeiculo ? <Loader2 className="animate-spin"/> : <Save />} Salvar Veículo
            </button>
          </div>
        </div>
      )}

    </div>
  );
}