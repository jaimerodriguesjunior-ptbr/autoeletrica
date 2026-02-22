"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Ajuste: Caminhos relativos explícitos baseados na estrutura app/ vs src/
// app/(admin)/clientes/novo/page.tsx -> sobe 4 niveis para raiz -> entra em src/lib
import { createClient } from "../../../../src/lib/supabase";
import { useAuth } from "../../../../src/contexts/AuthContext";
import {
  ArrowLeft, User, Building2, MapPin,
  Car, Save, Phone, FileText, Plus, Loader2
} from "lucide-react";

export default function NovoCliente() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [tipoPessoa, setTipoPessoa] = useState<"pf" | "pj">("pf");
  const [addCarro, setAddCarro] = useState(false);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");

  // Veículo
  const [placa, setPlaca] = useState("");
  const [modelo, setModelo] = useState("");

  const handleSalvar = async () => {
    if (!profile?.organization_id) {
      alert("Erro: Organização não identificada. Tente recarregar a página.");
      return;
    }

    if (!nome) {
      alert("O nome é obrigatório.");
      return;
    }

    setSaving(true);

    try {
      // 1. Inserir Cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({
          organization_id: profile.organization_id,
          nome,
          cpf_cnpj: cpfCnpj,
          whatsapp,
          email,
          endereco: { cep, rua, numero, bairro }
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 2. Inserir Veículo (se preenchido)
      if (addCarro && placa && modelo && clientData) {
        const { error: vehicleError } = await supabase
          .from('vehicles')
          .insert({
            organization_id: profile.organization_id,
            client_id: clientData.id,
            placa: placa.toUpperCase(),
            modelo,
            cor: ''
          });

        if (vehicleError) throw vehicleError;
      }

      alert("Cliente cadastrado com sucesso!");
      router.push("/clientes");

    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      alert(`Erro: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">

      {/* 1. CABEÇALHO */}
      <div className="flex items-center gap-4">
        <Link href="/clientes">
          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1A1A1A] shadow-sm hover:bg-stone-50 transition">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Novo Cliente</h1>
          <p className="text-stone-500 text-xs">Preencha os dados completos</p>
        </div>
      </div>

      {/* 2. SELETOR TIPO (PF / PJ) */}
      <div className="bg-white p-1 rounded-[24px] inline-flex border border-stone-100 shadow-sm">
        <button
          onClick={() => setTipoPessoa("pf")}
          className={`px-6 py-3 rounded-[20px] text-sm font-bold flex items-center gap-2 transition ${tipoPessoa === 'pf' ? 'bg-[#1A1A1A] text-[#FACC15] shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
        >
          <User size={18} /> Pessoa Física
        </button>
        <button
          onClick={() => setTipoPessoa("pj")}
          className={`px-6 py-3 rounded-[20px] text-sm font-bold flex items-center gap-2 transition ${tipoPessoa === 'pj' ? 'bg-[#1A1A1A] text-[#FACC15] shadow-md' : 'text-stone-400 hover:text-stone-600'}`}
        >
          <Building2 size={18} /> Empresa (PJ)
        </button>
      </div>

      {/* 3. DADOS PESSOAIS */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#FACC15]/10 rounded-bl-[60px]"></div>

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
              placeholder={tipoPessoa === 'pf' ? "Ex: João da Silva" : "Ex: Transportadora Veloz Ltda"}
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">{tipoPessoa === 'pf' ? 'CPF' : 'CNPJ'}</label>
            <input
              type="text"
              value={cpfCnpj}
              onChange={e => setCpfCnpj(e.target.value)}
              placeholder={tipoPessoa === 'pf' ? "000.000.000-00" : "00.000.000/0001-00"}
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">WHATSAPP / TELEFONE</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full bg-[#F8F7F2] rounded-2xl p-4 pl-12 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">E-MAIL (Opcional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition"
            />
          </div>
        </div>
      </div>

      {/* 4. ENDEREÇO */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 space-y-4">
        <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
          <MapPin size={18} /> Endereço
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">CEP</label>
            <input type="text" value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">RUA / AVENIDA</label>
            <input type="text" value={rua} onChange={e => setRua(e.target.value)} placeholder="Av. Brasil" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">NÚMERO</label>
            <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="123" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-bold text-stone-400 ml-2">BAIRRO</label>
            <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Centro" className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] transition" />
          </div>
        </div>
      </div>

      {/* 5. VEÍCULO INICIAL (Opcional) */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-stone-100 transition-all">

        {!addCarro ? (
          <button
            onClick={() => setAddCarro(true)}
            className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 font-bold hover:border-[#FACC15] hover:text-[#1A1A1A] transition flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Cadastrar um veículo agora?
          </button>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                <Car size={18} /> Veículo Principal
              </h3>
              <button onClick={() => setAddCarro(false)} className="text-xs font-bold text-red-400 hover:text-red-600">Cancelar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">PLACA</label>
                <input
                  type="text"
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-bold text-[#1A1A1A] outline-none border-2 border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15] uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 ml-2">MODELO/COR</label>
                <input
                  type="text"
                  value={modelo}
                  onChange={e => setModelo(e.target.value)}
                  placeholder="Ex: Gol G5 Prata"
                  className="w-full bg-[#F8F7F2] rounded-2xl p-4 font-medium text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#FACC15]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. AÇÃO FLUTUANTE */}
      <div className="fixed bottom-24 md:bottom-6 right-6 left-6 md:left-auto md:w-96 z-40">
        <button
          onClick={handleSalvar}
          disabled={saving}
          className="w-full bg-[#1A1A1A] text-[#FACC15] font-bold py-4 rounded-full shadow-lg flex justify-center items-center gap-2 hover:scale-105 transition active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {saving ? "Salvando..." : "Salvar Cadastro"}
        </button>
      </div>

    </div>
  );
}