"use client";



import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/src/contexts/AuthContext";



import { emitirNFCe, emitirNFSe } from "@/src/actions/fiscal_emission";

import {

    ArrowLeft, FileText, Loader2, CheckCircle,

    ShoppingCart, Wrench, User, Trash2, Plus, MapPin, Search, X, Sparkles

} from "lucide-react";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { getPendingWorkOrders, searchProducts, searchServices, getProductFiscalData, getServiceFiscalData, updateProductNCM } from "@/src/actions/fiscal_db";
import { getCompanySettings } from "@/src/actions/fiscal";
import { useBillingEmissionBlock } from "@/src/lib/useBillingEmissionBlock";



// Tipos

type PendingOS = {

    id: number;

    client_id: string;

    created_at: string;

    total: number;

    status: string;

    clients: { nome: string; cpf_cnpj?: string } | null;

    vehicles: { placa: string; modelo: string } | null;

    pending_documentos?: string[];

};



type InvoiceItem = {

    codigo: string;

    descricao: string;

    ncm: string;

    cfop: string;

    unidade: string;

    quantidade: number;

    valor_unitario: number;

    valor_total: number;

    tipo_origem: 'peca' | 'servico' | 'avulso';

};



export default function EmitirNotaPage() {

    const { profile } = useAuth();
    const { isLoading: billingLoading, isBlocked: billingBlocked, message: billingMessage } = useBillingEmissionBlock();

    const router = useRouter();

    const searchParams = useSearchParams();

    const environment = (searchParams.get('env') as 'production' | 'homologation') || 'production';
    const isHomologation = environment === 'homologation';

    const defaultTomadorHomologacao = {
        nome: "",
        cpf_cnpj: "",
        endereco: {
            cep: "",
            logradouro: "",
            numero: "",
            bairro: "",
            cidade: "",
            uf: "",
            codigo_municipio: ""
        }
    };
    const defaultTomadorProducao = {
        nome: "",
        cpf_cnpj: "",
        endereco: {
            cep: "",
            logradouro: "",
            numero: "",
            bairro: "",
            cidade: "",
            uf: "",
            codigo_municipio: ""
        }
    };



    // Estados

    const [step, setStep] = useState<1 | 2>(1);

    const [loadingOS, setLoadingOS] = useState(true);

    const [pendingOS, setPendingOS] = useState<PendingOS[]>([]);
    const [visibleOsCount, setVisibleOsCount] = useState(30);

    const [selectedOS, setSelectedOS] = useState<PendingOS | null>(null);

    const [osSearch, setOsSearch] = useState("");

    const [osStartDate, setOsStartDate] = useState("");

    const [osEndDate, setOsEndDate] = useState("");



    // Formulário de Emissão

    // HARDCODED TEST DATA FOR EASIER TESTING
    const [clienteNome, setClienteNome] = useState(
        isHomologation ? defaultTomadorHomologacao.nome : defaultTomadorProducao.nome
    );
    const [clienteDoc, setClienteDoc] = useState(
        isHomologation ? defaultTomadorHomologacao.cpf_cnpj : defaultTomadorProducao.cpf_cnpj
    );
    const [clienteEndereco, setClienteEndereco] = useState<any>(
        isHomologation ? defaultTomadorHomologacao.endereco : defaultTomadorProducao.endereco
    );

    const [itens, setItens] = useState<InvoiceItem[]>([]);
    const [itensServico, setItensServico] = useState<any[]>([]);
    const [produtoDocumento, setProdutoDocumento] = useState<"NFCe" | "NFe">("NFCe");
    const [emitenteUF, setEmitenteUF] = useState("");

    const [emitting, setEmitting] = useState(false);
    const [loadingCep, setLoadingCep] = useState(false);

    const [focusedField, setFocusedField] = useState<{ type: 'prod' | 'serv', idx: number } | null>(null);

    const [fetchingNCM, setFetchingNCM] = useState<number | null>(null);
    const [ncmModalData, setNcmModalData] = useState<{ idx: number, options: { code: string, description: string }[] } | null>(null);
    const osLoadMoreRef = useRef<HTMLDivElement | null>(null);
    const destinatarioUF = String(clienteEndereco?.uf || "").trim().toUpperCase();
    const isNFeVendaRapida = produtoDocumento === "NFe";
    const shouldValidateNFeVendaRapida = isNFeVendaRapida && itens.length > 0;
    const nfeDestinoLabel = !isNFeVendaRapida
        ? ""
        : !destinatarioUF || !emitenteUF
            ? "Aguardando UF do destinatario"
            : destinatarioUF === emitenteUF
                ? "Venda interna"
                : "Venda interestadual";
    const nfeCfopRigido = destinatarioUF && emitenteUF && destinatarioUF !== emitenteUF ? "6102" : "5102";

    const getNFeVendaRapidaPendencias = () => {
        if (!shouldValidateNFeVendaRapida) return [];

        const pendencias: string[] = [];
        const endereco = clienteEndereco || {};
        const docDigits = String(clienteDoc || "").replace(/\D/g, "");

        if (!clienteNome.trim()) pendencias.push("Informe o nome do destinatario.");
        if (docDigits.length !== 11 && docDigits.length !== 14) pendencias.push("Informe CPF/CNPJ valido do destinatario.");
        if (!endereco.cep || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !endereco.uf || !endereco.codigo_municipio) {
            pendencias.push("Complete o endereco do destinatario para emitir NF-e.");
        }
        if (!emitenteUF) pendencias.push("UF da empresa emissora nao carregada.");
        if (itens.some(i => !/^\d{8}$/.test(String(i.ncm || "")) || i.ncm === "00000000")) {
            pendencias.push("Todos os produtos precisam ter NCM valido.");
        }

        return pendencias;
    };

    const getNFSePendencias = () => {
        if (itensServico.length === 0) return [];

        const pendencias: string[] = [];
        const docDigits = String(clienteDoc || "").replace(/\D/g, "");

        if (!clienteNome.trim()) pendencias.push("Informe o nome do tomador para emitir NFS-e.");
        if (docDigits.length !== 11 && docDigits.length !== 14) {
            pendencias.push("NFS-e exige CPF/CNPJ valido do tomador.");
        }

        return pendencias;
    };

    const buscarCep = async (cepValue = clienteEndereco?.cep || "") => {
        const cleanCep = String(cepValue).replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        setLoadingCep(true);
        try {
            const res = await fetch(`/api/cep?cep=${cleanCep}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "CEP não encontrado.");

            setClienteEndereco((current: any) => ({
                ...current,
                cep: data.cep || cepValue,
                logradouro: data.logradouro || "",
                bairro: data.bairro || "",
                cidade: data.cidade || "",
                uf: data.uf || "",
                codigo_municipio: data.codigo_municipio || "",
            }));
        } catch (error: any) {
            alert(error.message || "Erro ao buscar CEP.");
        } finally {
            setLoadingCep(false);
        }
    };

    const finalizeNCM = async (idx: number, ncm: string, persistInCatalog = false) => {
        const item = itens[idx];
        const newItens = [...itens];
        newItens[idx].ncm = ncm;
        setItens(newItens);

        // Persistência automática: só não salva se for "avulso" que o user criou agora com código genérico "NEW"
        if (persistInCatalog && item.codigo && item.codigo !== 'GEN' && item.codigo !== 'NEW') {
            const saveRes = await updateProductNCM(item.codigo, ncm);
            if (saveRes.success) {
                console.log(`NCM ${ncm} salvo no BD para o produto ${item.codigo}.`);
            }
        }
        
        setNcmModalData(null);
    };

    const handleFetchNCM = async (index: number) => {
        const item = itens[index];
        if (!item?.descricao) {
            alert("Preencha a descrição do produto antes de buscar o NCM.");
            return;
        }

        setFetchingNCM(index);
        try {
            const res = await fetch('/api/fiscal/ncm-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descricao: item.descricao })
            });
            const data = await res.json();
            const shouldPersistFromAi = !data.error && data.needs_review === false;
            
            if (data.options && data.options.length > 1) {
                // Múltiplas opções encontradas, abrir modal
                setNcmModalData({ idx: index, options: data.options });
            } else if (data.recommendation) {
                // Direto à única recomendação
                await finalizeNCM(index, data.recommendation, shouldPersistFromAi);
            } else if (data.options?.[0]?.code) {
                // Sem recommendation, mas com uma opção válida
                await finalizeNCM(index, data.options[0].code, shouldPersistFromAi);
            } else if (data.ncm) {
                // Fallback legado (garantia caso o JSON quebre e volte apenas `ncm: val`)
                await finalizeNCM(index, data.ncm, shouldPersistFromAi);
            } else {
                alert(data.error || "A IA não conseguiu encontrar um NCM válido para esta descrição.");
            }
        } catch (e: any) {
            alert("Erro ao buscar NCM com IA: " + e.message);
        } finally {
            setFetchingNCM(null);
        }
    };





    // Carga Inicial

    useEffect(() => {

        if (profile?.organization_id) {

            loadPendingOS();

        }

    }, [profile]);

    useEffect(() => {
        const loadCompanyUf = async () => {
            const settings = await getCompanySettings();
            setEmitenteUF(String(settings?.uf || "").trim().toUpperCase());
        };

        loadCompanyUf();
    }, []);

    useEffect(() => {
        if (!isHomologation) return;
        if (clienteNome || clienteDoc) return;

        setClienteNome(defaultTomadorHomologacao.nome);
        setClienteDoc(defaultTomadorHomologacao.cpf_cnpj);
        setClienteEndereco(defaultTomadorHomologacao.endereco);
    }, [isHomologation, clienteNome, clienteDoc]);

    useEffect(() => {
        if (isHomologation) return;
        if (clienteNome || clienteDoc) return;

        setClienteNome(defaultTomadorProducao.nome);
        setClienteDoc(defaultTomadorProducao.cpf_cnpj);
        setClienteEndereco(defaultTomadorProducao.endereco);
    }, [isHomologation, clienteNome, clienteDoc]);




    const loadPendingOS = async () => {

        setLoadingOS(true);

        try {

            if (profile?.organization_id) {

                const data = await getPendingWorkOrders(profile.organization_id);

                setPendingOS(data as unknown as PendingOS[]);

            }

        } catch (e) {

            console.error(e);

        } finally {

            setLoadingOS(false);

        }

    };



    const handleSelectOS = async (os: PendingOS) => {

        setSelectedOS(os);

        setClienteNome(os.clients?.nome || "");

        setClienteDoc(os.clients?.cpf_cnpj || "");

        setClienteEndereco({
            cep: "",
            logradouro: "",
            numero: "",
            bairro: "",
            cidade: "",
            uf: "",
            codigo_municipio: ""
        });



        // Buscar endereço completo do cliente

        if (os.client_id) {

            const { createClient } = await import("@/src/lib/supabase");

            const supabase = createClient();

            const { data: clientData } = await supabase

                .from('clients')

                .select('endereco')

                .eq('id', os.client_id)

                .single();



            if (clientData?.endereco) {
                const endereco = clientData.endereco;

                setClienteEndereco({

                    logradouro: endereco.logradouro || endereco.rua || "",

                    numero: endereco.numero || "",

                    bairro: endereco.bairro || "",

                    cidade: endereco.cidade || "",

                    uf: endereco.uf || "",

                    codigo_municipio: endereco.codigo_municipio || "",

                    cep: endereco.cep || ""

                });

            }

        }



        // Buscar itens da OS

        const { createClient } = await import("@/src/lib/supabase");

        const supabase = createClient();

        const { data: existingInvoices } = await supabase

            .from('fiscal_invoices')

            .select('tipo_documento, status')

            .eq('work_order_id', os.id)

            .eq('status', 'authorized');

        const hasExistingProductInvoice = (existingInvoices || []).some((invoice: any) => invoice.tipo_documento === 'NFCe' || invoice.tipo_documento === 'NFe');

        const hasExistingNFSe = (existingInvoices || []).some((invoice: any) => invoice.tipo_documento === 'NFSe');

        const { data: osItems } = await supabase

            .from('work_order_items')

            .select('*')

            .eq('work_order_id', os.id);



        if (osItems) {

            const pecas: InvoiceItem[] = [];

            const servicos: any[] = [];



            // Processar itens em paralelo para buscar dados fiscais atualizados

            await Promise.all(osItems.map(async (item: any) => {

                if (item.tipo === 'peca') {

                    if (item.peca_cliente || hasExistingProductInvoice) return;

                    let fiscalData = { ncm: '00000000', cfop: '5102', unidade: 'UN' };



                    if (item.product_id) {

                        const dbData = await getProductFiscalData(item.product_id);

                        if (dbData) {

                            fiscalData = {

                                ncm: dbData.ncm || '00000000',

                                cfop: dbData.cfop || '5102',

                                unidade: dbData.unidade || 'UN'

                            };

                        }

                    }



                    pecas.push({

                        codigo: item.product_id || 'GEN',

                        descricao: item.name,

                        ncm: fiscalData.ncm,

                        cfop: fiscalData.cfop,

                        unidade: fiscalData.unidade,

                        quantidade: item.quantity,

                        valor_unitario: item.unit_price,

                        valor_total: item.total_price,

                        tipo_origem: 'peca'

                    });

                } else {

                    if (hasExistingNFSe) return;

                    // Para serviços, buscar código e alíquota

                    let fiscalData = { codigo_servico: '140101', aliquota_iss: 2.01 };

                    if (item.product_id) { // product_id aqui é o ID do serviço na tabela services

                        const dbData = await getServiceFiscalData(item.product_id);

                        if (dbData) {

                            fiscalData = {

                                codigo_servico: dbData.codigo_servico || '140101',

                                aliquota_iss: dbData.aliquota_iss || 2.01

                            };

                        }

                    }



                    servicos.push({

                        ...item,

                        codigo_servico: fiscalData.codigo_servico,

                        aliquota_iss: fiscalData.aliquota_iss

                    });

                }

            }));



            setItens(pecas);

            setItensServico(servicos);

        }



        setStep(2);

    };



    const handleAvulsa = () => {

        setSelectedOS(null);

        // Mantém os dados preenchidos para teste

        setStep(2);

    };



    const filteredPendingOS = pendingOS.filter((os) => {

        const haystack = [

            String(os.id),

            os.clients?.nome || "",

            os.vehicles?.modelo || "",

            os.vehicles?.placa || "",

        ].join(" ").toLowerCase();

        const matchesSearch = !osSearch || haystack.includes(osSearch.toLowerCase());

        const osDate = new Date(os.created_at);

        let matchesDate = true;

        if (osStartDate) {

            matchesDate = osDate >= new Date(osStartDate + "T00:00:00");

        }

        if (osEndDate && matchesDate) {

            matchesDate = osDate <= new Date(osEndDate + "T23:59:59");

        }

        return matchesSearch && matchesDate;

    });

    const visiblePendingOS = filteredPendingOS.slice(0, visibleOsCount);
    const hasMorePendingOS = visiblePendingOS.length < filteredPendingOS.length;

    useEffect(() => {
        setVisibleOsCount(30);
    }, [osSearch, osStartDate, osEndDate, pendingOS]);

    useEffect(() => {
        if (step !== 1) return;
        if (!hasMorePendingOS) return;

        const target = osLoadMoreRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                setVisibleOsCount((current) => Math.min(current + 30, filteredPendingOS.length));
            },
            { rootMargin: "240px 0px" }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [step, hasMorePendingOS, filteredPendingOS.length]);



    const handleEmitir = async () => {

        if (!profile?.organization_id) return;

        if (itens.length === 0 && itensServico.length === 0) return alert("Adicione pelo menos um item ou serviço.");



        const nfePendencias = getNFeVendaRapidaPendencias();
        if (nfePendencias.length > 0) {
            alert(`NF-e rapida de venda bloqueada:\n${nfePendencias.join("\n")}`);
            return;
        }

        setEmitting(true);

        try {

            const results = [];



            // 1. Emissão de produtos (NFC-e ou NF-e)

            if (itens.length > 0) {

                const totalProdutos = itens.reduce((acc, item) => acc + item.valor_total, 0);

                const produtosPayload = {

                    organization_id: profile.organization_id,

                    work_order_id: selectedOS?.id,

                    cliente: {
                        nome: clienteNome,
                        cpf_cnpj: clienteDoc,
                        endereco: clienteEndereco,
                    },

                    itens: itens,

                    valor_total: totalProdutos,

                    meio_pagamento: '01',

                    environment

                };

                const resProdutos = await emitirNFCe({
                    ...produtosPayload,
                    tipo_documento: produtoDocumento,
                });

                results.push({ type: produtoDocumento === "NFe" ? 'NF-e' : 'NFC-e', ...resProdutos });

            }



            // 2. Emissão de NFS-e (Serviços)

            if (itensServico.length > 0) {
                const nfsePendencias = getNFSePendencias();
                if (nfsePendencias.length > 0) {
                    results.push({
                        type: 'NFS-e',
                        success: false,
                        error: nfsePendencias.join(' ')
                    });
                } else {

                    const totalServicos = itensServico.reduce((acc, item) => acc + item.total_price, 0);

                    const servicosPayload = itensServico.map(s => ({

                        codigo: s.product_id || 'SERV',

                        descricao: s.name,

                        ncm: '00000000',

                        cfop: '0000',

                        unidade: 'UN',

                        quantidade: s.quantity,

                        valor_unitario: s.unit_price,

                        valor_total: s.total_price,

                        codigo_servico: s.codigo_servico, // Passando dados fiscais

                        aliquota_iss: s.aliquota_iss

                    }));



                    const resNFSe = await emitirNFSe({

                        organization_id: profile.organization_id,

                        work_order_id: selectedOS?.id,

                        cliente: {

                            nome: clienteNome,

                            cpf_cnpj: clienteDoc,

                            endereco: clienteEndereco.logradouro ? clienteEndereco : {

                                logradouro: "RUA TESTE",

                                numero: "123",

                                bairro: "CENTRO",

                                codigo_municipio: "",

                                cep: ""

                            }

                        },

                        itens: servicosPayload,

                        valor_total: totalServicos,

                        meio_pagamento: '01',

                        environment

                    });

                    results.push({ type: 'NFS-e', ...resNFSe });
                }

            }



            const errors = results.filter(r => !r.success);

            if (errors.length > 0) {

                alert(`Erro na emissão:\n${errors.map(e => `${e.type}: ${e.error}`).join('\n')}`);

            } else {

                alert("Emissão realizada com sucesso!");

                router.push("/fiscal");

            }



        } catch (e: any) {

            alert("Erro: " + e.message);

        } finally {

            setEmitting(false);

        }

    };



    return (

        <div className="max-w-6xl mx-auto pb-16 relative">

            {(billingLoading || billingBlocked) && (
                <div className="absolute inset-0 z-40 rounded-[28px] bg-[#F8F7F2]/96 backdrop-blur-sm flex items-start justify-center px-4 py-24">
                    <div className="w-full max-w-2xl rounded-[28px] border border-red-200 bg-white shadow-xl p-8 text-center">
                        {billingLoading ? (
                            <>
                                <Loader2 className="mx-auto animate-spin text-[#FACC15]" size={30} />
                                <p className="mt-4 text-sm font-bold text-stone-700">Validando bloqueio de cobranca...</p>
                            </>
                        ) : (
                            <>
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                                    <FileText size={24} />
                                </div>
                                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-red-600">Emissao Fiscal Bloqueada</p>
                                <h2 className="mt-2 text-2xl font-bold text-[#1A1A1A]">Nova nota indisponivel para esta loja</h2>
                                <p className="mt-3 text-sm text-stone-600">{billingMessage || "As emissoes fiscais estao temporariamente bloqueadas por atraso na mensalidade."}</p>
                                <div className="mt-6">
                                    <Link href="/fiscal">
                                        <button className="rounded-full bg-[#1A1A1A] px-6 py-3 text-sm font-bold text-[#FACC15] transition hover:bg-black">
                                            Voltar ao Fiscal
                                        </button>
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className={billingBlocked ? "pointer-events-none select-none opacity-40" : ""}>



            {/* HEADER */}

            <div className="flex items-center gap-3 mb-6">

                <Link href="/fiscal">

                    <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-stone-50 text-stone-600"><ArrowLeft size={16} /></button>

                </Link>

                <div>

                    <h1 className="text-xl font-bold text-[#1A1A1A]">Nova Emissão Fiscal</h1>

                    <p className="text-stone-400 text-xs">NFC-e ou NF-e (Produtos) / NFS-e (Serviços)</p>

                </div>

            </div>



            {/* STEP 1: SELEÇÃO */}

            {step === 1 && (

                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">

                    <div className="flex justify-between items-center mb-4">

                        <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><FileText size={16} /> Importar Ordem de Serviço</h3>

                        <button onClick={handleAvulsa} className="text-xs font-bold text-[#FACC15] bg-[#1A1A1A] px-3 py-1.5 rounded-full hover:scale-105 transition">

                            Criar Nota Avulsa

                        </button>

                    </div>



                    <div className="mb-4 flex flex-col lg:flex-row gap-3">

                        <div className="relative flex-1">

                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />

                            <input

                                type="text"

                                value={osSearch}

                                onChange={e => setOsSearch(e.target.value)}

                                placeholder="Buscar por OS, cliente, veículo ou placa..."

                                className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] shadow-sm"

                            />

                        </div>



                        <div className="flex flex-col sm:flex-row gap-3">

                            <input

                                type="date"

                                value={osStartDate}

                                onChange={e => setOsStartDate(e.target.value)}

                                className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] shadow-sm text-stone-600"

                                title="Data inicial"

                            />

                            <input

                                type="date"

                                value={osEndDate}

                                onChange={e => setOsEndDate(e.target.value)}

                                className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FACC15] focus:ring-1 focus:ring-[#FACC15] shadow-sm text-stone-600"

                                title="Data final"

                            />

                            {(osSearch || osStartDate || osEndDate) && (

                                <button

                                    onClick={() => {

                                        setOsSearch("");

                                        setOsStartDate("");

                                        setOsEndDate("");

                                    }}

                                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-bold text-stone-500 hover:bg-stone-50 transition"

                                >

                                    Limpar

                                </button>

                            )}

                        </div>

                    </div>



                    <div className="mb-4 flex items-center justify-between text-xs text-stone-400 font-medium">

                        <span>

                            {visiblePendingOS.length} OS exibida(s)

                            {pendingOS.length !== filteredPendingOS.length ? ` de ${pendingOS.length}` : ""}

                        </span>

                        <span>A lista remove apenas OS com nota autorizada nos status pronto ou entregue.</span>

                    </div>



                    {loadingOS ? (

                        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#FACC15]" size={20} /></div>

                    ) : filteredPendingOS.length === 0 ? (

                        <div className="text-center py-8 text-stone-400 text-sm">

                            <CheckCircle size={28} className="mx-auto mb-2 text-green-200" />

                            <p>{pendingOS.length === 0 ? "Nenhuma OS pendente de nota." : "Nenhuma OS encontrada para os filtros informados."}</p>

                        </div>

                    ) : (

                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

                            {visiblePendingOS.map(os => (

                                <div key={os.id} className="border border-stone-100 p-3 rounded-xl flex justify-between items-center hover:bg-[#F9F8F4] transition cursor-pointer" onClick={() => handleSelectOS(os)}>

                                    <div className="flex items-center gap-3">

                                        <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-500 font-bold text-[10px]">#{os.id}</div>

                                        <div>

                                            <p className="font-bold text-xs text-[#1A1A1A]">{os.vehicles?.modelo} - {os.vehicles?.placa}</p>

                                            <p className="text-[10px] text-stone-500">{os.clients?.nome}</p>

                                            <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                                                Falta: {(os.pending_documentos || []).join(' + ')}
                                            </p>

                                        </div>

                                    </div>

                                    <div className="text-right">

                                        <p className="font-bold text-xs text-[#1A1A1A]">R$ {os.total.toFixed(2)}</p>

                                        <p className="text-[10px] text-stone-400">{new Date(os.created_at).toLocaleDateString()}</p>

                                    </div>

                                </div>

                            ))}

                        </div>

                        <div className="pt-4">
                            {hasMorePendingOS ? (
                                <div ref={osLoadMoreRef} className="py-4 text-center text-xs text-stone-400">
                                    Role para carregar mais 30 OS.
                                </div>
                            ) : filteredPendingOS.length > 30 ? (
                                <div className="py-4 text-center text-xs text-stone-400">
                                    Todas as OS filtradas foram carregadas.
                                </div>
                            ) : null}
                        </div>
                        </>

                    )}

                </div>

            )}



            {/* STEP 2: CONFERÊNCIA E EMISSÃO */}

            {step === 2 && (

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">



                    {/* FORMULRIO (ESQUERDA - 3 colunas) */}

                    <div className="lg:col-span-3 space-y-4">



                        {/* DADOS CLIENTE + ENDEREÇO */}

                        <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">

                            <h3 className="font-bold text-sm text-[#1A1A1A] mb-3 flex items-center gap-2"><User size={14} /> Destinatário</h3>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                                <div className="md:col-span-2">

                                    <label className="text-[10px] font-bold text-stone-400 ml-1">NOME</label>

                                    <input value={clienteNome} onChange={e => setClienteNome(e.target.value)} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" />

                                </div>

                                <div>

                                    <label className="text-[10px] font-bold text-stone-400 ml-1">CPF / CNPJ</label>

                                    <input value={clienteDoc} onChange={e => setClienteDoc(e.target.value)} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" />

                                </div>

                                <div>

                                    <label className="text-[10px] font-bold text-stone-400 ml-1">CEP</label>

                                    <div className="relative">
                                        <input
                                            value={clienteEndereco?.cep || ""}
                                            onChange={e => setClienteEndereco({ ...clienteEndereco, cep: e.target.value })}
                                            onBlur={() => buscarCep()}
                                            className="w-full bg-white border border-stone-300 p-2 pr-9 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all"
                                            placeholder="00000-000"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => buscarCep()}
                                            disabled={loadingCep}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-[#1A1A1A] disabled:opacity-50"
                                            title="Buscar endereço pelo CEP"
                                        >
                                            {loadingCep ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                                        </button>
                                    </div>

                                </div>

                            </div>



                            {/* Endereço Completo */}

                            <div className="mt-3 pt-3 border-t border-stone-50">

                                <h4 className="text-[10px] font-bold text-stone-400 mb-2 ml-1 flex items-center gap-1"><MapPin size={10} /> ENDEREÇO (Obrigatório para NF-e e NFS-e)</h4>

                                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">

                                    <div className="md:col-span-3">

                                        <label className="text-[10px] font-bold text-stone-400 ml-1">LOGRADOURO</label>

                                        <input value={clienteEndereco?.logradouro || ""} onChange={e => setClienteEndereco({ ...clienteEndereco, logradouro: e.target.value })} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" />

                                    </div>

                                    <div>

                                        <label className="text-[10px] font-bold text-stone-400 ml-1">Nº</label>

                                        <input value={clienteEndereco?.numero || ""} onChange={e => setClienteEndereco({ ...clienteEndereco, numero: e.target.value })} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" />

                                    </div>

                                    <div className="md:col-span-2">

                                        <label className="text-[10px] font-bold text-stone-400 ml-1">BAIRRO</label>

                                        <input value={clienteEndereco?.bairro || ""} onChange={e => setClienteEndereco({ ...clienteEndereco, bairro: e.target.value })} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" />

                                    </div>

                                    <div className="md:col-span-2">

                                        <label className="text-[10px] font-bold text-stone-400 ml-1">CIDADE</label>

                                        <input value={clienteEndereco?.cidade || ""} onChange={e => setClienteEndereco({ ...clienteEndereco, cidade: e.target.value })} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" />

                                    </div>

                                    <div>

                                        <label className="text-[10px] font-bold text-stone-400 ml-1">UF</label>

                                        <input value={clienteEndereco?.uf || ""} onChange={e => setClienteEndereco({ ...clienteEndereco, uf: e.target.value })} className="w-full bg-white border border-stone-300 p-2 rounded-lg text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" maxLength={2} />

                                    </div>

                                    <div className="hidden">

                                        <input value={clienteEndereco?.codigo_municipio || ""} readOnly />

                                    </div>

                                </div>

                            </div>

                        </div>



                        {/* PRODUTOS */}

                        <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                                <h3 className="font-bold text-sm text-[#1A1A1A] flex items-center gap-2"><ShoppingCart size={14} /> Produtos ({produtoDocumento === "NFe" ? "NF-e" : "NFC-e"})</h3>
                                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setProdutoDocumento("NFCe")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${produtoDocumento === "NFCe" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-stone-500 hover:text-[#1A1A1A]"}`}
                                    >
                                        NFC-e
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProdutoDocumento("NFe")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${produtoDocumento === "NFe" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-stone-500 hover:text-[#1A1A1A]"}`}
                                    >
                                        NF-e rapida
                                    </button>
                                </div>
                            </div>

                            {shouldValidateNFeVendaRapida && (
                                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <span className="font-bold">Venda com regras rigidas</span>
                                        <span className="font-bold">{nfeDestinoLabel} | CFOP {nfeCfopRigido}</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-amber-800">
                                        O sistema calcula dentro/fora do estado pelo endereco do destinatario e aplica CFOP {nfeCfopRigido} automaticamente na emissao.
                                    </p>
                                </div>
                            )}

                            {produtoDocumento === "NFCe" && (
                                <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <span className="font-bold">NFC-e com CFOP automatico</span>
                                        <span className="font-bold">Baseado na UF do destinatario</span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-sky-800">
                                        Na NFC-e, o CFOP enviado nao depende do cadastro do produto. O sistema calcula 5102/6102 pela UF no momento da emissao.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">

                                {itens.map((item, idx) => (

                                    <div key={idx} className="bg-[#F8F7F2] p-2 rounded-xl">

                                        <div className="grid grid-cols-12 gap-2 items-center">

                                            <div className="col-span-4 relative group">

                                                {/* Combobox de Produto */}

                                                <input

                                                    value={item.descricao}

                                                    onChange={async e => {

                                                        const val = e.target.value;

                                                        const newItens = [...itens];

                                                        newItens[idx].descricao = val;

                                                        setItens(newItens);



                                                        // Lógica simples de autocomplete (pode ser melhorada com componente dedicado)

                                                        // Aqui apenas permitimos digitar, a busca real seria num dropdown

                                                    }}

                                                    className="w-full bg-white p-1.5 rounded-lg text-xs font-medium outline-none border border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all"

                                                    placeholder="Buscar Produto..."

                                                    onFocus={() => setFocusedField({ type: 'prod', idx })}

                                                    onBlur={() => setTimeout(() => setFocusedField(null), 200)}

                                                />

                                                {/* Datalist nativo para simplicidade inicial, ou implementar dropdown customizado */}

                                                <datalist id={`products-list-${idx}`}>

                                                    {/* Opções seriam preenchidas dinamicamente se usássemos estado para busca */}

                                                </datalist>



                                                {/* Botão de Busca Rápida (Simulação de Dropdown Customizado) */}

                                                {focusedField?.type === 'prod' && focusedField?.idx === idx && (

                                                    <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg z-[100] max-h-48 overflow-y-auto border border-stone-100">

                                                        <ProductSearch

                                                            query={item.descricao}

                                                            onSelect={(prod) => {

                                                                const newItens = [...itens];

                                                                newItens[idx].codigo = prod.id;

                                                                newItens[idx].descricao = prod.nome;

                                                                newItens[idx].ncm = prod.ncm || '00000000';

                                                                newItens[idx].cfop = prod.cfop || '5102';

                                                                newItens[idx].unidade = prod.unidade || 'UN';

                                                                newItens[idx].valor_unitario = prod.preco_venda;

                                                                newItens[idx].valor_total = prod.preco_venda * newItens[idx].quantidade;

                                                                setItens(newItens);

                                                            }}

                                                        />

                                                    </div>

                                                )}

                                            </div>

                                            <div className="col-span-2 relative">

                                                <input value={item.ncm} onChange={e => {

                                                    const newItens = [...itens]; newItens[idx].ncm = e.target.value; setItens(newItens);

                                                }} onBlur={async e => {
                                                    const manualNcm = String(e.target.value || "").replace(/\D/g, "").slice(0, 8);
                                                    if (manualNcm.length !== 8) return;
                                                    const currentItem = itens[idx];
                                                    if (!currentItem?.codigo || currentItem.codigo === 'GEN' || currentItem.codigo === 'NEW') return;
                                                    await updateProductNCM(currentItem.codigo, manualNcm);
                                                }} className={`w-full bg-white p-1.5 pr-7 rounded-lg text-xs font-medium outline-none text-center border ${(!item.ncm || item.ncm === '00000000') ? 'border-red-400 bg-red-50' : 'border-stone-300'} focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all`} placeholder="NCM" title={(!item.ncm || item.ncm === '00000000') ? 'NCM obigatório' : ''} />

                                                <button
                                                    onClick={() => handleFetchNCM(idx)}
                                                    disabled={fetchingNCM === idx}
                                                    title="Buscar NCM com IA"
                                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#FACC15] hover:scale-110 transition disabled:opacity-50"
                                                >
                                                    {fetchingNCM === idx ? <Loader2 size={14} className="animate-spin text-stone-400" /> : <Sparkles size={14} />}
                                                </button>

                                            </div>

                                            <div className="col-span-1">

                                                <input type="number" value={item.quantidade} onChange={e => {

                                                    const qtd = Number(e.target.value);

                                                    const newItens = [...itens];

                                                    newItens[idx].quantidade = qtd;

                                                    newItens[idx].valor_total = qtd * newItens[idx].valor_unitario;

                                                    setItens(newItens);

                                                }} className="w-full bg-white p-1.5 rounded-lg text-xs font-medium outline-none text-center border border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all" placeholder="Qtd" />

                                            </div>

                                            <div className="col-span-2">

                                                <input

                                                    type="number"

                                                    step="0.01"

                                                    value={item.valor_unitario}

                                                    onChange={e => {

                                                        const val = Number(e.target.value);

                                                        const newItens = [...itens];

                                                        newItens[idx].valor_unitario = val;

                                                        newItens[idx].valor_total = val * newItens[idx].quantidade;

                                                        setItens(newItens);

                                                    }}

                                                    className="w-full bg-white p-1.5 rounded-lg text-xs font-medium outline-none text-right border border-stone-300 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 shadow-sm transition-all"

                                                    placeholder="Valor Unit."

                                                />

                                            </div>

                                            <div className="col-span-1">

                                                <div className="bg-stone-100 p-1.5 rounded-lg text-xs font-bold text-right">R$ {item.valor_total.toFixed(2)}</div>

                                            </div>

                                            <div className="col-span-2 flex justify-end">

                                                <button onClick={() => {

                                                    const newItens = itens.filter((_, i) => i !== idx); setItens(newItens);

                                                }} className="p-1.5 text-stone-400 hover:text-red-500 transition"><Trash2 size={14} /></button>

                                            </div>

                                        </div>

                                    </div>

                                ))}

                                <button onClick={() => setItens([...itens, { codigo: 'NEW', descricao: '', ncm: '', cfop: '5102', unidade: 'UN', quantidade: 1, valor_unitario: 0, valor_total: 0, tipo_origem: 'avulso' }])} className="w-full py-2 border-2 border-dashed border-stone-200 rounded-xl text-stone-400 text-xs font-bold hover:bg-stone-50 transition flex items-center justify-center gap-1">

                                    <Plus size={14} /> Adicionar Produto

                                </button>

                            </div>

                        </div>



                        {/* SERVIÇOS (NFS-e) */}

                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">

                            <div className="flex justify-between items-center mb-3">

                                <h3 className="font-bold text-sm text-blue-700 flex items-center gap-2"><Wrench size={14} /> Serviços (NFS-e)</h3>

                                <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded">AUTOMTICO</span>

                            </div>

                            <div className="space-y-2">

                                {itensServico.map((item, idx) => (

                                    <div key={idx} className="bg-white p-2 rounded-xl border border-blue-100">

                                        <div className="grid grid-cols-12 gap-2 items-center">

                                            <div className="col-span-8 relative group">

                                                <input value={item.name} onChange={e => {

                                                    const newItens = [...itensServico]; newItens[idx].name = e.target.value; setItensServico(newItens);

                                                }}

                                                    onFocus={() => setFocusedField({ type: 'serv', idx })}

                                                    onBlur={() => setTimeout(() => setFocusedField(null), 200)}

                                                    className="w-full bg-blue-50 p-1.5 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-blue-200" placeholder="Buscar Serviço..." />



                                                {/* Dropdown de Serviço */}

                                                {focusedField?.type === 'serv' && focusedField?.idx === idx && (

                                                    <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-lg z-[100] max-h-48 overflow-y-auto border border-blue-100">

                                                        <ServiceSearch

                                                            query={item.name}

                                                            onSelect={(serv) => {

                                                                const newItens = [...itensServico];

                                                                newItens[idx].product_id = serv.id;

                                                                newItens[idx].name = serv.nome;

                                                                newItens[idx].unit_price = serv.price;

                                                                newItens[idx].total_price = serv.price * (newItens[idx].quantity || 1);

                                                                newItens[idx].codigo_servico = serv.codigo_servico || '140101';

                                                                newItens[idx].aliquota_iss = serv.aliquota_iss || 2.01;

                                                                setItensServico(newItens);

                                                            }}

                                                        />

                                                    </div>

                                                )}

                                            </div>

                                            <div className="col-span-2">

                                                <input type="number" value={item.total_price} onChange={e => {

                                                    const val = Number(e.target.value);

                                                    const newItens = [...itensServico];

                                                    newItens[idx].total_price = val;

                                                    newItens[idx].unit_price = val;

                                                    setItensServico(newItens);

                                                }} className="w-full bg-blue-50 p-1.5 rounded-lg text-xs font-medium outline-none text-right" />

                                            </div>

                                            <div className="col-span-2 flex justify-end">

                                                <button onClick={() => {

                                                    const newItens = itensServico.filter((_, i) => i !== idx); setItensServico(newItens);

                                                }} className="p-1.5 text-stone-400 hover:text-red-500 transition"><Trash2 size={14} /></button>

                                            </div>

                                        </div>

                                    </div>

                                ))}

                                <button onClick={() => setItensServico([...itensServico, { product_id: 'NEW', name: '', quantity: 1, unit_price: 0, total_price: 0, codigo_servico: '140101', aliquota_iss: 2.01 }])} className="w-full py-2 border-2 border-dashed border-blue-200 rounded-xl text-blue-400 text-xs font-bold hover:bg-blue-50 transition flex items-center justify-center gap-1">

                                    <Plus size={14} /> Adicionar Serviço

                                </button>

                            </div>

                        </div>



                    </div>



                    {/* RESUMO (DIREITA - 1 coluna) */}

                    <div className="lg:col-span-1">

                        <div className="bg-[#1A1A1A] text-[#FACC15] p-4 rounded-2xl shadow-lg sticky top-4">

                            <h3 className="font-bold text-sm mb-4">Resumo da Emissão</h3>



                            <div className="space-y-2 mb-4 text-xs">

                                <div className="flex justify-between opacity-80">

                                    <span>Produtos</span>

                                    <span>{itens.length}</span>

                                </div>

                                <div className="flex justify-between opacity-80">

                                    <span>Serviços</span>

                                    <span>{itensServico.length}</span>

                                </div>

                                <div className="flex justify-between font-bold text-sm pt-2 border-t border-white/10">

                                    <span>{produtoDocumento === "NFe" ? "NF-e" : "NFC-e"}</span>

                                    <span>R$ {itens.reduce((acc, i) => acc + i.valor_total, 0).toFixed(2)}</span>

                                </div>

                                <div className="flex justify-between font-bold text-sm text-blue-200">

                                    <span>NFS-e</span>

                                    <span>R$ {itensServico.reduce((acc, i) => acc + i.total_price, 0).toFixed(2)}</span>

                                </div>

                                <div className="flex justify-between font-bold text-lg pt-2 border-t border-white/10">

                                    <span>TOTAL</span>

                                    <span>R$ {(itens.reduce((acc, i) => acc + i.valor_total, 0) + itensServico.reduce((acc, i) => acc + i.total_price, 0)).toFixed(2)}</span>

                                </div>

                            </div>


                            {(() => {
                                const hasMissingNCM = itens.some(i => !i.ncm || i.ncm === '00000000');
                                const nfePendencias = getNFeVendaRapidaPendencias();
                                const hasBlockingPendencias = hasMissingNCM || nfePendencias.length > 0;
                                return (
                                    <>
                                        <button
                                            onClick={handleEmitir}
                                            disabled={emitting || hasBlockingPendencias}
                                            title={hasMissingNCM ? "Algum produto não possui um NCM válido." : ""}
                                            className="w-full bg-[#FACC15] text-[#1A1A1A] py-3 rounded-xl font-bold text-sm hover:bg-white transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {emitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                                            {emitting ? "Emitindo..." : isNFeVendaRapida ? "Emitir NF-e de Venda" : "Emitir Nota"}
                                        </button>
                                        
                                        {hasBlockingPendencias && isNFeVendaRapida && (
                                            <p className="text-[10px] text-red-400 text-center mt-2 font-medium bg-red-900/30 p-2 rounded-lg border border-red-500/20">
                                                Bloqueado: {nfePendencias[0]}
                                            </p>
                                        )}

                                        {hasBlockingPendencias && !isNFeVendaRapida && (
                                            <p className="text-[10px] text-red-400 text-center mt-2 font-medium bg-red-900/30 p-2 rounded-lg border border-red-500/20">
                                                Bloqueado: Preencha todos os NCMs dos produtos.
                                            </p>
                                        )}
                                    </>
                                );
                            })()}

                            <p className="text-[9px] text-center mt-3 opacity-50">

                                {environment === 'production'

                                    ? "Ambiente de Produção (VALOR FISCAL)"

                                    : "Ambiente de Homologação (Sem valor fiscal)"}

                            </p>

                        </div>

                    </div>



                </div>

            )

            }



            {/* MODAL IA NCM */}
            {ncmModalData && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl relative border border-stone-100">
                        <button onClick={() => setNcmModalData(null)} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-[#1A1A1A] hover:bg-stone-100 transition rounded-full">
                            <X size={16} />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-6 pr-8">
                            <div className="w-12 h-12 bg-[#FACC15]/20 text-[#DCA500] flex items-center justify-center rounded-2xl flex-shrink-0">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-[#1A1A1A] leading-tight mb-1">Qual NCM é mais adequado?</h3>
                                <p className="text-xs text-stone-500 leading-relaxed">
                                    Encontramos mais de uma opção para <strong className="text-[#1A1A1A]">{itens[ncmModalData.idx]?.descricao}</strong>.
                                    A sua escolha será salva automaticamente no cadastro do produto.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {ncmModalData.options.map((opt, i) => (
                                <button key={i} onClick={() => finalizeNCM(ncmModalData.idx, opt.code)} className="group cursor-pointer border border-stone-200 p-4 rounded-xl hover:border-[#FACC15] hover:bg-[#FACC15]/5 transition-all text-left w-full focus:outline-none focus:ring-2 focus:ring-[#FACC15]">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-[#1A1A1A] text-lg font-mono tracking-wider">{opt.code}</span>
                                        {i === 0 && <span className="bg-[#1A1A1A] text-[#FACC15] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Recomendado</span>}
                                    </div>
                                    <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">{opt.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            </div>

        </div >

    );

}

// Componentes Auxiliares de Busca (Poderiam ser extraídos)

function ProductSearch({ query, onSelect }: { query: string, onSelect: (prod: any) => void }) {

    const [results, setResults] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);



    useEffect(() => {

        const timer = setTimeout(async () => {

            if (!query || query.length < 2) { setResults([]); return; }

            setLoading(true);

            const data = await searchProducts(query);

            setResults(data || []);

            setLoading(false);

        }, 500);

        return () => clearTimeout(timer);

    }, [query]);



    if (!query || query.length < 2) return null;



    return (

        <div className="p-2">

            {loading && <div className="flex items-center gap-2 p-2 text-stone-400 text-xs"><Loader2 size={14} className="animate-spin" /> Buscando...</div>}

            {!loading && (

                <div className="space-y-1">

                    {results.map(prod => (

                        <div

                            key={prod.id}

                            onMouseDown={(e) => { e.preventDefault(); onSelect(prod); }}

                            className="p-2 hover:bg-stone-100 rounded-lg cursor-pointer text-xs"

                        >

                            <p className="font-bold text-[#1A1A1A]">{prod.nome}</p>

                            <div className="flex justify-between text-[10px] text-stone-500">

                                <span>{prod.marca}</span>

                                <span>R$ {prod.preco_venda?.toFixed(2)}</span>

                            </div>

                        </div>

                    ))}

                    {results.length === 0 && (

                        <p className="text-[10px] text-center text-stone-400 py-2">Nenhum produto encontrado.</p>

                    )}

                </div>

            )}

        </div>

    );

}

function ServiceSearch({ query, onSelect }: { query: string, onSelect: (serv: any) => void }) {

    const [results, setResults] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);



    useEffect(() => {

        const timer = setTimeout(async () => {

            if (!query || query.length < 2) { setResults([]); return; }

            setLoading(true);

            const data = await searchServices(query);

            setResults(data || []);

            setLoading(false);

        }, 500);

        return () => clearTimeout(timer);

    }, [query]);



    if (!query || query.length < 2) return null;



    return (

        <div className="p-2">

            {loading && <div className="flex items-center gap-2 p-2 text-blue-400 text-xs"><Loader2 size={14} className="animate-spin" /> Buscando...</div>}

            {!loading && (

                <div className="space-y-1">

                    {results.map(serv => (

                        <div

                            key={serv.id}

                            onMouseDown={(e) => { e.preventDefault(); onSelect(serv); }}

                            className="p-2 hover:bg-blue-50 rounded-lg cursor-pointer text-xs"

                        >

                            <p className="font-bold text-blue-900">{serv.nome}</p>

                            <div className="flex justify-between text-[10px] text-blue-500">

                                <span>R$ {serv.price?.toFixed(2)}</span>

                            </div>

                        </div>

                    ))}

                    {results.length === 0 && (

                        <p className="text-[10px] text-center text-blue-400 py-2">Nenhum serviço encontrado.</p>

                    )}

                </div>

            )}

        </div>

    );

}
