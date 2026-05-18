"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import {
    FileJson, AlertCircle, CheckCircle, Search,
    ArrowRight, Save, Plus, X, Loader2, Upload, CloudDownload, FolderOpen, Inbox, RefreshCw, Copy
} from "lucide-react";
import { XMLParser } from "fast-xml-parser";
import { ProductCombobox } from "./ProductCombobox";
import { getCompanySettings } from "@/src/actions/fiscal";
import {
    getNfeQueueXml,
    listNfeImportQueue,
    markNfeQueueImported,
    searchNfeByAccessKey,
    syncNfeFromSefaz,
    type NfeQueueItem,
} from "@/src/actions/nfe_import_queue";
import { searchNfeDirectSefazByAccessKey } from "@/src/actions/sefaz_direct_distribution";

// Tipos
type ImportedProduct = {
    xmlId: string; // Para key
    cProd: string; // Código Original da Nota
    cEAN: string; // Codigo de Barras
    xProd: string; // Nome na Nota
    qCom: number; // Quantidade
    vUnCom: number; // Valor Unitário (Custo Novo)
    ncm: string;
    cfop: string;
    matchedProduct?: DatabaseProduct | null; // Produto do Banco encontrado
    status: 'matched' | 'new' | 'manual'; // Estado da conciliação
    selectedAction: 'update' | 'create' | 'ignore'; // Ação escolhida
    updateName: boolean; // Atualizar nome do produto com o da nota?
};

type DatabaseProduct = {
    id: string;
    nome: string;
    ean: string | null;
    estoque_atual: number;
    custo_reposicao: number;
    data_ultima_compra?: string; // Adicionado
};

