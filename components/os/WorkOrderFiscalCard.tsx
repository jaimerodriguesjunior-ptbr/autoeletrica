"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/src/lib/supabase";
import { getWorkOrderFiscalCategories, isProductSaleInvoice, type WorkOrderFiscalInvoice, type WorkOrderFiscalItem } from "@/src/lib/work-order-fiscal";

type Props = {
    organizationId: string;
    workOrderId: string | number;
    status: string;
    items: WorkOrderFiscalItem[];
};

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const documentLabel = (type: string) => type === "NFSe" ? "NFS-e" : type === "NFe" ? "NF-e" : "NFC-e";

export function WorkOrderFiscalCard({ organizationId, workOrderId, status, items }: Props) {
    const [invoices, setInvoices] = useState<WorkOrderFiscalInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const reload = useCallback(() => setRefresh((value) => value + 1), []);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            setError(false);
            try {
                const supabase = createClient();
                const rows: WorkOrderFiscalInvoice[] = [];
                for (let from = 0; ; from += 500) {
                    const { data, error: queryError } = await supabase.from("fiscal_invoices")
                        .select("id,tipo_documento,status,numero,error_message,payload_json")
                        .eq("organization_id", organizationId)
                        .eq("work_order_id", workOrderId)
                        .eq("direction", "output")
                        .eq("environment", "production")
                        .order("created_at", { ascending: false })
                        .order("id", { ascending: false })
                        .range(from, from + 499);
                    if (queryError) throw queryError;
                    rows.push(...(data || []));
                    if (!data || data.length < 500) break;
                }
                if (active) setInvoices(rows);
            } catch {
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        void load();
        window.addEventListener("focus", reload);
        return () => { active = false; window.removeEventListener("focus", reload); };
    }, [organizationId, workOrderId, status, refresh, reload]);

    const categories = getWorkOrderFiscalCategories(items, invoices);
    const canIssue = ["pronto", "entregue"].includes(status);
    const fiscalLink = `/fiscal?os=${encodeURIComponent(workOrderId)}`;
    const actionClass = "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2";

    return (
        <section aria-label="Notas fiscais da ordem de serviço" className="mt-4 border-t border-stone-200 pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A]"><FileText size={16} /> Notas fiscais</h3>
                <button type="button" onClick={reload} disabled={loading} title="Atualizar notas fiscais" aria-label="Atualizar notas fiscais" className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-50">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
            {loading ? (
                <p role="status" className="flex items-center gap-2 text-xs text-stone-500"><Loader2 size={14} className="animate-spin" /> Consultando notas vinculadas...</p>
            ) : error ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    Não foi possível conferir as notas desta OS.
                    <button type="button" onClick={reload} className="mt-2 block font-bold underline">Tentar novamente</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {categories.length === 0 && <p className="text-xs text-stone-500">Adicione produtos ou serviços para preparar uma nota.</p>}
                    {categories.map((category) => {
                        const latest = category.type === "NFCe" ? category.invoices.find(isProductSaleInvoice) : category.invoices[0];
                        const document = latest?.tipo_documento === "NFe" ? "NFe" : category.type;
                        const issueLink = `/fiscal/emitir?env=production&os=${encodeURIComponent(workOrderId)}&documento=${document}`;
                        const canPrepare = !category.authorized && !category.processing;
                        return (
                            <div key={category.type} className="rounded-xl border border-stone-200 bg-white p-3">
                                <div className="mb-3 flex justify-between gap-3 text-xs font-bold text-stone-800">
                                    <span>{category.label}</span><span className="shrink-0">{currency(category.amount)}</span>
                                </div>
                                <div className="space-y-3">
                                    {category.invoices.map((invoice) => {
                                        const label = documentLabel(invoice.tipo_documento);
                                        const authorized = invoice.status === "authorized";
                                        const processing = ["processing", "draft", "pending"].includes(invoice.status);
                                        const failed = ["error", "rejected"].includes(invoice.status);
                                        return (
                                            <div key={invoice.id} className="border-t border-stone-100 pt-2 text-xs">
                                                <p className="font-bold text-stone-800">{label}{invoice.numero ? ` nº ${invoice.numero}` : ""}{invoice.tipo_documento === "NFe" && !isProductSaleInvoice(invoice) ? " · Outra operação" : ""}</p>
                                                <p className={`mt-1 mb-2 ${authorized ? "text-green-700" : processing ? "text-amber-700" : failed ? "text-red-600" : "text-stone-500"}`}>
                                                    {authorized ? "Autorizada" : processing ? "Em andamento" : failed ? "Falha na tentativa" : invoice.status === "cancelled" ? "Cancelada" : invoice.status}
                                                </p>
                                                {authorized ? (
                                                    <>
                                                        <a href={`/api/fiscal/print/${invoice.id}`} target="_blank" rel="noopener noreferrer" className={`${actionClass} bg-stone-100 text-stone-800 hover:bg-stone-200`}>Ver {label}</a>
                                                        <a href={`/api/fiscal/print/${invoice.id}?download=true`} target="_blank" rel="noopener noreferrer" className="mt-1 flex justify-center items-center gap-1 py-1 font-bold text-stone-600 hover:underline"><Download size={13} /> Baixar {invoice.tipo_documento === "NFSe" ? "PDF" : "DANFE"}</a>
                                                    </>
                                                ) : <Link href={fiscalLink} className={`${actionClass} border border-stone-200 text-stone-700 hover:bg-stone-50`}>{processing ? `Consultar ${label}` : "Ver tentativa no fiscal"}</Link>}
                                                {failed && invoice.error_message && <details className="mt-2 text-red-600"><summary className="cursor-pointer">Ver motivo</summary><p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words">{invoice.error_message}</p></details>}
                                            </div>
                                        );
                                    })}
                                </div>
                                {canPrepare && (canIssue && category.hasItems && category.amount > 0 ? (
                                    <Link href={issueLink} className={`${actionClass} mt-3 ${category.type === "NFCe" ? "bg-[#1A1A1A] text-[#FACC15] hover:bg-black" : "border border-stone-300 text-stone-800 hover:bg-stone-50"}`}><FileText size={14} /> {latest && ["error", "rejected"].includes(latest.status) ? "Revisar tentativa" : `Emitir ${documentLabel(document)}`}</Link>
                                ) : <p className="mt-2 text-xs text-stone-500">{!canIssue ? "Disponível quando a OS estiver pronta ou entregue." : "Inclua itens com valor maior que zero para emitir."}</p>)}
                            </div>
                        );
                    })}
                    {categories.length > 0 && <p className="text-[10px] leading-relaxed text-stone-500">Valores dos itens desta OS. A emissão passa por uma tela de revisão antes da confirmação.</p>}
                </div>
            )}
        </section>
    );
}
