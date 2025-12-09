"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../src/lib/supabase";
import { 
  Scissors, Printer, ArrowLeft, Fuel, 
  CheckSquare, ShieldCheck, MapPin, Phone 
} from "lucide-react";

export default function ImprimirOS() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [os, setOs] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
        fetchData();
    }
  }, [id]);

 // --- NOVO: Auto-Print e Auto-Close ---
  useEffect(() => {
    if (!loading && os) {
      
      // 1. Prepara o gatilho para fechar DEPOIS que o diálogo sumir
      const handleAfterPrint = () => {
        window.close();
      };

      window.addEventListener("afterprint", handleAfterPrint);

      // 2. Chama a impressora com pequeno delay visual
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      // Limpeza de memória
      return () => {
        clearTimeout(timer);
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }
  }, [loading, os]);
  // ---------------------------------------
  
  const fetchData = async () => {
    try {
      // 1. Busca a OS e dados relacionados
      const { data: osData, error: osError } = await supabase
        .from('work_orders')
        .select(`
          *,
          vehicles ( * ),
          clients ( * ),
          work_order_items ( * )
        `)
        .eq('id', id)
        .single();

      if (osError) throw osError;
      setOs(osData);

      // 2. Busca dados da Empresa (Pega o primeiro registro encontrado)
      const { data: companyData } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();
      
      // Se tiver dados no banco, usa. Se não, usa um objeto vazio (vai cair no fallback visual)
      setCompany(companyData || {});
    } catch (error: any) {
      console.error(error);
      alert("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-10 text-center font-sans">Carregando documento...</div>;
  if (!os) return <div className="p-10 text-center font-sans text-red-500">Documento não encontrado.</div>;

  // Lógica do Status
  const isFinalizado = ['pronto', 'entregue', 'pago'].includes(os.status?.toLowerCase());
  
  // --- CORREÇÃO AQUI: Usando 'tipo', 'peca' e 'servico' conforme o banco ---
  const totalPecas = os.work_order_items?.filter((i:any) => i.tipo === 'peca').reduce((acc:number, i:any) => acc + i.total_price, 0) || 0;
  const totalServicos = os.work_order_items?.filter((i:any) => i.tipo === 'servico').reduce((acc:number, i:any) => acc + i.total_price, 0) || 0;

  // Dados da Empresa (Prioriza o banco, se não tiver, usa texto genérico)
  const empresaNome = company?.nome_fantasia || "Centro Automotivo";
  const empresaCnpj = company?.cnpj || "CNPJ não cadastrado";
  const empresaEnd = company?.endereco || "Endereço da Oficina";
  const empresaTel = company?.telefone || "(00) 0000-0000";

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:p-0 print:bg-white text-black font-sans text-sm">
      
      {/* BARRA DE CONTROLE (Oculta na impressão) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-black">
          <ArrowLeft size={20} /> Voltar
        </button>
        <div className="flex items-center gap-4">
          <div className="text-sm text-right">
              <p className="font-bold text-gray-800">{isFinalizado ? "RECIBO" : "AUTORIZAÇÃO"}</p>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-lg transition"
          >
            <Printer size={20} /> IMPRIMIR
          </button>
        </div>
      </div>

      {/* FOLHA A4 */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white shadow-xl print:shadow-none print:w-full p-[10mm] flex flex-col justify-between">
        
        {/* =======================
            PARTE 1: TÉCNICA (OS)
           ======================= */}
        <div className="flex-1 flex flex-col">
          
          {/* Cabeçalho */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
             <div className="flex items-center gap-4">
                {/* LOGO: Usa tag img simples para garantir print */}
                <img 
                    src="/logo.svg" 
                    alt="Logo" 
                    className="w-24 h-auto object-contain"
                    style={{ maxWidth: '100px' }} 
                />
                
                <div>
                    <h1 className="font-bold text-lg uppercase">{empresaNome}</h1>
                    <p className="text-xs text-gray-600">CNPJ: {empresaCnpj}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1"><MapPin size={10}/> {empresaEnd}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1"><Phone size={10}/> {empresaTel}</p>
                </div>
             </div>
             <div className="text-right">
                <h2 className="font-bold text-3xl">OS #{os.id.toString().slice(0,6)}</h2>
                <p className="text-xs font-bold mt-1 uppercase bg-gray-100 border border-gray-300 inline-block px-2 py-0.5 rounded">
                    {os.status === 'in_progress' ? 'EM ANDAMENTO' : os.status}
                </p>
                <p className="text-xs mt-1 text-gray-500">{new Date(os.created_at).toLocaleDateString()} {new Date(os.created_at).toLocaleTimeString().slice(0,5)}</p>
             </div>
          </div>

          {/* Cliente e Veículo */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="border border-gray-300 rounded p-2">
                <p className="font-bold text-[10px] uppercase text-gray-400 mb-1">CLIENTE</p>
                <p className="font-bold truncate">{os.clients?.nome}</p>
                <p className="text-xs text-gray-600">{os.clients?.cpf_cnpj}</p>
                <p className="text-xs text-gray-600">{os.clients?.whatsapp}</p>
            </div>
            <div className="border border-gray-300 rounded p-2">
                <p className="font-bold text-[10px] uppercase text-gray-400 mb-1">VEÍCULO</p>
                <p className="font-bold truncate">{os.vehicles?.modelo}</p>
                <div className="flex gap-2 text-xs mt-1">
                    <span className="font-mono bg-gray-100 px-1 border border-gray-200 rounded">{os.vehicles?.placa || "S/ PLACA"}</span>
                    <span>Cor: {os.vehicles?.cor || "-"}</span>
                    <span>KM: {os.km_atual || "-"}</span>
                </div>
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="flex-1 mb-4">
             <table className="w-full text-xs">
                <thead>
                    <tr className="border-b-2 border-black text-left uppercase text-[10px] font-bold text-gray-600">
                        <th className="py-2">Descrição</th>
                        <th className="py-2 text-center w-16">Qtd</th>
                        <th className="py-2 text-right w-24">Unit.</th>
                        <th className="py-2 text-right w-24">Total</th>
                    </tr>
                </thead>
                <tbody className="text-gray-800">
                    {os.work_order_items?.map((item:any, idx:number) => (
                        <tr key={idx} className="border-b border-gray-100">
                           {/* --- CORREÇÃO AQUI: Verificação de tipo --- */}
                           <td className="py-2">{item.name} <span className="text-[9px] text-gray-400 uppercase ml-1">({item.tipo === 'peca' ? 'Peça' : 'Serviço'})</span></td>
                            <td className="py-2 text-center">{item.quantity}</td>
                            <td className="py-2 text-right">{item.unit_price.toFixed(2)}</td>
                            <td className="py-2 text-right font-bold">{item.total_price.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>

          {/* Totais (Economia de Toner: Fundo Branco, Borda Preta) */}
          <div className="flex justify-end items-end gap-6 border-t-2 border-black pt-3 mb-2">
             <div className="text-right text-xs text-gray-500 space-y-1">
                 <p>Peças: R$ {totalPecas.toFixed(2)}</p>
                 <p>Mão de Obra: R$ {totalServicos.toFixed(2)}</p>
             </div>
             
             {/* CAIXA DO TOTAL: Borda forte, fundo branco */}
             <div className="border-2 border-black px-4 py-2 rounded text-right">
                 <p className="text-[10px] uppercase font-bold text-gray-600 leading-none mb-1">Total Geral</p>
                 <p className="font-bold text-2xl leading-none">R$ {Number(os.total).toFixed(2)}</p>
             </div>
          </div>
        </div>

        {/* =======================
            LINHA DE CORTE
           ======================= */}
        <div className="py-8 flex items-center gap-4 text-gray-400 select-none overflow-hidden">
            <div className="h-px bg-gray-300 flex-1 border-t-2 border-dashed border-gray-400"></div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase whitespace-nowrap text-gray-500">
                <Scissors size={14} className="rotate-180" /> Destacar Via do Cliente
            </div>
            <div className="h-px bg-gray-300 flex-1 border-t-2 border-dashed border-gray-400"></div>
        </div>


        {/* =======================
            PARTE 2: CAMALEÃO
           ======================= */}
        <div className="flex-1 border-2 border-gray-200 rounded-xl p-5 flex flex-col relative bg-gray-50/30">
            
           {/* Cabeçalho Recibo */}
           <div className="flex justify-between items-start mb-4">
              <div>
                 <h2 className="font-bold text-lg uppercase tracking-tight">
                    {isFinalizado ? "RECIBO DE PAGAMENTO" : "AUTORIZAÇÃO DE SERVIÇO"}
                 </h2>
                 <p className="text-xs text-gray-500 mt-1">
                    Vinculado à OS <strong>#{os.id.toString().slice(0,8)}</strong>
                 </p>
              </div>
              <div className="text-right">
                  <p className="text-[10px] uppercase text-gray-500">Valor Documento</p>
                  <p className="font-bold text-xl">R$ {Number(os.total).toFixed(2)}</p>
              </div>
           </div>

           {/* Texto Legal */}
           <div className="flex-1 text-xs text-justify leading-relaxed text-gray-800">
              {isFinalizado ? (
                // === LAYOUT FINALIZADO (RECIBO) ===
                <>
                    <p className="mb-4">
                        Recebemos de <strong>{os.clients?.nome}</strong>, CPF/CNPJ <strong>{os.clients?.cpf_cnpj || "N/I"}</strong>, 
                        a importância supra citada, referente aos serviços prestados e peças aplicadas no veículo 
                        <strong> {os.vehicles?.modelo} </strong> placa <strong>{os.vehicles?.placa}</strong>.
                    </p>
                    <p className="mb-6">
                        Damos plena e geral quitação pelos serviços descritos acima.
                    </p>
                    
                    {/* Garantia (Economia de Toner: Borda Cinza fina) */}
                    <div className="p-3 border border-gray-300 rounded mb-4 bg-white">
                        <p className="font-bold flex items-center gap-1 mb-1 text-black text-[10px]">
                            <ShieldCheck size={12}/> TERMO DE GARANTIA
                        </p>
                        <p className="text-gray-500 leading-tight text-[9px]">
                            Garantia legal de 90 dias para peças e serviços (Art. 26 CDC). 
                            A garantia perde validade em caso de mau uso, colisão ou intervenção de terceiros.
                        </p>
                    </div>

 <div className="flex justify-end items-end mt-16">
                       <div className="text-center">
                            <div className="border-b border-black w-40 mb-1"></div>
                            <p className="text-[9px] uppercase font-bold">{empresaNome}</p>
                       </div>
                    </div>
                </>
              ) : (
                // === LAYOUT ENTRADA (AUTORIZAÇÃO) ===
                <>
                    <p className="mb-4">
                        Eu, <strong>{os.clients?.nome}</strong>, autorizo a <strong>{empresaNome}</strong> a realizar a 
                        desmontagem, diagnóstico e execução dos serviços no veículo de minha responsabilidade.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="border border-gray-300 p-2 bg-white rounded">
                            <p className="font-bold text-[10px] mb-2 flex items-center gap-1"><Fuel size={10}/> Combustível</p>
                            <div className="flex justify-between px-1 text-[8px] text-gray-400 mb-1">
                                <span>E</span><span>1/4</span><span>1/2</span><span>3/4</span><span>F</span>
                            </div>
                            <div className="h-2 w-full border border-gray-300 rounded-full relative">
                                {/* Marcadores vazios para preencher com caneta */}
                                <div className="absolute left-0 top-[-2px] w-3 h-3 rounded-full border border-black bg-white"></div>
                                <div className="absolute left-1/4 top-[-2px] w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
                                <div className="absolute left-1/2 top-[-2px] w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
                                <div className="absolute left-3/4 top-[-2px] w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
                                <div className="absolute right-0 top-[-2px] w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
                            </div>
                        </div>
                        <div className="border border-gray-300 p-2 bg-white rounded text-[10px]">
                             <p className="font-bold mb-1 flex items-center gap-1"><CheckSquare size={10}/> Declarações</p>
                             <div className="flex gap-2 items-center mb-1"><div className="w-3 h-3 border border-black"></div> Pertences retirados</div>
                             <div className="flex gap-2 items-center"><div className="w-3 h-3 border border-black"></div> Estepe/Macaco OK</div>
                        </div>
                    </div>

                    <div className="flex justify-center items-end mt-8">
                        <div className="text-center">
                            <div className="border-b border-black w-64 mb-1"></div>
                            <p className="font-bold uppercase text-[10px]">Assinatura do Cliente</p>
                        </div>
                    </div>
                </>
              )}
           </div>

        </div>

      </div>
      
      <style jsx global>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background: white; -webkit-print-color-adjust: exact; }
          /* Força a logo a aparecer em alguns browsers */
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}