export default function ImportarXML() {
    const supabase = createClient();
    const { profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'upload' | 'conciliate' | 'saving'>('upload');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<ImportedProduct[]>([]);
    const [dbProducts, setDbProducts] = useState<DatabaseProduct[]>([]);
    const [notaInfo, setNotaInfo] = useState<{ nNF: string, emitente: string, emitenteCNPJ: string, total: number, chNFe: string, dhEmi: string } | null>(null);
    const [rawXml, setRawXml] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const [sourceMode, setSourceMode] = useState<'computer' | 'sefaz'>('computer');
    const [queueItems, setQueueItems] = useState<NfeQueueItem[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [syncingSefaz, setSyncingSefaz] = useState(false);
    const [searchingKey, setSearchingKey] = useState(false);
    const [searchingDirectKey, setSearchingDirectKey] = useState(false);
    const [accessKeyInput, setAccessKeyInput] = useState("");
    const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
    const [lastSyncInfo, setLastSyncInfo] = useState<{
        type: 'success' | 'error';
        message: string;
        details?: string;
    } | null>(null);

    // Markup settings
    const [markupAtivo, setMarkupAtivo] = useState(false);
    const [markupValor, setMarkupValor] = useState(2.0);

    // Fetch company settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            const settings = await getCompanySettings();
            if (settings) {
                setMarkupAtivo(settings.aplicar_markup_importacao ?? false);
                setMarkupValor(settings.markup_valor_importacao ?? 2.0);
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("origem") === "sefaz") {
            setSourceMode("sefaz");
        }
    }, []);

    const loadQueue = useCallback(async () => {
        setQueueLoading(true);
        try {
            const result = await listNfeImportQueue();
            if (!result.success) throw new Error(result.error);
            setQueueItems(result.data || []);
        } catch (error: any) {
            alert("Erro ao carregar fila da SEFAZ: " + error.message);
        } finally {
            setQueueLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sourceMode === 'sefaz') {
            loadQueue();
        }
    }, [sourceMode, loadQueue]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await processFile(files[0]);
        }
    };

    // --- 1. UPLOAD & PARSING ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    const processFile = async (file: File) => {
        setSelectedQueueId(null);
        setLoading(true);
        try {
            const text = await file.text();
            await processXmlText(text);
        } catch (error: any) {
            alert("Erro ao ler XML: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const processXmlText = async (text: string) => {
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_",
                parseTagValue: false,
                parseAttributeValue: false,
            });
            const xml = parser.parse(text);

            const nfeProc = xml.nfeProc || xml.NFe; // Depende se tem envelope ou não
            const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;

            if (!infNFe) throw new Error("XML inválido ou formato não suportado.");

            // Dados da Nota
            const emit = infNFe.emit;
            const ide = infNFe.ide;
            const total = infNFe.total?.ICMSTot?.vNF || 0;

            // Extrai chave: preferencialmente do protNFe, fallback no atributo Id do infNFe
            let chNFe = String(xml.nfeProc?.protNFe?.infProt?.chNFe || "").trim();
            if (!/^[0-9]{44}$/.test(chNFe)) {
                const idAttr = infNFe["@_Id"] || "";
                chNFe = String(idAttr).replace(/^NFe/, "").trim();
            }

            // Verificar duplicata antes de prosseguir
            if (/^[0-9]{44}$/.test(chNFe) && profile?.organization_id) {
                const { data: existing } = await supabase
                    .from('fiscal_invoices')
                    .select('numero, emitente_nome, data_emissao')
                    .eq('chave_acesso', chNFe)
                    .eq('organization_id', profile.organization_id)
                    .maybeSingle();

                if (existing) {
                    const dataFormatada = new Date(existing.data_emissao).toLocaleDateString('pt-BR');
                    throw new Error(`A Nota ${existing.numero} de ${existing.emitente_nome} já foi importada em ${dataFormatada}.`);
                }
            }

            setRawXml(text); // Guardar XML bruto

            setNotaInfo({
                nNF: ide.nNF,
                emitente: emit.xNome,
                emitenteCNPJ: emit.CNPJ,
                total: Number(total),
                chNFe,
                dhEmi: ide.dhEmi || new Date().toISOString()
            });

            // Detalhes (Produtos)
            let dets = infNFe.det;
            if (!Array.isArray(dets)) dets = [dets]; // Se só tem 1 item, XMLParser não cria array

            const importedItems: ImportedProduct[] = dets.map((d: any, idx: number) => ({
                xmlId: `item-${idx}`,
                cProd: d.prod.cProd,
                cEAN: d.prod.cEAN !== "SEM GTIN" ? d.prod.cEAN : "",
                xProd: d.prod.xProd,
                qCom: Number(d.prod.qCom),
                vUnCom: Number(d.prod.vUnCom),
                ncm: d.prod.NCM,
                cfop: d.prod.CFOP,
                status: 'new',
                selectedAction: 'create',
                updateName: false
            }));

            // Buscar todos os produtos do banco p/ tentar match
            // (Em cenários reais com muitos produtos, faríamos busca filtrada, mas aqui vamos trazer tudo para facilitar match em memória ou buscar por partes)
            // Vamos buscar apenas id, nome, ean
            const { data: allProducts } = await supabase.from('products').select('id, nome, ean, estoque_atual, custo_reposicao, data_ultima_compra');

            setDbProducts(allProducts || []);

            // Tentar Match Automático
            const conciliated = importedItems.map(item => {
                // 1. Match por EAN (PRIORIDADE)
                let match = item.cEAN
                    ? allProducts?.find((p: DatabaseProduct) => p.ean === item.cEAN)
                    : undefined;

                // 2. Match por Nome (Exato)
                if (!match) {
                    match = allProducts?.find((p: DatabaseProduct) => p.nome.toLowerCase() === item.xProd.toLowerCase());
                }

                if (match) {
                    return { ...item, matchedProduct: match, status: 'matched', selectedAction: 'update', updateName: false } as ImportedProduct;
                }
                return item;
            });

            setItems(conciliated);
            setStep('conciliate');
    };

    const handleSyncSefaz = async () => {
        setSyncingSefaz(true);
        try {
            const result = await syncNfeFromSefaz();
            if (!result.success) throw new Error(result.error);
            await loadQueue();
            const loteInfo = result.initialSync && !result.initialSyncCompleted
                ? "\nPrimeira carga ainda em andamento: clique em Verificar novas emissoes novamente para continuar o proximo lote."
                : "";
            setLastSyncInfo({
                type: 'success',
                message: (result.inserted || 0) > 0
                    ? `${result.inserted} emissao(oes) nova(s) adicionada(s) na fila.`
                    : "Verificacao concluida sem novas emissoes para importar.",
                details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""} | Recebidas da API: ${result.received || 0} | Eventos/nao-notas: ${result.skippedNonNote || 0} | Sem chave: ${result.skippedMissingKey || 0} | Ja importadas: ${result.skippedDuplicated || 0} | Fora dos 60 dias iniciais: ${result.skippedOld || 0} | ultNSU: ${result.ultimoNsu || 0} | maxNSU: ${result.maxNsu || 0}${loteInfo ? " | Primeira carga ainda em andamento" : ""}`,
            });
            alert(`Verificacao concluida.\nCNPJ: ${result.cpfCnpj || "-"}\nStatus: ${result.codigoStatus || "-"} ${result.motivoStatus || ""}\nRecebidas: ${result.received || 0}\nNovas emissoes na fila: ${result.inserted || 0}\nEventos/nao-notas: ${result.skippedNonNote || 0}\nSem chave: ${result.skippedMissingKey || 0}\nJa importadas: ${result.skippedDuplicated || 0}\nFora dos 60 dias iniciais: ${result.skippedOld || 0}\nultNSU: ${result.ultimoNsu || 0}\nmaxNSU: ${result.maxNsu || 0}${loteInfo}`);
        } catch (error: any) {
            setLastSyncInfo({
                type: 'error',
                message: "A verificacao de emissoes falhou.",
                details: error.message,
            });
            alert("Erro ao verificar novas emissoes: " + error.message);
        } finally {
            setSyncingSefaz(false);
        }
    };

    const handleOpenQueueItem = async (queueItem: NfeQueueItem) => {
        if (!queueItem.resumo && !window.confirm("XML encontrada. Gostaria de importar agora?")) {
            return;
        }

        setLoading(true);
        setSelectedQueueId(queueItem.id);
        try {
            const result = await getNfeQueueXml(queueItem.id);
            if (!result.success || !result.xmlContent) throw new Error(result.error || "XML nao encontrado.");
            await processXmlText(result.xmlContent);
        } catch (error: any) {
            setSelectedQueueId(null);
            alert("Erro ao abrir XML da SEFAZ: " + error.message);
            await loadQueue();
        } finally {
            setLoading(false);
        }
    };

    const handleCopyAccessKey = async (chaveAcesso: string) => {
        try {
            await navigator.clipboard.writeText(chaveAcesso);
            alert("Chave de acesso copiada.");
        } catch {
            alert(`Nao foi possivel copiar automaticamente. Chave: ${chaveAcesso}`);
        }
    };

    const handleSearchByKey = async () => {
        setSearchingKey(true);
        try {
            const result = await searchNfeByAccessKey(accessKeyInput);
            if (!result.success) throw new Error(result.error);

            if (result.alreadyImported) {
                const invoiceDate = result.invoice?.data_emissao
                    ? new Date(result.invoice.data_emissao).toLocaleDateString('pt-BR')
                    : "-";
                setLastSyncInfo({
                    type: 'success',
                    message: "NF-e localizada, mas ja estava importada.",
                    details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""} | NF: ${result.invoice?.numero || "-"} | Data: ${invoiceDate}`,
                });
                alert(`NF-e localizada, mas ja estava importada.\nNF: ${result.invoice?.numero || "-"}\nData: ${invoiceDate}`);
            } else if (result.found) {
                setLastSyncInfo({
                    type: 'success',
                    message: result.resumo
                        ? "NF-e localizada como resumo e adicionada na fila."
                        : "NF-e completa localizada e adicionada na fila.",
                    details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""}`,
                });
                alert(result.resumo
                    ? "NF-e localizada como resumo e adicionada na fila. Ao abrir, o sistema tentara manifestar ciencia. Se o XML completo ainda nao vier, tente novamente apenas na proxima janela da SEFAZ (cerca de 1 hora)."
                    : "NF-e completa localizada e adicionada na fila.");
            } else {
                setLastSyncInfo({
                    type: 'success',
                    message: "Nenhuma NF-e foi localizada para essa chave.",
                    details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""}`,
                });
                alert("Nenhuma NF-e foi localizada para essa chave.");
            }

            await loadQueue();
        } catch (error: any) {
            setLastSyncInfo({
                type: 'error',
                message: "A busca por chave falhou.",
                details: error.message,
            });
            alert("Erro ao buscar por chave: " + error.message);
        } finally {
            setSearchingKey(false);
        }
    };

    const handleSearchDirectByKey = async () => {
        setSearchingDirectKey(true);
        try {
            const result = await searchNfeDirectSefazByAccessKey(accessKeyInput);
            if (!result.success) throw new Error(result.error);

            if (result.alreadyImported) {
                const invoiceDate = result.invoice?.data_emissao
                    ? new Date(result.invoice.data_emissao).toLocaleDateString('pt-BR')
                    : "-";
                setLastSyncInfo({
                    type: 'success',
                    message: "SEFAZ direta localizou, mas a NF-e ja estava importada.",
                    details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""} | NF: ${result.invoice?.numero || "-"} | Data: ${invoiceDate}`,
                });
                alert(`SEFAZ direta localizou, mas ja estava importada.\nNF: ${result.invoice?.numero || "-"}\nData: ${invoiceDate}`);
            } else if (result.found) {
                setLastSyncInfo({
                    type: 'success',
                    message: result.resumo
                        ? "SEFAZ direta localizou como resumo e adicionou na fila."
                        : "SEFAZ direta localizou XML completo e adicionou na fila.",
                    details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""}`,
                });
                alert(result.resumo
                    ? "SEFAZ direta localizou como resumo e adicionou na fila."
                    : "SEFAZ direta localizou XML completo e adicionou na fila.");
            } else {
                setLastSyncInfo({
                    type: 'success',
                    message: "SEFAZ direta nao localizou NF-e para essa chave.",
                    details: `CNPJ: ${result.cpfCnpj || "-"} | Status: ${result.codigoStatus || "-"} ${result.motivoStatus || ""}`,
                });
                alert("SEFAZ direta nao localizou NF-e para essa chave.");
            }

            await loadQueue();
        } catch (error: any) {
            setLastSyncInfo({
                type: 'error',
                message: "A busca direta na SEFAZ falhou.",
                details: error.message,
            });
            alert("Erro na busca direta SEFAZ: " + error.message);
        } finally {
            setSearchingDirectKey(false);
        }
    };

    // --- 2. CONCILIAÇÃO ---
    const handleProductSelect = (index: number, dbProdId: string | 'new') => {
        const newItems = [...items];
        if (dbProdId === 'new') {
            newItems[index].matchedProduct = null;
            newItems[index].status = 'new';
            newItems[index].selectedAction = 'create';
        } else {
            const prod = dbProducts.find(p => p.id === dbProdId);
            if (prod) {
                newItems[index].matchedProduct = prod;
                newItems[index].status = 'manual';
                newItems[index].selectedAction = 'update';
            }
        }
        setItems(newItems);
    };

    // --- 3. SALVAR ---
    const handleFinalizeImport = async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
        setStep('saving');

        try {
            let createdCount = 0;
            let updatedCount = 0;

            for (const item of items) {
                let prodId = item.matchedProduct?.id;

                // CRIAR NOVO PRODUTO
                if (item.selectedAction === 'create') {
                    const { data: newProd, error } = await supabase.from('products').insert({
                        organization_id: profile.organization_id,
                        nome: item.xProd,
                        marca: null,
                        custo_contabil: item.vUnCom,
                        custo_reposicao: item.vUnCom,
                        estoque_atual: item.qCom,
                        estoque_min: 5,
                        preco_venda: markupAtivo ? item.vUnCom * markupValor : item.vUnCom * 2, // Markup configurado ou 100% padrão
                        ean: item.cEAN || null,
                        ncm: item.ncm,
                        cfop: item.cfop,
                        data_ultima_compra: new Date().toISOString() // Seta data atual na criação
                    }).select().single();

                    if (error) throw error;
                    prodId = newProd.id;
                    createdCount++;
                }
                // ATUALIZAR EXISTENTE
                else if (item.selectedAction === 'update' && prodId) {
                    // Atualiza estoque e custo reposição
                    // NOTA: Idealmente somamos ao estoque atual
                    const newStock = (item.matchedProduct?.estoque_atual || 0) + item.qCom;

                    const { error } = await supabase.from('products').update({
                        estoque_atual: newStock,
                        custo_reposicao: item.vUnCom,
                        // Atualizar preço de venda se markup ativo
                        ...(markupAtivo ? { preco_venda: item.vUnCom * markupValor } : {}),
                        // Atualiza EAN se não tiver
                        ...(!item.matchedProduct?.ean && item.cEAN ? { ean: item.cEAN } : {}),
                        // Atualiza nome se o usuário optou
                        ...(item.updateName ? { nome: item.xProd } : {}),
                        data_ultima_compra: new Date().toISOString() // Atualiza data na compra
                    }).eq('id', prodId);

                    if (error) throw error;
                    updatedCount++;
                }
            }

            // 1. SALVAR NOTA FISCAL (TABELA NOVA)
            if (notaInfo && rawXml) {
                const { error: invoiceError } = await supabase.from('fiscal_invoices').insert({
                    organization_id: profile.organization_id,
                    chave_acesso: notaInfo.chNFe,
                    xml_content: rawXml,
                    numero: notaInfo.nNF,
                    serie: '1', // Assumindo 1 se não tiver
                    valor_total: notaInfo.total,
                    emitente_nome: notaInfo.emitente,
                    emitente_cnpj: notaInfo.emitenteCNPJ,
                    data_emissao: notaInfo.dhEmi,
                    direction: 'entry',
                    environment: 'production',
                    tipo_documento: 'NFe',
                    status: 'authorized'
                });

                if (invoiceError) {
                    console.error("Erro ao salvar nota fiscal:", invoiceError);
                    // Não vamos travar a importação por isso, mas é bom logar
                }
            }

            // 2. LANÇAR DESPESA (OPCIONAL - PERGUNTAR PRO USARIO DEPOIS? OU JA LANÇAR?)
            // Vamos lançar apenas se tiver info de NFe
            if (notaInfo) {
                await supabase.from('transactions').insert({
                    organization_id: profile.organization_id,
                    description: `Compra NF ${notaInfo.nNF} - ${notaInfo.emitente}`,
                    amount: -Math.abs(notaInfo.total), // Negativo = Despesa
                    type: 'expense',
                    category: 'Estoque / Compras',
                    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                    status: 'pending',
                    payment_method: 'boleto' // Padrão para compras de fornecedor até que seja pago
                });
            }

            alert(`Importação concluída!\n${createdCount} produtos criados.\n${updatedCount} produtos atualizados.`);
            if (selectedQueueId || notaInfo?.chNFe) {
                const markResult = await markNfeQueueImported(selectedQueueId, notaInfo?.chNFe);
                if (!markResult.success) {
                    console.warn("Nota importada, mas nao foi possivel atualizar a fila:", markResult.error);
                }
            }

            window.location.href = '/estoque';

        } catch (error: any) {
            alert("Erro ao salvar: " + error.message);
            setStep('conciliate');
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER ---
    return (
        <div className="max-w-5xl mx-auto pb-32">
            <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2">Importar XML (NFe)</h1>
            <p className="text-stone-500 mb-8">Atualize seu estoque automaticamente através da Nota Fiscal.</p>

            {/* STEP 1: UPLOAD */}
            {step === 'upload' && (
                <>
                <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <button
                        onClick={() => {
                            setSelectedQueueId(null);
                            setSourceMode('computer');
                        }}
                        className={`px-5 py-3 rounded-2xl font-bold text-sm border-2 flex items-center gap-2 transition ${sourceMode === 'computer' ? 'bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}
                    >
                        <FolderOpen size={18} /> Procurar no computador
                    </button>
                    <button
                        onClick={() => {
                            setSelectedQueueId(null);
                            setSourceMode('sefaz');
                        }}
                        className={`px-5 py-3 rounded-2xl font-bold text-sm border-2 flex items-center gap-2 transition ${sourceMode === 'sefaz' ? 'bg-[#1A1A1A] text-[#FACC15] border-[#1A1A1A]' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'}`}
                    >
                        <CloudDownload size={18} /> Verificar novas emissoes
                    </button>
                </div>

                {sourceMode === 'computer' && (
                <div
                    className={`rounded-[32px] p-12 shadow-sm border-2 text-center transition-all cursor-pointer ${isDragging
                        ? 'bg-blue-50 border-blue-400 border-dashed scale-[1.02]'
                        : 'bg-white border-stone-100'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        accept=".xml"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors ${isDragging ? 'bg-blue-100 text-blue-500' : 'bg-stone-50 text-stone-400'
                        }`}>
                        {loading ? <Loader2 className="animate-spin" /> : <Upload size={40} />}
                    </div>
                    <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">
                        {isDragging ? "Solte o arquivo XML aqui" : "Arraste seu XML aqui"}
                    </h2>
                    <p className="text-stone-400 mb-6">ou clique para selecionar do computador</p>
                    <button
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        disabled={loading}
                        className="bg-[#1A1A1A] text-[#FACC15] px-8 py-3 rounded-full font-bold hover:scale-105 transition shadow-lg"
                    >
                        Selecionar Arquivo
                    </button>
                </div>
                )}

                {sourceMode === 'sefaz' && (
                    <div className="bg-white rounded-[28px] border-2 border-stone-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="font-bold text-[#1A1A1A] flex items-center gap-2">
                                    <Inbox size={20} /> Emissoes encontradas
                                </h2>
                                <p className="text-xs text-stone-500 mt-1">
                                    A consulta verifica NF-e emitidas contra o CNPJ da oficina. Quando o XML completo estiver disponivel, voce podera importar; quando vier apenas resumo, use a chave para localizar o XML.
                                </p>
                            </div>
                            <button
                                onClick={handleSyncSefaz}
                                disabled={syncingSefaz || queueLoading}
                                className="bg-[#1A1A1A] text-[#FACC15] px-5 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {syncingSefaz ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                Verificar novas emissoes
                            </button>
                        </div>

                        {queueLoading ? (
                            <div className="py-16 flex flex-col items-center gap-2 text-stone-400">
                                <Loader2 className="animate-spin text-[#FACC15]" />
                                <p className="text-sm">Carregando fila...</p>
                            </div>
                        ) : queueItems.length === 0 ? (
                            <div className="py-12 px-6 flex flex-col items-center gap-3 text-stone-400">
                                {lastSyncInfo && (
                                    <div className={`w-full max-w-2xl border rounded-2xl p-4 text-left mb-4 ${lastSyncInfo.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                        <p className="text-sm font-bold">{lastSyncInfo.message}</p>
                                        {lastSyncInfo.details && <p className="text-xs mt-1 opacity-80">{lastSyncInfo.details}</p>}
                                    </div>
                                )}
                                <Inbox size={36} className="text-stone-300" />
                                <p className="text-sm font-medium">
                                    {lastSyncInfo ? "Nenhuma emissao pendente na fila." : "Clique em Verificar novas emissoes para consultar a SEFAZ."}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-stone-100">
                                {lastSyncInfo && (
                                    <div className={`m-4 border rounded-2xl p-4 ${lastSyncInfo.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                        <p className="text-sm font-bold">{lastSyncInfo.message}</p>
                                        {lastSyncInfo.details && <p className="text-xs mt-1 opacity-80">{lastSyncInfo.details}</p>}
                                    </div>
                                )}
                                {queueItems.map((note) => (
                                    <div
                                        key={note.id}
                                        className="w-full p-5 hover:bg-stone-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-[#1A1A1A] truncate">{note.emitente_nome || "Fornecedor nao identificado"}</p>
                                            <p className="text-xs text-stone-500 mt-1">
                                                NF {note.numero || "-"} {note.data_emissao ? `- ${new Date(note.data_emissao).toLocaleDateString('pt-BR')}` : ""} - Chave {note.chave_acesso}
                                            </p>
                                            {note.resumo && (
                                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2 inline-flex">
                                                    XML ainda nao disponivel pela SEFAZ. Copie a chave para localizar o XML manualmente ou tente baixar novamente na proxima janela da SEFAZ.
                                                </p>
                                            )}
                                            {!note.resumo && (
                                                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 mt-2 inline-flex">
                                                    XML encontrada. Voce pode importar esta nota agora.
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                                            <span className="font-bold text-[#1A1A1A]">
                                                R$ {(Number(note.valor_total || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyAccessKey(note.chave_acesso)}
                                                className="bg-white text-[#1A1A1A] px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-stone-200 hover:border-stone-400"
                                            >
                                                <Copy size={15} /> Copiar chave
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenQueueItem(note)}
                                                disabled={loading}
                                                className={`${note.resumo ? "bg-stone-100 text-stone-600 border border-stone-200" : "bg-[#1A1A1A] text-[#FACC15] border border-[#1A1A1A]"} px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-60`}
                                            >
                                                {loading && selectedQueueId === note.id ? (
                                                    <Loader2 className="animate-spin" size={15} />
                                                ) : (
                                                    <ArrowRight size={15} />
                                                )}
                                                {note.resumo ? "Tentar baixar XML" : "Importar XML"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                </>
            )}

            {/* STEP 2: CONCILIATE */}
            {step === 'conciliate' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    {/* Resumo da Nota */}
                    <div className="bg-[#1A1A1A] text-white rounded-[24px] p-6 flex justify-between items-center shadow-lg">
                        <div>
                            <p className="text-stone-400 text-xs uppercase font-bold">Fornecedor</p>
                            <p className="text-lg font-bold">{notaInfo?.emitente}</p>
                            <p className="text-xs text-stone-400">NF: {notaInfo?.nNF}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-stone-400 text-xs uppercase font-bold">Total da Nota</p>
                            <p className="text-2xl font-bold text-[#FACC15]">R$ {notaInfo?.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] shadow-sm border border-stone-100">
                        <div className="p-4 bg-stone-50 border-b border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-4 font-bold text-stone-500 text-xs uppercase rounded-t-[24px]">
                            <div>Produto na Nota (XML)</div>
                            <div>Conciliação com Estoque (Sistema)</div>
                        </div>

                        <div className="divide-y divide-stone-100">
                            {items.map((item, idx) => (
                                <div key={idx} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-center hover:bg-stone-50 transition last:rounded-b-[24px]">

                                    {/* LADO ESQUERDO: XML */}
                                    <div>
                                        <div className="flex items-start gap-3">
                                            <div className="bg-stone-100 p-2 rounded-lg text-stone-400 font-mono text-xs">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#1A1A1A] text-sm leading-tight mb-1">{item.xProd}</p>
                                                <div className="flex gap-2 text-xs text-stone-500">
                                                    <span className="bg-stone-100 px-1 rounded">Qtd: {item.qCom}</span>
                                                    <span className="bg-stone-100 px-1 rounded">Cód: {item.cProd}</span>
                                                    <span className="bg-stone-100 px-1 rounded">Custo: R$ {item.vUnCom.toFixed(2)}</span>
                                                    {item.cEAN && <span className="bg-blue-50 text-blue-600 px-1 rounded border border-blue-100">EAN: {item.cEAN}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* LADO DIREITO: SISTEMA */}
                                    <div className="relative">
                                        {item.status === 'matched' || item.status === 'manual' ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 bg-green-50 border border-green-200 p-3 rounded-xl">
                                                    <CheckCircle className="text-green-600 shrink-0" size={20} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-green-900 text-sm truncate">{item.matchedProduct?.nome}</p>
                                                        <p className="text-xs text-green-700">
                                                            Atualizar estoque: <span className="font-bold">{item.matchedProduct?.estoque_atual} ➝ {item.matchedProduct!.estoque_atual + item.qCom}</span>
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleProductSelect(idx, 'new')}
                                                        className="text-xs text-stone-400 underline hover:text-stone-600"
                                                    >
                                                        Trocar
                                                    </button>
                                                </div>
                                                {/* Toggle: Atualizar Nome */}
                                                {item.matchedProduct?.nome.toLowerCase() !== item.xProd.toLowerCase() && (
                                                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition text-xs">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.updateName}
                                                            onChange={() => {
                                                                const newItems = [...items];
                                                                newItems[idx].updateName = !newItems[idx].updateName;
                                                                setItems(newItems);
                                                            }}
                                                            className="accent-amber-500 w-4 h-4 rounded"
                                                        />
                                                        <span className="text-amber-800">
                                                            Atualizar nome para: <strong className="text-amber-900">{item.xProd}</strong>
                                                        </span>
                                                    </label>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <ProductCombobox
                                                        products={dbProducts}
                                                        value={item.matchedProduct?.id || 'new'}
                                                        onChange={(val: string | 'new') => handleProductSelect(idx, val)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 py-8">
                        <button
                            onClick={() => window.location.reload()}
                            className="text-stone-500 font-bold hover:bg-stone-100 px-6 py-3 rounded-full transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleFinalizeImport}
                            disabled={loading}
                            className="bg-[#1A1A1A] text-[#FACC15] px-8 py-3 rounded-full font-bold shadow-xl hover:scale-105 transition flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            Confirmar Importação
                        </button>
                    </div>
                </div>
            )}

            {/* LOADING OVERLAY */}
            {step === 'saving' && (
                <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 size={48} className="text-[#FACC15] animate-spin mb-4" />
                    <h2 className="text-xl font-bold">Processando Importação...</h2>
                    <p className="text-stone-500">Atualizando estoque e preços.</p>
                </div>
            )}

        </div>
    );
}
