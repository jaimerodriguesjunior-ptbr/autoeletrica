"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase";
import { Printer, ArrowLeft, MapPin, Phone } from "lucide-react";

export default function ImprimirOSA5() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [os, setOs] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!loading && os) {
      const handleAfterPrint = () => { window.close(); };
      window.addEventListener("afterprint", handleAfterPrint);
      const timer = setTimeout(() => { window.print(); }, 1000);
      return () => { clearTimeout(timer); window.removeEventListener("afterprint", handleAfterPrint); };
    }
  }, [loading, os]);

  const fetchData = async () => {
    try {
      const { data: osData, error: osError } = await supabase
        .from('work_orders')
        .select(`*, vehicles (*), clients (*), work_order_items (*)`)
        .eq('id', id)
        .single();
      if (osError) throw osError;
      setOs(osData);

      const { data: companyData } = await supabase.from('company_settings').select('*').limit(1).single();
      setCompany(companyData || {});
    } catch (error: any) {
      console.error(error);
      alert("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="p-10 text-center font-sans">Carregando documento...</div>;
  if (!os) return <div className="p-10 text-center font-sans text-red-500">Documento não encontrado.</div>;

  const totalPecas = os.work_order_items?.filter((i: any) => i.tipo === 'peca').reduce((acc: number, i: any) => acc + i.total_price, 0) || 0;
  const totalServicos = os.work_order_items?.filter((i: any) => i.tipo === 'servico').reduce((acc: number, i: any) => acc + i.total_price, 0) || 0;

  const empresaNome = company?.nome_fantasia || "Centro Automotivo";
  const empresaCnpj = company?.cnpj || "CNPJ não cadastrado";
  const empresaEnd = company?.endereco || "Endereço da Oficina";
  const empresaTel = company?.telefone || "(00) 0000-0000";

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white text-black font-sans text-xs flex flex-col items-center">
      {/* BARRA DE CONTROLE */}
      <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft size={16} /> Voltar
        </button>
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg transition"
        >
          <Printer size={16} /> IMPRIMIR (A5 em A4)
        </button>
      </div>

      {/* FOLHA A4 - O CONTEÚDO OCUPA SÓ A METADE (A5) */}
      <div className="w-full max-w-[210mm] bg-white shadow-xl print:shadow-none print:w-full print:h-[297mm] p-0 text-[10px] sm:text-xs">

        {/* CAIXA DE CONTEÚDO COM ALTURA MÁXIMA A5 (148mm) - Flexibildade vertical */}
        <div className="w-full h-[140mm] p-[8mm] flex flex-col relative overflow-hidden">
          {/* CABEÇALHO */}
          <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
            <div className="flex items-center gap-3 w-2/3">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="w-[80px] h-auto object-contain max-h-16" />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center border border-gray-300">
                  <span className="text-[10px] text-gray-500 font-bold uppercase text-center leading-tight">Logo<br />Oficina</span>
                </div>
              )}
              <div>
                <h1 className="font-bold text-sm uppercase">{empresaNome}</h1>
                <p className="text-[9px] text-gray-600">CNPJ: {empresaCnpj}</p>
                <p className="text-[9px] text-gray-600 flex items-center gap-1"><MapPin size={8} /> {empresaEnd}</p>
                <p className="text-[9px] text-gray-600 flex items-center gap-1"><Phone size={8} /> {empresaTel}</p>
              </div>
            </div>
            <div className="text-right w-1/3">
              <h2 className="font-bold text-lg">OS #{os.id.toString().slice(0, 6)}</h2>
              <p className="text-[9px] font-bold mt-1 uppercase bg-gray-100 border border-gray-300 inline-block px-1.5 py-0.5 rounded">
                {os.status === 'in_progress' ? 'EM ANDAMENTO' : os.status}
              </p>
              <p className="text-[9px] mt-1 text-gray-500">{new Date(os.created_at).toLocaleDateString()} {new Date(os.created_at).toLocaleTimeString().slice(0, 5)}</p>
            </div>
          </div>

          {/* CLIENTE, VEÍCULO E STATUS TÉCNICO COMPACTO */}
          <div className="border-2 border-black rounded-lg p-2 mb-2">
            <div className="flex gap-4 items-center">
              {/* Cliente */}
              <div className="flex-1 border-r border-gray-300 pr-2">
                <p className="font-bold text-[8px] uppercase text-gray-500 mb-0.5">CLIENTE</p>
                <p className="font-bold truncate text-[10px] leading-tight">{os.clients?.nome}</p>
                <div className="flex gap-2">
                  <p className="text-[8px] text-gray-600 leading-tight">CPF/CNPJ: {os.clients?.cpf_cnpj || "N/I"}</p>
                  <p className="text-[8px] text-gray-600 leading-tight">Tel: {os.clients?.whatsapp || "N/I"}</p>
                </div>
              </div>

              {/* Veículo */}
              <div className="flex-1 border-r border-gray-300 px-2">
                <p className="font-bold text-[8px] uppercase text-gray-500 mb-0.5">VEÍCULO</p>
                <p className="font-bold truncate text-[10px] leading-tight flex items-center gap-2">
                  {os.vehicles?.modelo}
                  <span className="font-mono bg-gray-100 px-1 border border-gray-200 rounded text-[8px]">{os.vehicles?.placa || "S/ PLACA"}</span>
                </p>
                <p className="text-[8px] text-gray-600 leading-tight mt-0.5">Cor: {os.vehicles?.cor || "-"}</p>
              </div>

              {/* Detalhes Técnicos */}
              <div className="pl-2 w-32 flex flex-col justify-center">
                <p className="text-[9px] text-gray-800 leading-relaxed"><strong className="text-gray-500 uppercase text-[8px]">KM:</strong> {os.odometro ? Number(os.odometro).toLocaleString('pt-BR') : '-'}</p>
                <p className="text-[9px] text-gray-800 leading-relaxed"><strong className="text-gray-500 uppercase text-[8px]">Combus.:</strong> {os.nivel_combustivel ? os.nivel_combustivel.toUpperCase() : '-'}</p>
              </div>
            </div>
          </div>

          {/* TEXTOS DIRETOS: Relato, Defeitos, Serviços SUPER COMPACTOS */}
          <div className="border-2 border-black rounded-lg p-2 mb-3 space-y-1">
            <p className="text-[9px] leading-tight text-gray-800 flex gap-1">
              <span className="font-bold text-[8px] uppercase text-gray-500 whitespace-nowrap">RELATO DO CLIENTE / DEFEITO INFORMADO:</span>
              <span className="font-medium whitespace-pre-wrap leading-tight">{os.description || ""}</span>
            </p>

            <p className="text-[9px] leading-tight text-gray-800 flex flex-wrap gap-1">
              <span className="font-bold text-[8px] uppercase text-gray-500 whitespace-nowrap">DEFEITOS CONSTATADOS PELA OFICINA:</span>
              <span className="font-medium whitespace-pre-wrap leading-tight">{os.defeitos_constatados || ""}</span>
            </p>

            <p className="text-[9px] leading-tight text-gray-800 flex flex-wrap gap-1">
              <span className="font-bold text-[8px] uppercase text-gray-500 whitespace-nowrap">SERVIÇOS EXECUTADOS:</span>
              <span className="font-medium whitespace-pre-wrap leading-tight">{os.servicos_executados || ""}</span>
            </p>
          </div>

          {/* TABELA DE ITENS (Peças e Serviços) */}
          <div className="mb-4">
            <p className="font-bold text-[9px] uppercase text-black mb-1">PRODUTOS E SERVIÇOS APLICADOS</p>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="border-y-2 border-black text-left uppercase text-[8px] font-bold text-gray-600">
                  <th className="py-1 w-6">TIPO</th>
                  <th className="py-1">DESCRIÇÃO</th>
                  <th className="py-1 text-center w-6">QTD</th>
                  <th className="py-1 text-right w-12">UNIT R$</th>
                  <th className="py-1 text-right w-16">TOTAL R$</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 text-[10px]">
                {os.work_order_items?.length > 0 ? os.work_order_items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-1 text-[8px] text-gray-500 uppercase">{item.type === 'peca' || item.tipo === 'peca' ? 'PÇ' : 'SV'}</td>
                    <td className={`py-1 truncate ${item.peca_cliente ? 'tabular-nums opacity-60' : ''}`}>
                      {item.name} {item.peca_cliente && <span className="font-bold text-[8px] uppercase bg-gray-200 px-1 rounded ml-1">(Cliente)</span>}
                    </td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{item.peca_cliente ? '-' : item.unit_price.toFixed(2)}</td>
                    <td className="py-1 text-right font-bold">{item.peca_cliente ? '-' : item.total_price.toFixed(2)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-[9px] text-gray-400">Nenhum item adicionado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TOTAIS */}
          <div className="flex justify-between items-end gap-4 border-t-2 border-black pt-2 pb-2 mt-auto">
            <div className="text-[9px] text-gray-500">
              <p><strong>Subtotal Peças:</strong> R$ {totalPecas.toFixed(2)}</p>
              <p><strong>Subtotal Serviços:</strong> R$ {totalServicos.toFixed(2)}</p>
            </div>

            <div className="border border-black bg-gray-50 px-3 py-1.5 rounded text-right min-w-[30%]">
              <p className="text-[8px] uppercase font-bold text-gray-600 mb-0.5">TOTAL DA OS</p>
              <p className="font-black text-base text-black">R$ {Number(os.total).toFixed(2)}</p>
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="text-[7px] text-center text-gray-400 mt-2 border-t border-gray-200 pt-2">
            Garantia legal de 90 dias para peças e serviços (Art. 26 CDC). Documento gerado em {new Date().toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding:0; }
          .max-w-[210mm] { max-width: 100% !important; margin: 0 !important; border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}