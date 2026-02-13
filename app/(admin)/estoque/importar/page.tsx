"use client";

import { useState, useRef } from "react";
import { createClient } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import {
    FileJson, AlertCircle, CheckCircle, Search,
    ArrowRight, Save, Plus, X, Loader2, Upload
} from "lucide-react";
import { XMLParser } from "fast-xml-parser";
import { ProductCombobox } from "./ProductCombobox";

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
};

export default function ImportarXML() {
    const supabase = createClient();
    const { profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'upload' | 'conciliate' | 'saving'>('upload');
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<ImportedProduct[]>([]);
    const [dbProducts, setDbProducts] = useState<DatabaseProduct[]>([]);
    const [notaInfo, setNotaInfo] = useState<{ nNF: string, emitente: string, total: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

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
        setLoading(true);
        try {
            const text = await file.text();
            const parser = new XMLParser({ ignoreAttributes: false });
            const xml = parser.parse(text);

            const nfeProc = xml.nfeProc || xml.NFe; // Depende se tem envelope ou não
            const infNFe = nfeProc?.NFe?.infNFe || xml.infNFe;

            if (!infNFe) throw new Error("XML inválido ou formato não suportado.");

            // Dados da Nota
            const emit = infNFe.emit;
            const ide = infNFe.ide;
            const total = infNFe.total?.ICMSTot?.vNF || 0;

            setNotaInfo({
                nNF: ide.nNF,
                emitente: emit.xNome,
                total: Number(total)
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
            const { data: allProducts } = await supabase.from('products').select('id, nome, ean, estoque_atual, custo_reposicao');

            setDbProducts(allProducts || []);

            // Tentar Match Automático
            const conciliated = importedItems.map(item => {
                // 1. Match por EAN
                let match = allProducts?.find((p: DatabaseProduct) => p.ean && p.ean === item.cEAN);

                // 2. Match por Nome (Fuzzy ou Exato) - Aqui Exato por enquanto
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

        } catch (error: any) {
            alert("Erro ao ler XML: " + error.message);
        } finally {
            setLoading(false);
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
                        marca: notaInfo?.emitente || null,
                        custo_contabil: item.vUnCom,
                        custo_reposicao: item.vUnCom,
                        estoque_atual: item.qCom,
                        estoque_min: 5,
                        preco_venda: item.vUnCom * 2, // Markup 100%
                        ean: item.cEAN || null,
                        ncm: item.ncm,
                        cfop: item.cfop
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
                        // Atualiza EAN se não tiver
                        ...(!item.matchedProduct?.ean && item.cEAN ? { ean: item.cEAN } : {}),
                        // Atualiza nome se o usuário optou
                        ...(item.updateName ? { nome: item.xProd } : {})
                    }).eq('id', prodId);

                    if (error) throw error;
                    updatedCount++;
                }
            }

            // LANÇAR DESPESA (OPCIONAL - PERGUNTAR PRO USARIO DEPOIS? OU JA LANÇAR?)
            // Vamos lançar apenas se tiver info de NFe
            if (notaInfo) {
                await supabase.from('transactions').insert({
                    organization_id: profile.organization_id,
                    description: `Compra NF ${notaInfo.nNF} - ${notaInfo.emitente}`,
                    amount: -Math.abs(notaInfo.total), // Negativo = Despesa
                    type: 'expense',
                    category: 'Estoque / Compras',
                    date: new Date().toISOString().split('T')[0],
                    status: 'pending' // Fica pendente pra ele confirmar pagamento depois
                });
            }

            alert(`Importação concluída!\n${createdCount} produtos criados.\n${updatedCount} produtos atualizados.`);
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
