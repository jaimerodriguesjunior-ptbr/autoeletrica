"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Copy,
    FileCheck2,
    FileText,
    Gift,
    Loader2,
    MapPin,
    Package,
    Repeat2,
    RotateCcw,
    Search,
    Send,
    ShieldCheck,
    Truck,
    UserPlus,
    Warehouse,
} from "lucide-react";
import { useAuth } from "@/src/contexts/AuthContext";
import { createClient } from "@/src/lib/supabase";
import { auditarNFeAssistidaComIaAction } from "@/src/actions/fiscal_ai_audit";
import { emitirNFeAssistidaUiAction, emitirNFeBonificacaoDoacaoUiAction, emitirNFeDevolucaoAction, emitirNFeRemessaConsertoUiAction, emitirNFeRemessaGarantiaUiAction, emitirNFeRetornoConsertoUiAction, emitirNFeRetornoGarantiaUiAction, emitirNFeTransferenciaUiAction, emitirNFeVendaAction } from "@/src/actions/fiscal_emission_actions";
import { getEntryInvoiceWithItemsAction, getNFeInvoiceWithItemsAction, searchCloneableNFeInvoicesAction, searchProducts, type ParsedNFeItem } from "@/src/actions/fiscal_db";

type OperationGroup = "sale" | "return" | "shipment" | "transfer" | "bonus" | "advanced";
type StepId = "operation" | "participant" | "items" | "transport" | "review";

type ClientResult = {
    id: string;
    nome: string;
    cpf_cnpj?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    endereco?: any;
};

type Participant = {
    id?: string;
    nome: string;
    cpf_cnpj: string;
    inscricao_estadual: string;
    ind_ie_dest: "1" | "2" | "9";
    email: string;
    telefone: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    codigo_municipio: string;
};

type DraftItem = {
    id: string;
    codigo: string;
    descricao: string;
    ncm: string;
    unidade: string;
    quantidade: number;
    valor_unitario: number;
    origem: string;
    cfop: string;
    csosn: string;
};

type ProductResult = {
    id: string;
    nome: string;
    marca?: string | null;
    preco_venda?: number | null;
    ncm?: string | null;
    cfop?: string | null;
    unidade?: string | null;
};

type EntryInvoiceSummary = {
    id: string;
    numero: string | null;
    emitente_nome: string | null;
    emitente_cnpj: string | null;
    destinatario_nome?: string | null;
    destinatario_cnpj?: string | null;
    valor_total: number | null;
    data_emissao: string | null;
    chave_acesso: string | null;
    direction?: string | null;
    payload_json?: any;
};

type CloneInvoiceSummary = EntryInvoiceSummary & {
    serie?: string | number | null;
    status?: string | null;
    environment?: "production" | "homologation" | string | null;
};

type ReturnItemState = ParsedNFeItem & {
    selected: boolean;
    qtd_devolver: number;
};

const STEPS: { id: StepId; label: string }[] = [
    { id: "operation", label: "Operação" },
    { id: "participant", label: "Participante" },
    { id: "items", label: "Itens" },
    { id: "transport", label: "Transporte" },
    { id: "review", label: "Revisão" },
];

const OPERATIONS: {
    id: OperationGroup;
    title: string;
    subtitle: string;
    icon: typeof FileText;
    purposes: string[];
}[] = [
    {
        id: "sale",
        title: "Venda",
        subtitle: "Venda interna ou interestadual",
        icon: FileCheck2,
        purposes: ["Venda comum", "Venda para entrega futura", "Venda a ordem"],
    },
    {
        id: "return",
        title: "Devolução",
        subtitle: "Devolução de compra ou venda",
        icon: RotateCcw,
        purposes: ["Devolução de compra", "Devolução de venda"],
    },
    {
        id: "shipment",
        title: "Remessa/Retorno",
        subtitle: "Garantia, conserto, demonstração ou industrialização",
        icon: Repeat2,
        purposes: [
            "Remessa para conserto",
            "Retorno de conserto",
            "Remessa em garantia",
            "Retorno de garantia",
            "Remessa para demonstração",
            "Retorno de demonstração",
            "Remessa para industrialização",
            "Retorno de industrialização",
        ],
    },
    {
        id: "transfer",
        title: "Transferência",
        subtitle: "Entre filiais ou depósitos",
        icon: Warehouse,
        purposes: ["Transferência entre filiais", "Transferência para depósito", "Retorno de depósito"],
    },
    {
        id: "bonus",
        title: "Bonificação/Doação",
        subtitle: "Bonificação, brinde ou doação",
        icon: Gift,
        purposes: ["Bonificação", "Brinde", "Doação"],
    },
    {
        id: "advanced",
        title: "Outra operação",
        subtitle: "Modo avançado com validações",
        icon: ShieldCheck,
        purposes: ["Operação avançada"],
    },
];

const emptyParticipant: Participant = {
    nome: "",
    cpf_cnpj: "",
    inscricao_estadual: "",
    ind_ie_dest: "9",
    email: "",
    telefone: "",
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    codigo_municipio: "",
};

function digits(value: string) {
    return value.replace(/\D/g, "");
}

function isValidDoc(value: string) {
    const clean = digits(value);
    return clean.length === 11 || clean.length === 14;
}

function cnpjBase(value: string) {
    const clean = digits(value);
    if (clean.length !== 14) return "";
    return clean.slice(0, 8);
}

function normalizeAddress(raw: any) {
    return {
        cep: raw?.cep || "",
        logradouro: raw?.logradouro || raw?.rua || "",
        numero: raw?.numero || "",
        bairro: raw?.bairro || "",
        cidade: raw?.cidade || "",
        uf: String(raw?.uf || "").toUpperCase(),
        codigo_municipio: raw?.codigo_municipio || raw?.codigo_municipio_ibge || "",
    };
}

function participantFromNFeDest(dest: any): Participant {
    const end = dest?.enderDest || {};
    return {
        nome: dest?.xNome || "",
        cpf_cnpj: dest?.CNPJ || dest?.CPF || "",
        inscricao_estadual: dest?.IE || "",
        ind_ie_dest: dest?.IE ? "1" : "9",
        email: dest?.email || "",
        telefone: "",
        cep: end?.CEP || "",
        logradouro: end?.xLgr || "",
        numero: end?.nro || "",
        bairro: end?.xBairro || "",
        cidade: end?.xMun || "",
        uf: String(end?.UF || "").toUpperCase(),
        codigo_municipio: String(end?.cMun || ""),
    };
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function cloneItemFromDet(det: any): DraftItem {
    const prod = det?.prod || {};
    const icms = det?.imposto?.ICMS || {};
    const icmsKey = Object.keys(icms)[0] || "";
    const icmsPayload = icmsKey ? (icms[icmsKey] || {}) : {};
    return {
        id: crypto.randomUUID(),
        codigo: String(prod.cProd || ""),
        descricao: String(prod.xProd || ""),
        ncm: String(prod.NCM || ""),
        unidade: String(prod.uCom || "UN"),
        quantidade: Number(prod.qCom || 1),
        valor_unitario: Number(prod.vUnCom || 0),
        origem: String(icmsPayload.orig ?? "0"),
        cfop: String(prod.CFOP || ""),
        csosn: String(icmsPayload.CSOSN || icmsPayload.CST || "102"),
    };
}

function money(value: number) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getGuidedCfop(operation: OperationGroup, purpose: string, isInterstate: boolean) {
    const prefix = isInterstate ? "6" : "5";

    if (operation === "sale") return `${prefix}102`;
    if (operation === "return") return `${prefix}202`;
    if (operation === "bonus") return `${prefix}910`;

    if (operation === "shipment") {
        if (purpose === "Remessa para conserto") return `${prefix}915`;
        if (purpose === "Retorno de conserto") return `${prefix}916`;
        if (purpose === "Remessa em garantia") return `${prefix}915`;
        if (purpose === "Retorno de garantia") return `${prefix}916`;
        if (purpose === "Remessa para demonstração") return `${prefix}912`;
        if (purpose === "Retorno de demonstração") return `${prefix}913`;
        if (purpose === "Remessa para industrialização") return `${prefix}901`;
        if (purpose === "Retorno de industrialização") return `${prefix}902`;
    }

    if (operation === "transfer") {
        if (purpose === "Retorno de depósito") return `${prefix}153`;
        return `${prefix}152`;
    }

    return "";
}

function getOperationRuleStatus(operation: OperationGroup, purpose: string) {
    if (operation === "transfer") {
        return {
            title: "Transferência com emissão MVP",
            detail: "Emissão liberada para transferência entre filiais/depósitos com CFOP guiado. Cenários especiais devem ser alinhados com o contador.",
        };
    }

    if (operation === "bonus") {
        return {
            title: "Bonificação/Doação com emissão MVP",
            detail: "Emissão liberada para Bonificação, Brinde e Doação com CFOP guiado. Regras especiais permanecem sob validação contábil.",
        };
    }

    return {
            title: "Cenário ainda bloqueado para emissão",
        detail: `A finalidade "${purpose}" precisa de parametrizacao fiscal antes da transmissao.`,
    };
}

function getShipmentRuleStatus(purpose: string) {
    if (purpose.includes("garantia")) {
        return {
            title: "Sugestão inicial: tratar como conserto/garantia",
            detail: "A tela sugere CFOP de conserto/reparo para remessa em garantia, mas a emissão real ainda precisa parametrização e validação do contador.",
        };
    }

    if (purpose.includes("industrialização")) {
        return {
            title: "Industrializacao exige regra propria",
            detail: "A sugestão de CFOP é apenas estrutural. Antes de emitir, será necessário parametrizar retorno, insumos, cobrança e observações fiscais.",
        };
    }

    return {
        title: "Rascunho com CFOP sugerido",
        detail: "Esta finalidade ja recebe CFOP sugerido para revisao, mas continua bloqueada para transmissao ate o motor fiscal ser liberado.",
    };
}

function makeItem(): DraftItem {
    return {
        id: crypto.randomUUID(),
        codigo: "",
        descricao: "",
        ncm: "",
        unidade: "UN",
        quantidade: 1,
        valor_unitario: 0,
        origem: "0",
        cfop: "",
        csosn: "102",
    };
}

export default function NFeCompletaPage() {
    const { profile } = useAuth();
    const supabase = useMemo(() => createClient(), []);

    const [step, setStep] = useState<StepId>("operation");
    const [operation, setOperation] = useState<OperationGroup>("sale");
    const [purpose, setPurpose] = useState("Venda comum");
    const [environment, setEnvironment] = useState<"homologation" | "production">("homologation");
    const [advancedNature, setAdvancedNature] = useState("");
    const [advancedTpNF, setAdvancedTpNF] = useState<"0" | "1">("1");
    const [advancedFinNFe, setAdvancedFinNFe] = useState<"1" | "2" | "3" | "4">("1");

    const [companyUf, setCompanyUf] = useState("");
    const [companyCnpjBase, setCompanyCnpjBase] = useState("");
    const [participantMode, setParticipantMode] = useState<"search" | "manual">("search");
    const [participantSearch, setParticipantSearch] = useState("");
    const [participantSearchLocked, setParticipantSearchLocked] = useState(false);
    const [clientResults, setClientResults] = useState<ClientResult[]>([]);
    const [searchingClients, setSearchingClients] = useState(false);
    const [savingParticipantClient, setSavingParticipantClient] = useState(false);
    const [participantClientFeedback, setParticipantClientFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [participant, setParticipant] = useState<Participant>(emptyParticipant);
    const [loadingCep, setLoadingCep] = useState(false);

    const [referencedKey, setReferencedKey] = useState("");
    const [entryInvoices, setEntryInvoices] = useState<EntryInvoiceSummary[]>([]);
    const [legacyGuaranteeInvoices, setLegacyGuaranteeInvoices] = useState<EntryInvoiceSummary[]>([]);
    const [entrySearch, setEntrySearch] = useState("");
    const [originQuickFilter, setOriginQuickFilter] = useState<"recent" | "all">("recent");
    const [originSelectorExpanded, setOriginSelectorExpanded] = useState(false);
    const [originSearchStarted, setOriginSearchStarted] = useState(false);
    const [loadingEntryInvoices, setLoadingEntryInvoices] = useState(false);
    const [selectedEntryInvoice, setSelectedEntryInvoice] = useState<EntryInvoiceSummary | null>(null);
    const [returnItems, setReturnItems] = useState<ReturnItemState[]>([]);
    const [loadingEntryItems, setLoadingEntryItems] = useState(false);
    const [items, setItems] = useState<DraftItem[]>([makeItem()]);
    const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
    const [modFrete, setModFrete] = useState("9");
    const [carrierName, setCarrierName] = useState("");
    const [carrierDoc, setCarrierDoc] = useState("");
    const [volumes, setVolumes] = useState("");
    const [infCpl, setInfCpl] = useState("");
    const [infAdFisco, setInfAdFisco] = useState("");
    const [aiAudit, setAiAudit] = useState<string | null>(null);
    const [emitting, setEmitting] = useState(false);
    const [cloneModalOpen, setCloneModalOpen] = useState(false);
    const [cloneSearch, setCloneSearch] = useState("");
    const [cloneStatus, setCloneStatus] = useState<"authorized" | "error" | "rejected" | "all">("authorized");
    const [cloneResults, setCloneResults] = useState<CloneInvoiceSummary[]>([]);
    const [cloneLoading, setCloneLoading] = useState(false);
    const [clonedFrom, setClonedFrom] = useState<CloneInvoiceSummary | null>(null);

    const currentOperation = OPERATIONS.find((item) => item.id === operation) || OPERATIONS[0];
    const stepIndex = STEPS.findIndex((item) => item.id === step);
    const participantUf = participant.uf.trim().toUpperCase();
    const isVendaComumMvp = operation === "sale" && purpose === "Venda comum";
    const isRemessaConsertoMvp = operation === "shipment" && purpose === "Remessa para conserto";
    const isRemessaGarantiaMvp = operation === "shipment" && purpose === "Remessa em garantia";
    const isRetornoConsertoMvp = operation === "shipment" && purpose === "Retorno de conserto";
    const isRetornoGarantiaMvp = operation === "shipment" && purpose === "Retorno de garantia";
    const isRetornoDepositoMvp = operation === "transfer" && purpose === "Retorno de depósito";
    const isTransferenciaMvp = operation === "transfer" && ["Transferência entre filiais", "Transferência para depósito", "Retorno de depósito"].includes(purpose);
    const isBonusMvp = operation === "bonus" && ["Bonificação", "Brinde", "Doação"].includes(purpose);
    const isSalePurposeUnavailable = operation === "sale" && purpose !== "Venda comum";
    const isReturnPurposeUnavailable = operation === "return" && purpose !== "Devolução de compra";
    const usesOriginItems = operation === "return" || isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp;
    const isEmissionSupported = isVendaComumMvp || isRemessaConsertoMvp || isRemessaGarantiaMvp || isRetornoConsertoMvp || isRetornoGarantiaMvp || isTransferenciaMvp || isBonusMvp;
    const destinationLabel = !participantUf || !companyUf
        ? "Aguardando endereco"
        : participantUf === companyUf
            ? "Operação interna"
            : "Operação interestadual";
    const totalItems = items.reduce((sum, item) => sum + item.quantidade * item.valor_unitario, 0);
    const requiresReference = operation === "return" || isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp;
    const selectedReturnItems = returnItems.filter((item) => item.selected && item.qtd_devolver > 0);
    const returnTotal = selectedReturnItems.reduce((sum, item) => sum + item.qtd_devolver * item.valor_unitario, 0);
    const displayTotal = usesOriginItems ? returnTotal : totalItems;
    const isReferenceSelectionPending = requiresReference && !selectedEntryInvoice;
    const shouldShowOriginSelector = requiresReference && !isReturnPurposeUnavailable;
    const participantCnpjBase = cnpjBase(participant.cpf_cnpj);
    const isTransferBetweenBranches = operation === "transfer" && purpose === "Transferência entre filiais";
    const isTransferDepositFlow = operation === "transfer" && (purpose === "Transferência para depósito" || purpose === "Retorno de depósito");
    const transferHasDifferentRoot = Boolean(companyCnpjBase && participantCnpjBase && companyCnpjBase !== participantCnpjBase);

    useEffect(() => {
        const loadCompany = async () => {
            if (!profile?.organization_id) return;

            const { data } = await supabase
                .from("company_settings")
                .select("uf, cnpj, cpf_cnpj")
                .eq("organization_id", profile.organization_id)
                .maybeSingle();

            setCompanyUf(String(data?.uf || "").toUpperCase());
            setCompanyCnpjBase(cnpjBase(String(data?.cnpj || data?.cpf_cnpj || "")));
        };

        loadCompany();
    }, [profile?.organization_id, supabase]);

    useEffect(() => {
        const op = OPERATIONS.find((item) => item.id === operation);
        setPurpose(op?.purposes[0] || "");
        setAiAudit(null);
        if (operation !== "advanced") {
            setAdvancedNature("");
            setAdvancedTpNF("1");
            setAdvancedFinNFe("1");
        }
    }, [operation]);

    useEffect(() => {
        setSelectedEntryInvoice(null);
        setReferencedKey("");
        setReturnItems([]);
        setEntrySearch("");
        setOriginQuickFilter("recent");
        setOriginSelectorExpanded(false);
        setOriginSearchStarted(false);
        setLegacyGuaranteeInvoices([]);
    }, [operation, purpose]);

    useEffect(() => {
        if (!profile?.organization_id || !requiresReference) return;

        const loadEntryInvoices = async () => {
            setLoadingEntryInvoices(true);
            try {
                const baseQuery = supabase
                    .from("fiscal_invoices")
                    .select("id,numero,emitente_nome,emitente_cnpj,destinatario_nome,destinatario_cnpj,valor_total,data_emissao,chave_acesso,direction,payload_json")
                    .eq("organization_id", profile.organization_id)
                    .eq("tipo_documento", "NFe")
                    .order("data_emissao", { ascending: false })
                    .limit(80);

                if (operation === "return") {
                    const { data: strictData, error: strictError } = await baseQuery.eq("direction", "entry");
                    if (strictError) {
                        console.warn("[NFe Completa] Falha ao buscar NF-e de entrada (direction=entry):", strictError.message);
                    }

                    let invoices = (strictData || []) as EntryInvoiceSummary[];

                    // Fallback para base legada onde direction pode estar nulo.
                    if (invoices.length === 0) {
                        const { data: legacyData, error: legacyError } = await supabase
                            .from("fiscal_invoices")
                            .select("id,numero,emitente_nome,emitente_cnpj,destinatario_nome,destinatario_cnpj,valor_total,data_emissao,chave_acesso,direction,payload_json")
                            .eq("organization_id", profile.organization_id)
                            .eq("tipo_documento", "NFe")
                            .is("direction", null)
                            .not("xml_content", "is", null)
                            .order("data_emissao", { ascending: false })
                            .limit(80);

                        if (legacyError) {
                            console.warn("[NFe Completa] Falha no fallback de NF-e de origem legado:", legacyError.message);
                        } else {
                            invoices = (legacyData || []) as EntryInvoiceSummary[];
                        }
                    }

                    setEntryInvoices(invoices);
                    return;
                }

                const { data, error } = await baseQuery
                    .eq("direction", "output")
                    .eq("status", "authorized")
                    .eq("environment", environment);

                if (error) {
                    console.warn("[NFe Completa] Falha ao buscar remessas autorizadas:", error.message);
                    setEntryInvoices([]);
                    return;
                }

                const invoices = (data || []).filter((invoice: any) => {
                    const natOp = String(invoice.payload_json?.infNFe?.ide?.natOp || "").toUpperCase();
                    const infCpl = String(invoice.payload_json?.infNFe?.infAdic?.infCpl || "").toUpperCase();
                    const text = `${natOp} ${infCpl}`;
                    const isRemessa = natOp.includes("REMESSA");
                    const isTransferencia = natOp.includes("TRANSFERENCIA");
                    const hasGarantia = text.includes("GARANTIA");
                    const hasConserto = text.includes("CONSERTO") || text.includes("REPARO");
                    const hasDeposito = text.includes("DEPOSITO");

                    if (isRetornoDepositoMvp) {
                        return isTransferencia && hasDeposito && !natOp.includes("RETORNO");
                    }

                    if (!isRemessa) return false;

                    if (isRetornoGarantiaMvp) {
                        return hasGarantia;
                    }
                    return hasConserto && !hasGarantia;
                });

                if (isRetornoGarantiaMvp) {
                    const legacy = (data || []).filter((invoice: any) => {
                        const natOp = String(invoice.payload_json?.infNFe?.ide?.natOp || "").toUpperCase();
                        const infCpl = String(invoice.payload_json?.infNFe?.infAdic?.infCpl || "").toUpperCase();
                        return natOp.includes("REMESSA") && natOp.includes("CONSERTO") && infCpl.includes("GARANTIA");
                    }) as EntryInvoiceSummary[];
                    setLegacyGuaranteeInvoices(legacy);
                } else {
                    setLegacyGuaranteeInvoices([]);
                }

                setEntryInvoices(invoices as EntryInvoiceSummary[]);
            } finally {
                setLoadingEntryInvoices(false);
            }
        };

        loadEntryInvoices();
    }, [operation, purpose, requiresReference, environment, profile?.organization_id, supabase, isRetornoConsertoMvp, isRetornoGarantiaMvp, isRetornoDepositoMvp]);

    useEffect(() => {
        if (!profile?.organization_id || participantSearchLocked || participantSearch.trim().length < 2) {
            setClientResults([]);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setSearchingClients(true);
            const term = participantSearch.trim();

            const { data } = await supabase
                .from("clients")
                .select("id,nome,cpf_cnpj,whatsapp,email,endereco")
                .eq("organization_id", profile.organization_id)
                .or(`nome.ilike.%${term}%,cpf_cnpj.ilike.%${term}%,whatsapp.ilike.%${term}%`)
                .limit(8);

            if (!cancelled) {
                setClientResults((data || []) as ClientResult[]);
                setSearchingClients(false);
            }
        };

        const timeout = setTimeout(run, 250);
        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [participantSearch, profile?.organization_id, supabase]);

    useEffect(() => {
        if (!cloneModalOpen || !profile?.organization_id) return;

        let cancelled = false;
        const run = async () => {
            setCloneLoading(true);
            try {
                const organizationId = profile.organization_id as string;
                const data = await searchCloneableNFeInvoicesAction({
                    organizationId,
                    environment,
                    query: cloneSearch,
                    status: cloneStatus,
                });
                if (!cancelled) {
                    setCloneResults((data || []) as CloneInvoiceSummary[]);
                }
            } finally {
                if (!cancelled) setCloneLoading(false);
            }
        };

        const timeout = setTimeout(run, 220);
        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [cloneModalOpen, cloneSearch, cloneStatus, environment, profile?.organization_id]);

    const suggestedCfop = useMemo(() => {
        const isInterstate = participantUf && companyUf && participantUf !== companyUf;
        return getGuidedCfop(operation, purpose, Boolean(isInterstate));
    }, [operation, purpose, participantUf, companyUf]);

    useEffect(() => {
        if (operation === "advanced") return;
        setItems((current) => current.map((item) => ({ ...item, cfop: suggestedCfop })));
    }, [suggestedCfop, operation]);

    const filteredEntryInvoices = useMemo(() => {
        const term = entrySearch.trim().toLowerCase();
        const base = originQuickFilter === "recent"
            ? entryInvoices.slice(0, 10)
            : entryInvoices;

        if (!term) return base;

        return base.filter((invoice) => {
            return [
                invoice.numero || "",
                invoice.emitente_nome || "",
                invoice.emitente_cnpj || "",
                invoice.destinatario_nome || "",
                invoice.destinatario_cnpj || "",
                invoice.chave_acesso || "",
            ].join(" ").toLowerCase().includes(term);
        });
    }, [entryInvoices, entrySearch, originQuickFilter]);

    const filteredLegacyGuaranteeInvoices = useMemo(() => {
        const term = entrySearch.trim().toLowerCase();
        const base = originQuickFilter === "recent"
            ? legacyGuaranteeInvoices.slice(0, 10)
            : legacyGuaranteeInvoices;

        if (!term) return base;

        return base.filter((invoice) => {
            return [
                invoice.numero || "",
                invoice.emitente_nome || "",
                invoice.emitente_cnpj || "",
                invoice.destinatario_nome || "",
                invoice.destinatario_cnpj || "",
                invoice.chave_acesso || "",
            ].join(" ").toLowerCase().includes(term);
        });
    }, [legacyGuaranteeInvoices, entrySearch, originQuickFilter]);

    const pending = useMemo(() => {
        const issues: string[] = [];

        if (!operation) issues.push("Escolha o tipo de operação.");
        if (!purpose) issues.push("Escolha a finalidade específica.");
        if (operation === "advanced") {
            if (!advancedNature.trim()) issues.push("Informe a natureza da operação no modo assistido.");
            if (![ "0", "1" ].includes(advancedTpNF)) issues.push("Tipo da NF-e inválido no modo assistido.");
            if (![ "1", "2", "3", "4" ].includes(advancedFinNFe)) issues.push("Finalidade da NF-e inválida no modo assistido.");
        }
        if (!isEmissionSupported && operation !== "return" && operation !== "advanced") {
            issues.push("Emissão real indisponível para a combinação atual de operação/finalidade.");
        }
        if (operation === "return") {
            if (purpose !== "Devolução de compra") issues.push("Emissão real de devolução liberada apenas para Devolução de compra com NF-e de entrada importada.");
            if (!selectedEntryInvoice) issues.push("Selecione uma NF-e de entrada importada para devolução.");
            if (digits(referencedKey).length !== 44) issues.push("A nota de origem precisa ter chave de acesso válida.");
            if (selectedReturnItems.length === 0) issues.push("Selecione ao menos um item da nota de origem para devolver.");
        }
        if (isRetornoConsertoMvp || isRetornoGarantiaMvp) {
            if (!selectedEntryInvoice) issues.push(`Selecione uma NF-e de remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"} autorizada.`);
            if (digits(referencedKey).length !== 44) issues.push("A remessa de origem precisa ter chave de acesso válida.");
            if (selectedReturnItems.length === 0) issues.push("Selecione ao menos um item da remessa para retornar.");
        }
        if (isRetornoDepositoMvp) {
            if (!selectedEntryInvoice) issues.push("Selecione uma NF-e de transferência para depósito autorizada.");
            if (digits(referencedKey).length !== 44) issues.push("A transferência de origem precisa ter chave de acesso válida.");
            if (selectedReturnItems.length === 0) issues.push("Selecione ao menos um item da transferência para retornar.");
        }
        if (operation !== "return") {
            if (!participant.nome.trim()) issues.push("Informe ou selecione o participante.");
            if (!isValidDoc(participant.cpf_cnpj)) issues.push("Informe CPF/CNPJ válido do participante.");
            if (!participant.logradouro || !participant.numero || !participant.bairro || !participant.cidade || !participant.uf || !participant.cep || !participant.codigo_municipio) {
                issues.push("Complete o endereco do participante.");
            }
            if (!isRetornoConsertoMvp && !isRetornoGarantiaMvp && !isRetornoDepositoMvp) {
                if (items.length === 0) issues.push("Adicione ao menos um item.");
                items.forEach((item, index) => {
                    if (!item.descricao.trim()) issues.push(`Item ${index + 1}: informe a descrição.`);
                    if (!/^\d{8}$/.test(digits(item.ncm))) issues.push(`Item ${index + 1}: informe NCM válido.`);
                    if (!item.cfop || digits(item.cfop).length !== 4) issues.push(`Item ${index + 1}: CFOP pendente.`);
                    if (item.quantidade <= 0) issues.push(`Item ${index + 1}: quantidade deve ser maior que zero.`);
                    if (item.valor_unitario < 0) issues.push(`Item ${index + 1}: valor unitário inválido.`);
                });
            }
        }

        if (modFrete !== "9" && (!carrierName.trim() || !isValidDoc(carrierDoc))) {
            issues.push("Informe transportadora com CPF/CNPJ valido ou use frete sem transporte.");
        }

        if (isTransferBetweenBranches && transferHasDifferentRoot) {
            issues.push("Transferência entre filiais exige destinatário com a mesma raiz de CNPJ da empresa emitente.");
        }

        return issues;
    }, [operation, purpose, isEmissionSupported, isRetornoConsertoMvp, isRetornoGarantiaMvp, isRetornoDepositoMvp, selectedEntryInvoice, referencedKey, selectedReturnItems.length, participant, items, modFrete, carrierName, carrierDoc, isTransferBetweenBranches, transferHasDifferentRoot, advancedNature, advancedTpNF, advancedFinNFe]);

    const stepHasPending = (id: StepId) => {
        if (id === "operation") return !operation || !purpose || (requiresReference && (!selectedEntryInvoice || digits(referencedKey).length !== 44));
        if (id === "participant") return operation !== "return" && (!participant.nome || !isValidDoc(participant.cpf_cnpj) || !participant.uf || !participant.codigo_municipio);
        if (id === "items") return usesOriginItems ? selectedReturnItems.length === 0 : items.some((item) => !item.descricao || !/^\d{8}$/.test(digits(item.ncm)) || !item.cfop);
        if (id === "transport") return modFrete !== "9" && (!carrierName || !isValidDoc(carrierDoc));
        return pending.length > 0;
    };

    const goNext = () => {
        const next = STEPS[stepIndex + 1];
        if (next) setStep(next.id);
    };

    const goBack = () => {
        const prev = STEPS[stepIndex - 1];
        if (prev) setStep(prev.id);
    };

    const selectClient = (client: ClientResult) => {
        const address = normalizeAddress(client.endereco || {});
        setParticipant({
            id: client.id,
            nome: client.nome || "",
            cpf_cnpj: client.cpf_cnpj || "",
            inscricao_estadual: client.endereco?.inscricao_estadual || client.endereco?.ie || "",
            ind_ie_dest: client.endereco?.inscricao_estadual || client.endereco?.ie ? "1" : "9",
            email: client.email || "",
            telefone: client.whatsapp || "",
            ...address,
        });
        setParticipantSearch(client.nome);
        setParticipantSearchLocked(true);
        setClientResults([]);
    };

    const selectEntryInvoice = async (invoice: EntryInvoiceSummary) => {
        setSelectedEntryInvoice(invoice);
        setReferencedKey(invoice.chave_acesso || "");
        setOriginSelectorExpanded(false);
        setLoadingEntryItems(true);

        try {
            const data = operation === "return"
                ? await getEntryInvoiceWithItemsAction(invoice.id)
                : await getNFeInvoiceWithItemsAction(invoice.id);
            if (!data) {
                alert("Não foi possível carregar a NF-e de origem selecionada.");
                setReturnItems([]);
                return;
            }

            if (isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp) {
                const dest = data.invoice?.payload_json?.infNFe?.dest;
                if (dest) {
                    setParticipant(participantFromNFeDest(dest));
                    setParticipantMode("manual");
                }
            }

            setReturnItems(data.items.map((item) => ({
                ...item,
                selected: true,
                qtd_devolver: item.quantidade,
            })));
        } catch (error: any) {
            alert(error.message || "Erro ao carregar itens da NF-e de origem.");
            setReturnItems([]);
        } finally {
            setLoadingEntryItems(false);
        }
    };

    const updateReturnQty = (index: number, value: string) => {
        const quantity = Number(value) || 0;
        setReturnItems((current) => current.map((item, itemIndex) => (
            itemIndex === index
                ? { ...item, qtd_devolver: Math.min(Math.max(0, quantity), item.quantidade) }
                : item
        )));
    };

    const toggleReturnItem = (index: number) => {
        setReturnItems((current) => current.map((item, itemIndex) => (
            itemIndex === index ? { ...item, selected: !item.selected } : item
        )));
    };

    const buscaCepParticipante = async () => {
        const clean = digits(participant.cep);
        if (clean.length !== 8) return;

        setLoadingCep(true);
        try {
            const response = await fetch(`/api/cep?cep=${clean}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "CEP nao encontrado.");

            setParticipant((current) => ({
                ...current,
                cep: data.cep || current.cep,
                logradouro: data.logradouro || "",
                bairro: data.bairro || "",
                cidade: data.cidade || "",
                uf: String(data.uf || "").toUpperCase(),
                codigo_municipio: data.codigo_municipio || "",
            }));
        } catch (error: any) {
            alert(error.message || "Erro ao buscar CEP.");
        } finally {
            setLoadingCep(false);
        }
    };

    const updateItem = (id: string, patch: Partial<DraftItem>) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    };

    const handleSaveParticipantClient = async () => {
        if (!profile?.organization_id) {
            alert("Organizacao nao identificada. Recarregue a pagina e tente novamente.");
            return;
        }
        if (!participant.nome.trim()) {
            alert("Informe ao menos o nome do participante para salvar.");
            return;
        }
        if (!isValidDoc(participant.cpf_cnpj)) {
            alert("Informe CPF/CNPJ valido antes de salvar o cliente.");
            return;
        }

        const cleanDoc = digits(participant.cpf_cnpj);
        setSavingParticipantClient(true);
        try {
            const { data: existing, error: existingError } = await supabase
                .from("clients")
                .select("id")
                .eq("organization_id", profile.organization_id)
                .eq("cpf_cnpj", cleanDoc)
                .maybeSingle();

            if (existingError) throw existingError;
            if (existing?.id) {
                setParticipantClientFeedback({ type: "error", message: "Ja existe um cliente com este CPF/CNPJ." });
                return;
            }

            const { error } = await supabase
                .from("clients")
                .insert({
                    organization_id: profile.organization_id,
                    nome: participant.nome.trim(),
                    cpf_cnpj: cleanDoc,
                    whatsapp: participant.telefone?.trim() || null,
                    email: participant.email?.trim() || null,
                    endereco: {
                        cep: participant.cep || "",
                        rua: participant.logradouro || "",
                        logradouro: participant.logradouro || "",
                        numero: participant.numero || "",
                        bairro: participant.bairro || "",
                        cidade: participant.cidade || "",
                        uf: participant.uf || "",
                        codigo_municipio: participant.codigo_municipio || "",
                        inscricao_estadual: participant.inscricao_estadual || "",
                    },
                    public_token: crypto.randomUUID().replace(/-/g, ""),
                });

            if (error) throw error;
            setParticipantClientFeedback({ type: "success", message: "Cliente salvo com sucesso." });
            setParticipantMode("search");
            setParticipantSearch(participant.nome.trim());
            setParticipantSearchLocked(false);
        } catch (error: any) {
            setParticipantClientFeedback({ type: "error", message: error?.message || "Erro ao salvar cliente." });
        } finally {
            setSavingParticipantClient(false);
            setTimeout(() => setParticipantClientFeedback(null), 3500);
        }
    };

    const selectProductForItem = (itemId: string, product: ProductResult) => {
        updateItem(itemId, {
            codigo: product.id,
            descricao: product.nome || "",
            ncm: product.ncm || "",
            unidade: product.unidade || "UN",
            valor_unitario: Number(product.preco_venda || 0),
            cfop: operation === "advanced" ? (product.cfop || "") : suggestedCfop,
        });
        setFocusedItemId(null);
    };

    const collectTemplateOverrideWarnings = () => {
        const warnings: string[] = [];
        const defaultCsosn = isVendaComumMvp ? "102" : "400";

        if (operation === "advanced" || operation === "return") return warnings;

        items.forEach((item, index) => {
            if (item.cfop && suggestedCfop && item.cfop !== suggestedCfop) {
                warnings.push(`Item ${index + 1}: CFOP alterado para ${item.cfop} (sugerido ${suggestedCfop}).`);
            }
            if ((item.origem || "0") !== "0") {
                warnings.push(`Item ${index + 1}: origem alterada para ${item.origem}.`);
            }
            if ((item.csosn || defaultCsosn) !== defaultCsosn) {
                warnings.push(`Item ${index + 1}: CSOSN/CST alterado para ${item.csosn}.`);
            }
        });

        if (modFrete !== "9") {
            warnings.push(`Modalidade de frete alterada para ${modFrete}.`);
        }

        return warnings;
    };

    const runAutoAiAuditForAdvanced = async () => {
        const payload = {
            ambiente: environment,
            operacao: operation,
            natureza: advancedNature,
            tipo_nfe: advancedTpNF,
            finalidade_nfe: advancedFinNFe,
            classificacao_destino: destinationLabel,
            participante: participant,
            itens: items.map((item) => ({
                codigo: item.codigo,
                descricao: item.descricao,
                ncm: item.ncm,
                cfop: item.cfop,
                origem: item.origem,
                csosn: item.csosn,
                quantidade: item.quantidade,
                valor_unitario: item.valor_unitario,
                valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
            })),
            transporte: {
                modFrete,
                carrierName,
                carrierDoc,
                volumes,
            },
            campos_tecnicos: {
                suggestedCfop,
                purpose,
            },
            observacoes: {
                infCpl,
                infAdFisco,
            },
            total: Number(totalItems.toFixed(2)),
        };

        const audit = await auditarNFeAssistidaComIaAction(payload);
        if (!audit.success) {
            setAiAudit(`Falha ao auditar com IA: ${audit.error || "erro desconhecido"}`);
            return { ok: true, severe: false };
        }

        setAiAudit(audit.text || "Auditoria concluida.");
        const severe = audit.audit?.status === "inconsistente";
        if (severe) {
            const proceed = confirm(
                "A auditoria por IA encontrou inconsistencias provaveis.\n\n" +
                "Revise o bloco 'Auditoria por IA' e confirme apenas se houve validacao com o contador.\n\n" +
                "Deseja continuar mesmo assim?"
            );
            return { ok: proceed, severe: true };
        }

        return { ok: true, severe: false };
    };

    const applyCloneInvoice = async (invoice: CloneInvoiceSummary) => {
        const data = await getNFeInvoiceWithItemsAction(invoice.id);
        if (!data?.invoice?.payload_json?.infNFe) {
            alert("N?o foi poss?vel ler os dados da NF-e selecionada para clonagem.");
            return;
        }

        const infNFe = data.invoice.payload_json.infNFe;
        const dest = infNFe.dest || {};
        const detList = toArray<any>(infNFe.det);

        setParticipant(participantFromNFeDest(dest));
        setParticipantMode("manual");
        setItems(detList.length > 0 ? detList.map((det) => cloneItemFromDet(det)) : [makeItem()]);
        setModFrete(String(infNFe?.transp?.modFrete ?? "9"));
        setInfCpl(String(infNFe?.infAdic?.infCpl || ""));
        setAiAudit(null);
        setClonedFrom(invoice);
        setStep("review");
        setCloneModalOpen(false);
    };

    const handleEmitirVendaComum = async () => {
        if (!profile?.organization_id) {
            alert("Organizacao nao encontrada. Recarregue a pagina e tente novamente.");
            return;
        }

        if (!isVendaComumMvp) {
            alert("Nesta etapa, a emissão real da tela completa está liberada apenas para Venda comum.");
            return;
        }

        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const confirmMessage =
            `Emitir NF-e de Venda comum em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?\n\n` +
            `Destinatário: ${participant.nome}\n` +
            `Itens: ${items.length}\n` +
            `Total: ${money(totalItems)}`;

        if (!confirm(confirmMessage)) return;

        setEmitting(true);
        try {
            const result = await emitirNFeVendaAction({
                organization_id: profile.organization_id,
                cliente: {
                    nome: participant.nome,
                    cpf_cnpj: participant.cpf_cnpj,
                    email: participant.email || undefined,
                    telefone: participant.telefone || undefined,
                    endereco: {
                        cep: participant.cep,
                        logradouro: participant.logradouro,
                        numero: participant.numero,
                        bairro: participant.bairro,
                        cidade: participant.cidade,
                        uf: participant.uf,
                        codigo_municipio: participant.codigo_municipio,
                        inscricao_estadual: participant.inscricao_estadual,
                    },
                },
                itens: items.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: item.cfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
                })),
                valor_total: Number(totalItems.toFixed(2)),
                meio_pagamento: "01",
                environment,
                tipo_documento: "NFe",
            });

            if (result.success) {
                alert(result.message || "NF-e enviada para processamento.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir NF-e:\n${result.error || "Erro desconhecido"}`);
            }
        } catch (error: any) {
            alert(`Erro ao emitir NF-e:\n${error.message || "Erro desconhecido"}`);
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirDevolucao = async () => {
        if (!profile?.organization_id) {
            alert("Organizacao nao encontrada. Recarregue a pagina e tente novamente.");
            return;
        }

        if (purpose !== "Devolução de compra") {
            alert("Nesta etapa, a emissão real de devolução está liberada apenas para Devolução de compra com NF-e de entrada importada.");
            return;
        }

        if (!selectedEntryInvoice) {
            alert("Selecione uma NF-e de entrada para devolução.");
            return;
        }

        if (selectedReturnItems.length === 0) {
            alert("Selecione ao menos um item para devolver.");
            return;
        }

        const confirmMessage =
            `Emitir NF-e de Devolução em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?\n\n` +
            `Fornecedor: ${selectedEntryInvoice.emitente_nome || "-"}\n` +
            `Itens: ${selectedReturnItems.length}\n` +
            `Total: ${money(returnTotal)}`;

        if (!confirm(confirmMessage)) return;

        setEmitting(true);
        try {
            const result = await emitirNFeDevolucaoAction({
                organization_id: profile.organization_id,
                entry_invoice_id: selectedEntryInvoice.id,
                itens: selectedReturnItems.map((item) => ({
                    codigo: item.codigo,
                    descricao: item.descricao,
                    ncm: item.ncm,
                    unidade: item.unidade,
                    quantidade: item.qtd_devolver,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.qtd_devolver * item.valor_unitario).toFixed(2)),
                })),
                valor_total: Number(returnTotal.toFixed(2)),
                environment,
            });

            if (result.success) {
                alert("NF-e de devolução enviada.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir devolução:\n${result.error || "Erro desconhecido"}`);
            }
        } catch (error: any) {
            alert(`Erro ao emitir devolução:\n${error.message || "Erro desconhecido"}`);
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirRemessaConserto = async () => {
        if (!profile?.organization_id) {
            alert("Organizacao nao encontrada. Recarregue a pagina e tente novamente.");
            return;
        }

        if (!isRemessaConsertoMvp && !isRemessaGarantiaMvp) {
            alert("Nesta etapa, a emissão real de remessa está liberada apenas para Remessa para conserto e Remessa em garantia.");
            return;
        }

        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const remessaLabel = isRemessaGarantiaMvp ? "Remessa em garantia" : "Remessa para conserto";
        const confirmMessage =
            `Emitir NF-e de ${remessaLabel} em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?\n\n` +
            `Destinatário: ${participant.nome}\n` +
            `CFOP: ${suggestedCfop}\n` +
            `Itens: ${items.length}\n` +
            `Valor fiscal dos itens: ${money(totalItems)}\n\n` +
            "Esta nota sera emitida sem cobranca/pagamento.";

        if (!confirm(confirmMessage)) return;

        setEmitting(true);
        try {
            const payload = {
                organization_id: profile.organization_id,
                cliente: {
                    nome: participant.nome,
                    cpf_cnpj: participant.cpf_cnpj,
                    email: participant.email || undefined,
                    telefone: participant.telefone || undefined,
                    endereco: {
                        cep: participant.cep,
                        logradouro: participant.logradouro,
                        numero: participant.numero,
                        bairro: participant.bairro,
                        cidade: participant.cidade,
                        uf: participant.uf,
                        codigo_municipio: participant.codigo_municipio,
                        inscricao_estadual: participant.inscricao_estadual,
                    },
                },
                itens: items.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: suggestedCfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
                })),
                valor_total: Number(totalItems.toFixed(2)),
                meio_pagamento: "90",
                environment,
                tipo_documento: "NFe" as const,
                observacao: infCpl,
                modFrete,
            };

            const result = isRemessaGarantiaMvp
                ? await emitirNFeRemessaGarantiaUiAction({
                    ...payload,
                    observacao: infCpl || "REMESSA DE MERCADORIA/BEM EM GARANTIA. SEM INCIDENCIA DE COBRANCA.",
                })
                : await emitirNFeRemessaConsertoUiAction(payload);

            if (result.success) {
                alert(result.message || "NF-e de remessa enviada para processamento.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir remessa:\n${result.error || "Erro desconhecido"}`);
            }
        } catch (error: any) {
            alert(`Erro ao emitir remessa:\n${error.message || "Erro desconhecido"}`);
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirRetornoConserto = async () => {
        if (!profile?.organization_id) {
            alert("Organizacao nao encontrada. Recarregue a pagina e tente novamente.");
            return;
        }

        if (!isRetornoConsertoMvp && !isRetornoGarantiaMvp) {
            alert("Nesta etapa, a emissão real de retorno está liberada apenas para Retorno de conserto e Retorno de garantia.");
            return;
        }

        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const retornoLabel = isRetornoGarantiaMvp ? "Retorno de garantia" : "Retorno de conserto";
        const confirmMessage =
            `Emitir NF-e de ${retornoLabel} em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?\n\n` +
            `Destinatário: ${participant.nome}\n` +
            `NF-e origem: ${selectedEntryInvoice?.numero || "-"}\n` +
            `CFOP: ${suggestedCfop}\n` +
            `Itens: ${selectedReturnItems.length}\n` +
            `Valor fiscal dos itens: ${money(returnTotal)}\n\n` +
            "Esta nota sera emitida sem cobranca/pagamento e referenciara a NF-e original.";

        if (!confirm(confirmMessage)) return;

        setEmitting(true);
        try {
            const emissionResult = isRetornoGarantiaMvp
                ? await emitirNFeRetornoGarantiaUiAction({
                    organization_id: profile.organization_id,
                    cliente: {
                        nome: participant.nome,
                        cpf_cnpj: participant.cpf_cnpj,
                        email: participant.email || undefined,
                        telefone: participant.telefone || undefined,
                        endereco: {
                            cep: participant.cep,
                            logradouro: participant.logradouro,
                            numero: participant.numero,
                            bairro: participant.bairro,
                            cidade: participant.cidade,
                            uf: participant.uf,
                            codigo_municipio: participant.codigo_municipio,
                            inscricao_estadual: participant.inscricao_estadual,
                        },
                    },
                    itens: selectedReturnItems.map((item, index) => ({
                        codigo: item.codigo || `ITEM-${index + 1}`,
                        descricao: item.descricao,
                        ncm: digits(item.ncm),
                        cfop: suggestedCfop,
                        unidade: item.unidade || "UN",
                        quantidade: item.qtd_devolver,
                        valor_unitario: item.valor_unitario,
                        valor_total: Number((item.qtd_devolver * item.valor_unitario).toFixed(2)),
                    })),
                    valor_total: Number(returnTotal.toFixed(2)),
                    meio_pagamento: "90",
                    environment,
                    tipo_documento: "NFe",
                    observacao: infCpl,
                    modFrete,
                    referenced_key: referencedKey,
                })
                : await emitirNFeRetornoConsertoUiAction({
                organization_id: profile.organization_id,
                cliente: {
                    nome: participant.nome,
                    cpf_cnpj: participant.cpf_cnpj,
                    email: participant.email || undefined,
                    telefone: participant.telefone || undefined,
                    endereco: {
                        cep: participant.cep,
                        logradouro: participant.logradouro,
                        numero: participant.numero,
                        bairro: participant.bairro,
                        cidade: participant.cidade,
                        uf: participant.uf,
                        codigo_municipio: participant.codigo_municipio,
                        inscricao_estadual: participant.inscricao_estadual,
                    },
                },
                itens: selectedReturnItems.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: suggestedCfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.qtd_devolver,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.qtd_devolver * item.valor_unitario).toFixed(2)),
                })),
                valor_total: Number(returnTotal.toFixed(2)),
                meio_pagamento: "90",
                environment,
                tipo_documento: "NFe",
                observacao: infCpl,
                modFrete,
                referenced_key: referencedKey,
            });

            if (emissionResult.success) {
                alert(emissionResult.message || "NF-e de retorno enviada para processamento.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir retorno:\n${emissionResult.error || "Erro desconhecido"}`);
            }
        } catch (error: any) {
            alert(`Erro ao emitir retorno:\n${error.message || "Erro desconhecido"}`);
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirTransferencia = async () => {
        if (!profile?.organization_id) return;
        if (!isTransferenciaMvp) {
            alert("Finalidade de transferência ainda não habilitada para emissão.");
            return;
        }
        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        if (!confirm(`Emitir NF-e de ${purpose} em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?`)) return;
        setEmitting(true);
        try {
            const transferItemsPayload = isRetornoDepositoMvp
                ? selectedReturnItems.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: suggestedCfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.qtd_devolver,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.qtd_devolver * item.valor_unitario).toFixed(2)),
                }))
                : items.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: suggestedCfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
                }));

            const result = await emitirNFeTransferenciaUiAction({
                organization_id: profile.organization_id,
                cliente: {
                    nome: participant.nome,
                    cpf_cnpj: participant.cpf_cnpj,
                    email: participant.email || undefined,
                    telefone: participant.telefone || undefined,
                    endereco: {
                        cep: participant.cep,
                        logradouro: participant.logradouro,
                        numero: participant.numero,
                        bairro: participant.bairro,
                        cidade: participant.cidade,
                        uf: participant.uf,
                        codigo_municipio: participant.codigo_municipio,
                        inscricao_estadual: participant.inscricao_estadual,
                    },
                },
                itens: transferItemsPayload,
                valor_total: Number((isRetornoDepositoMvp ? returnTotal : totalItems).toFixed(2)),
                meio_pagamento: "90",
                environment,
                tipo_documento: "NFe",
                observacao: infCpl,
                modFrete,
                finalidade_transferencia: purpose as "Transferência entre filiais" | "Transferência para depósito" | "Retorno de depósito",
            });
            if (result.success) {
                alert(result.message || "NF-e de transferencia enviada.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir transferencia:\n${result.error || "Erro desconhecido"}`);
            }
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirBonificacaoDoacao = async () => {
        if (!profile?.organization_id) return;
        if (!isBonusMvp) {
            alert("Finalidade de bonificação/doação ainda não habilitada para emissão.");
            return;
        }
        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        if (!confirm(`Emitir NF-e de ${purpose} em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?`)) return;
        setEmitting(true);
        try {
            const result = await emitirNFeBonificacaoDoacaoUiAction({
                organization_id: profile.organization_id,
                cliente: {
                    nome: participant.nome,
                    cpf_cnpj: participant.cpf_cnpj,
                    email: participant.email || undefined,
                    telefone: participant.telefone || undefined,
                    endereco: {
                        cep: participant.cep,
                        logradouro: participant.logradouro,
                        numero: participant.numero,
                        bairro: participant.bairro,
                        cidade: participant.cidade,
                        uf: participant.uf,
                        codigo_municipio: participant.codigo_municipio,
                        inscricao_estadual: participant.inscricao_estadual,
                    },
                },
                itens: items.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: suggestedCfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
                })),
                valor_total: Number(totalItems.toFixed(2)),
                meio_pagamento: "90",
                environment,
                tipo_documento: "NFe",
                observacao: infCpl,
                modFrete,
                finalidade_bonus: purpose as "Bonificação" | "Brinde" | "Doação",
            });
            if (result.success) {
                alert(result.message || "NF-e de bonificacao/doacao enviada.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir bonificacao/doacao:\n${result.error || "Erro desconhecido"}`);
            }
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirAssistida = async () => {
        if (!profile?.organization_id) return;
        if (operation !== "advanced") return;
        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const confirmMessage =
            `Emitir NF-e assistida em ${environment === "production" ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}?\n\n` +
            `Natureza: ${advancedNature}\n` +
            `Tipo NF-e: ${advancedTpNF === "1" ? "Saída" : "Entrada"}\n` +
            `Finalidade: ${advancedFinNFe}\n` +
            `Itens: ${items.length}\n` +
            `Total: ${money(totalItems)}`;
        if (!confirm(confirmMessage)) return;

        setEmitting(true);
        try {
            const result = await emitirNFeAssistidaUiAction({
                organization_id: profile.organization_id,
                cliente: {
                    nome: participant.nome,
                    cpf_cnpj: participant.cpf_cnpj,
                    email: participant.email || undefined,
                    telefone: participant.telefone || undefined,
                    endereco: {
                        cep: participant.cep,
                        logradouro: participant.logradouro,
                        numero: participant.numero,
                        bairro: participant.bairro,
                        cidade: participant.cidade,
                        uf: participant.uf,
                        codigo_municipio: participant.codigo_municipio,
                        inscricao_estadual: participant.inscricao_estadual,
                    },
                },
                itens: items.map((item, index) => ({
                    codigo: item.codigo || `ITEM-${index + 1}`,
                    descricao: item.descricao,
                    ncm: digits(item.ncm),
                    cfop: item.cfop,
                    unidade: item.unidade || "UN",
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: Number((item.quantidade * item.valor_unitario).toFixed(2)),
                    csosn: item.csosn,
                    origem: item.origem,
                })),
                valor_total: Number(totalItems.toFixed(2)),
                meio_pagamento: "90",
                environment,
                tipo_documento: "NFe",
                observacao: infCpl,
                modFrete,
                natureza_operacao: advancedNature,
                tipo_nfe: Number(advancedTpNF) as 0 | 1,
                finalidade_nfe: Number(advancedFinNFe) as 1 | 2 | 3 | 4,
            });

            if (result.success) {
                alert(result.message || "NF-e assistida enviada.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir assistida:\n${result.error || "Erro desconhecido"}`);
            }
        } finally {
            setEmitting(false);
        }
    };

    const handleEmitirNFe = async () => {
        if (operation !== "advanced") {
            const warnings = collectTemplateOverrideWarnings();
            if (warnings.length > 0) {
                const proceed = confirm(
                    "Existem par?metros t?cnicos alterados na pr?-emiss?o:\n\n" +
                    warnings.map((item) => `- ${item}`).join("\n") +
                    "\n\nConfirme apenas se esses ajustes foram revisados com o contador.\n\nDeseja emitir mesmo assim?"
                );
                if (!proceed) return;
            }
        }

        if (operation === "return") {
            handleEmitirDevolucao();
            return;
        }

        if (isRemessaConsertoMvp || isRemessaGarantiaMvp) {
            handleEmitirRemessaConserto();
            return;
        }

        if (isRetornoConsertoMvp || isRetornoGarantiaMvp) {
            handleEmitirRetornoConserto();
            return;
        }

        if (isTransferenciaMvp) {
            handleEmitirTransferencia();
            return;
        }

        if (isBonusMvp) {
            handleEmitirBonificacaoDoacao();
            return;
        }

        if (operation === "advanced") {
            const audit = await runAutoAiAuditForAdvanced();
            if (!audit.ok) return;
            handleEmitirAssistida();
            return;
        }

        handleEmitirVendaComum();
    };

    const fieldClass = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 outline-none transition focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20";
    const labelClass = "ml-1 text-[10px] font-black uppercase text-stone-400";
    const participantFieldClass = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A]/15";
    const participantLabelClass = "ml-1 text-[10px] font-black uppercase text-stone-600";
    const itemFieldClass = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-[#1A1A1A] focus:ring-2 focus:ring-[#1A1A1A]/15";
    const itemLabelClass = "ml-1 text-[10px] font-black uppercase text-stone-600";
    const previewItems: DraftItem[] = usesOriginItems
        ? selectedReturnItems.map((item, index) => ({
            id: `${item.codigo}-${index}`,
            codigo: item.codigo,
            descricao: item.descricao,
            ncm: item.ncm,
            unidade: item.unidade,
            quantidade: item.qtd_devolver,
            valor_unitario: item.valor_unitario,
            origem: "0",
            cfop: suggestedCfop,
            csosn: "espelho",
        }))
        : items;

    return (
        <div className="mx-auto max-w-7xl space-y-5 pb-32">
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <Link href="/fiscal">
                        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm transition hover:bg-stone-50">
                            <ArrowLeft size={18} />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-[#1A1A1A]">Emissão completa de NF-e</h1>
                        <p className="text-sm font-medium text-stone-500">Rascunho guiado para operações comuns e modo avançado.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_320px] lg:items-center">
                    <div className="hidden lg:block" />

                    <div className="flex justify-start lg:justify-end">
                        <button
                            type="button"
                            onClick={() => setCloneModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700 shadow-sm transition hover:bg-stone-50"
                        >
                            <Copy size={14} />
                            Clonar nota
                        </button>
                    </div>

                    <div className="flex w-fit items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm lg:justify-self-end">
                        <button
                            type="button"
                            onClick={() => setEnvironment("homologation")}
                            className={`rounded-lg px-4 py-2 text-xs font-black transition ${environment === "homologation" ? "bg-yellow-100 text-yellow-700" : "text-stone-400 hover:text-stone-700"}`}
                        >
                            Homologação
                        </button>
                        <button
                            type="button"
                            onClick={() => setEnvironment("production")}
                            className={`rounded-lg px-4 py-2 text-xs font-black transition ${environment === "production" ? "bg-green-100 text-green-700" : "text-stone-400 hover:text-stone-700"}`}
                        >
                            Produção
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr_320px]">
                <aside className="space-y-3">
                    <div className="rounded-2xl border border-stone-100 bg-white p-3 shadow-sm">
                        {STEPS.map((item, index) => {
                            const active = item.id === step;
                            const done = index < stepIndex;
                            const next = index === stepIndex + 1;
                            const cloneUnlocked = Boolean(clonedFrom);
                            const unlocked = cloneUnlocked || active || done || next;
                            const blocked = stepHasPending(item.id);

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        if (!unlocked) return;
                                        setStep(item.id);
                                    }}
                                    disabled={!unlocked}
                                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition last:mb-0 ${active
                                        ? "bg-[#1A1A1A] text-[#FACC15]"
                                        : unlocked
                                            ? "text-stone-900 hover:bg-stone-50"
                                            : "cursor-not-allowed text-stone-400 opacity-55"}`}
                                >
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${active
                                        ? "bg-[#FACC15] text-[#1A1A1A]"
                                        : done
                                            ? "bg-stone-900 text-white"
                                            : next
                                                ? "bg-stone-900 text-white"
                                                : "bg-stone-100 text-stone-400"}`}>
                                        {done ? <CheckCircle size={14} /> : index + 1}
                                    </span>
                                    <span className="flex-1 text-sm font-black">{item.label}</span>
                                    {blocked && unlocked && <AlertCircle size={14} className={active ? "text-[#FACC15]" : "text-red-400"} />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase text-stone-400">Resumo</p>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-stone-500">Operação</span>
                                <span className="text-right font-black text-stone-800">{currentOperation.title}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-stone-500">Destino</span>
                                <span className="text-right font-black text-stone-800">{destinationLabel}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                                <span className="text-stone-500">Itens</span>
                                <span className="font-black text-stone-800">{usesOriginItems ? selectedReturnItems.length : items.length}</span>
                            </div>
                            <div className="border-t border-stone-100 pt-2">
                                <div className="flex justify-between gap-3">
                                    <span className="text-stone-500">Total</span>
                                    <span className="font-black text-[#1A1A1A]">{money(displayTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="min-h-[640px] rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
                    {clonedFrom && (
                        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                            <p className="text-sm font-black text-blue-800">Rascunho clonado da NF {clonedFrom.numero || "-"}.</p>
                            <p className="mt-1 text-xs font-medium text-blue-700">Revise os campos e valide novamente antes de emitir.</p>
                        </div>
                    )}
                    {step === "operation" && (
                        <section className="space-y-5">
                            <div>
                                <h2 className="text-lg font-black text-[#1A1A1A]">Tipo de operação</h2>
                                <p className="text-sm text-stone-500">Escolha a natureza de negócio. O CFOP vem depois, como resultado das regras.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {OPERATIONS.map((item) => {
                                    const Icon = item.icon;
                                    const active = operation === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setOperation(item.id)}
                                            className={`rounded-2xl border p-4 text-left transition ${active ? "border-[#FACC15] bg-[#FACC15]/10 shadow-sm" : "border-stone-200 hover:border-stone-300 hover:bg-stone-50"}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-[#1A1A1A] text-[#FACC15]" : "bg-stone-100 text-stone-500"}`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-black text-[#1A1A1A]">{item.title}</p>
                                                    <p className="mt-1 text-xs font-medium text-stone-500">{item.subtitle}</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {operation !== "advanced" && (
                                <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                    <label className={labelClass}>Finalidade específica</label>
                                    <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldClass}>
                                        {currentOperation.purposes.map((item) => (
                                            <option key={item} value={item}>{item}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {operation === "advanced" && (
                                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                    <p className="text-sm font-black text-blue-800">Pra fazer nota aqui é fundamental ter o auxílio do contador.</p>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div className="md:col-span-3">
                                            <label className={labelClass}>Natureza da operação</label>
                                            <input
                                                value={advancedNature}
                                                onChange={(e) => setAdvancedNature(e.target.value)}
                                                className={fieldClass}
                                                placeholder="Ex: REMESSA PARA DEMONSTRAÇÃO"
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Tipo NF-e</label>
                                            <select value={advancedTpNF} onChange={(e) => setAdvancedTpNF(e.target.value as "0" | "1")} className={fieldClass}>
                                                <option value="1">1 - Saída</option>
                                                <option value="0">0 - Entrada</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Finalidade NF-e</label>
                                            <select value={advancedFinNFe} onChange={(e) => setAdvancedFinNFe(e.target.value as "1" | "2" | "3" | "4")} className={fieldClass}>
                                                <option value="1">1 - Normal</option>
                                                <option value="2">2 - Complementar</option>
                                                <option value="3">3 - Ajuste</option>
                                                <option value="4">4 - Devolução/Retorno</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {shouldShowOriginSelector && (
                                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                                    <div className="flex flex-col gap-3">
                                        {loadingEntryInvoices && <Loader2 size={18} className="animate-spin text-orange-500" />}

                                        <button
                                            type="button"
                                            onClick={() => setOriginSelectorExpanded((current) => !current)}
                                            className="flex w-full items-center justify-between rounded-xl border border-orange-200 bg-white px-3 py-3 text-left text-sm font-black text-orange-800 transition hover:bg-orange-50"
                                        >
                                            <span>{selectedEntryInvoice ? "Trocar nota de origem" : "Escolha a nota de origem"}</span>
                                            <ChevronRight size={16} className={`transition ${originSelectorExpanded ? "rotate-90" : ""}`} />
                                        </button>
                                    </div>

                                    {originSelectorExpanded && (
                                        <div className="mt-4 space-y-3">
                                            <p className="text-sm font-medium text-orange-700">
                                                Para continuar escolha a nota em que chegou a(s) peça(s) a ser(em) devolvida(s).
                                            </p>

                                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                                <div className="flex-1">
                                                    <label className="ml-1 text-[10px] font-black uppercase text-orange-500">
                                                        {(isRetornoConsertoMvp || isRetornoGarantiaMvp)
                                                            ? `Buscar remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"}`
                                                            : isRetornoDepositoMvp
                                                                ? "Buscar transferência para depósito"
                                                                : "Buscar NF-e de entrada"}
                                                    </label>
                                                    <input
                                                        value={entrySearch}
                                                        onChange={(e) => {
                                                            setEntrySearch(e.target.value);
                                                            if (e.target.value.trim()) {
                                                                setOriginQuickFilter("all");
                                                                setOriginSearchStarted(true);
                                                            }
                                                        }}
                                                        className="mt-1 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                                                        placeholder={(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp) ? "Cliente, CPF/CNPJ, número ou chave" : "Fornecedor, CNPJ, número ou chave"}
                                                    />
                                                </div>

                                                <div className="flex w-fit gap-1 rounded-xl border border-orange-200 bg-orange-100 p-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOriginQuickFilter("recent");
                                                            setOriginSearchStarted(true);
                                                        }}
                                                        className={`rounded-lg px-3 py-2 text-xs font-black transition ${originQuickFilter === "recent" ? "bg-white text-orange-800 shadow-sm" : "text-orange-600"}`}
                                                    >
                                                        Últimas 10
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOriginQuickFilter("all");
                                                            setOriginSearchStarted(true);
                                                        }}
                                                        className={`rounded-lg px-3 py-2 text-xs font-black transition ${originQuickFilter === "all" ? "bg-white text-orange-800 shadow-sm" : "text-orange-600"}`}
                                                    >
                                                        Todas
                                                    </button>
                                                </div>
                                            </div>

                                            {!originSearchStarted ? (
                                                <p className="rounded-xl bg-white/70 p-3 text-sm font-medium text-orange-700">
                                                    Escolha um filtro ou use a busca para listar as notas.
                                                </p>
                                            ) : (
                                                <>
                                                    <p className="text-xs font-bold text-orange-700">
                                                        Mostrando {filteredEntryInvoices.length} de {entryInvoices.length} {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "remessa(s) autorizada(s)" : isRetornoDepositoMvp ? "transferencia(s) autorizada(s)" : "nota(s) encontrada(s)"}.
                                                    </p>

                                                    <div className="max-h-72 space-y-2 overflow-y-auto">
                                                        {filteredEntryInvoices.map((invoice) => {
                                                            const selected = selectedEntryInvoice?.id === invoice.id;
                                                            const emittedAt = invoice.data_emissao ? new Date(invoice.data_emissao).toLocaleDateString("pt-BR") : "sem data";
                                                            return (
                                                                <button
                                                                    key={invoice.id}
                                                                    type="button"
                                                                    onClick={() => selectEntryInvoice(invoice)}
                                                                    className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-orange-400 bg-white shadow-sm" : "border-orange-100 bg-white/70 hover:border-orange-300"}`}
                                                                >
                                                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                                        <div>
                                                                            <p className="font-black text-[#1A1A1A]">
                                                                                NF {invoice.numero || "-"} | {(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp) ? (invoice.destinatario_nome || "Destinatário sem nome") : (invoice.emitente_nome || "Fornecedor sem nome")}
                                                                            </p>
                                                                            <p className="mt-1 text-xs font-medium text-stone-500">
                                                                                {(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp) ? (invoice.destinatario_cnpj || "CNPJ pendente") : (invoice.emitente_cnpj || "CNPJ pendente")} | {invoice.chave_acesso || "chave pendente"}
                                                                            </p>
                                                                            <p className="mt-1 text-[10px] font-black uppercase text-orange-500">
                                                                                Emitida em {emittedAt}
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-sm font-black text-[#1A1A1A]">{money(Number(invoice.valor_total || 0))}</p>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                        {!loadingEntryInvoices && filteredEntryInvoices.length === 0 && (
                                                            <p className="rounded-xl bg-white/70 p-3 text-sm font-medium text-orange-700">
                                                                {(isRetornoConsertoMvp || isRetornoGarantiaMvp)
                                                                    ? `Nenhuma remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"} autorizada encontrada neste ambiente.`
                                                                    : isRetornoDepositoMvp
                                                                    ? "Nenhuma transferência para depósito autorizada encontrada neste ambiente."
                                                                        : "Nenhuma NF-e de entrada encontrada."}
                                                            </p>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {!originSelectorExpanded && selectedEntryInvoice && (
                                        <div className="mt-4 rounded-xl border border-orange-200 bg-white p-3">
                                            <p className="text-[10px] font-black uppercase text-orange-500">Nota selecionada</p>
                                            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="font-black text-[#1A1A1A]">
                                                        NF {selectedEntryInvoice.numero || "-"} | {(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp)
                                                            ? (selectedEntryInvoice.destinatario_nome || "Destinatário sem nome")
                                                            : (selectedEntryInvoice.emitente_nome || "Fornecedor sem nome")}
                                                    </p>
                                                    <p className="mt-1 text-xs font-medium text-stone-500">
                                                        {(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp)
                                                            ? (selectedEntryInvoice.destinatario_cnpj || "CNPJ pendente")
                                                            : (selectedEntryInvoice.emitente_cnpj || "CNPJ pendente")} | {selectedEntryInvoice.chave_acesso || "chave pendente"}
                                                    </p>
                                                    <p className="mt-1 text-[10px] font-black uppercase text-orange-500">
                                                        Emitida em {selectedEntryInvoice.data_emissao ? new Date(selectedEntryInvoice.data_emissao).toLocaleDateString("pt-BR") : "sem data"}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-black text-[#1A1A1A]">{money(Number(selectedEntryInvoice.valor_total || 0))}</p>
                                            </div>
                                        </div>
                                    )}

                                    {originSelectorExpanded && originSearchStarted && isRetornoGarantiaMvp && legacyGuaranteeInvoices.length > 0 && (
                                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                            <p className="text-xs font-black uppercase text-amber-700">
                                                Notas legadas (fora do padr?o atual): {legacyGuaranteeInvoices.length}
                                            </p>
                                            <p className="mt-1 text-xs font-medium text-amber-700">
                                                Estas notas têm observação de garantia, mas natureza de conserto. Ficam separadas e marcadas como legado.
                                            </p>
                                            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                                                {filteredLegacyGuaranteeInvoices.map((invoice) => {
                                                    const selected = selectedEntryInvoice?.id === invoice.id;
                                                    const emittedAt = invoice.data_emissao ? new Date(invoice.data_emissao).toLocaleDateString("pt-BR") : "sem data";
                                                    return (
                                                        <button
                                                            key={invoice.id}
                                                            type="button"
                                                            onClick={() => selectEntryInvoice(invoice)}
                                                            className={`w-full rounded-xl border p-3 text-left transition ${selected ? "border-amber-500 bg-white shadow-sm" : "border-amber-200 bg-white/80 hover:border-amber-400"}`}
                                                        >
                                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                                <div>
                                                                    <p className="font-black text-[#1A1A1A]">
                                                                        NF {invoice.numero || "-"} | {invoice.destinatario_nome || "Destinatário sem nome"}
                                                                    </p>
                                                                    <p className="mt-1 text-xs font-medium text-stone-500">
                                                                        {invoice.destinatario_cnpj || "CNPJ pendente"} | {invoice.chave_acesso || "chave pendente"}
                                                                    </p>
                                                                    <p className="mt-1 text-[10px] font-black uppercase text-amber-600">
                                                                        Legado • emitida em {emittedAt}
                                                                    </p>
                                                                </div>
                                                                <p className="text-sm font-black text-[#1A1A1A]">{money(Number(invoice.valor_total || 0))}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {isSalePurposeUnavailable && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Finalidade não disponível</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        Para essa finalidade, use "Outra operação" com a orientação do seu contador.
                                    </p>
                                </div>
                            )}

                            {isReturnPurposeUnavailable && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Finalidade não disponível</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        Para essa finalidade, use "Outra operação" com a orientação do seu contador.
                                    </p>
                                </div>
                            )}

                            {operation === "shipment" && !isRemessaConsertoMvp && !isRemessaGarantiaMvp && !isRetornoConsertoMvp && !isRetornoGarantiaMvp && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Finalidade não disponível</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        Para essa finalidade, use "Outra operação" com a orientação do seu contador.
                                    </p>
                                </div>
                            )}

                            {operation === "bonus" && null}

                            {operation !== "sale" && operation !== "return" && operation !== "advanced" && operation !== "shipment" && !isTransferenciaMvp && !isBonusMvp && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Rascunho sem emissão real nesta fase</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        Esta operação precisa de motor fiscal próprio antes de transmitir. A UI permite estruturar o rascunho, mas bloqueia a emissão.
                                    </p>
                                </div>
                            )}

                            {operation === "advanced" && null}
                        </section>
                    )}

                    {step === "participant" && (
                        <section className="space-y-5">
                            <div>
                                <h2 className="text-lg font-black text-[#1A1A1A]">Participante da nota</h2>
                                <p className="text-sm text-stone-500">
                                    {operation === "return"
                                        ? "Na devolução, o participante vem da NF-e de entrada selecionada."
                                        : "Busque um cadastro existente ou preencha um novo destinatário/remetente."}
                                </p>
                            </div>

                            {operation === "return" ? (
                                <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                    <p className="text-[10px] font-black uppercase text-stone-400">Fornecedor da nota de origem</p>
                                    <p className="mt-2 text-lg font-black text-[#1A1A1A]">{selectedEntryInvoice?.emitente_nome || "Nenhuma NF-e de entrada selecionada"}</p>
                                    <p className="mt-1 text-sm font-medium text-stone-500">{selectedEntryInvoice?.emitente_cnpj || "CNPJ pendente"}</p>
                                    {referencedKey && (
                                        <p className="mt-3 break-all rounded-xl bg-white p-3 font-mono text-xs font-bold text-stone-600">{referencedKey}</p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="flex w-fit gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setParticipantMode("search")}
                                            className={`rounded-lg px-3 py-2 text-xs font-black transition ${participantMode === "search" ? "bg-[#1A1A1A] text-[#FACC15] shadow-sm" : "text-stone-700 hover:bg-stone-200"}`}
                                        >
                                            Buscar cadastro
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setParticipantMode("manual")}
                                            className={`rounded-lg px-3 py-2 text-xs font-black transition ${participantMode === "manual" ? "bg-[#1A1A1A] text-[#FACC15] shadow-sm" : "text-stone-700 hover:bg-stone-200"}`}
                                        >
                                            Novo participante
                                        </button>
                                    </div>

                                    {participantClientFeedback && (
                                        <div className={`rounded-xl border px-3 py-2 text-xs font-bold ${participantClientFeedback.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                                            {participantClientFeedback.message}
                                        </div>
                                    )}

                                    {participantMode === "search" && (
                                        <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                            <label className={participantLabelClass}>Buscar por nome, CPF/CNPJ ou telefone</label>
                                            <div className="relative mt-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                                <input
                                                    value={participantSearch}
                                                    onChange={(e) => {
                                                        setParticipantSearch(e.target.value);
                                                        setParticipantSearchLocked(false);
                                                    }}
                                                    className={`${participantFieldClass} !border-amber-300 !bg-amber-100 py-2 pl-10 pr-3`}
                                                    placeholder="Digite ao menos 2 caracteres"
                                                />
                                                {searchingClients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-stone-400" size={16} />}
                                            </div>

                                            {clientResults.length > 0 && (
                                                <div className="mt-3 grid grid-cols-1 gap-2">
                                                    {clientResults.map((client) => (
                                                        <button
                                                            key={client.id}
                                                            type="button"
                                                            onClick={() => selectClient(client)}
                                                            className="rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-[#FACC15]"
                                                        >
                                                            <p className="font-black text-[#1A1A1A]">{client.nome}</p>
                                                            <p className="mt-1 text-xs font-medium text-stone-500">{client.cpf_cnpj || "Sem documento"} | {client.whatsapp || "Sem telefone"}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {!searchingClients && participantSearch.trim().length >= 2 && clientResults.length === 0 && !participantSearchLocked && (
                                                <p className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600">
                                                    Nenhum cliente encontrado.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <ParticipantForm
                                        participant={participant}
                                        setParticipant={setParticipant}
                                        fieldClass={participantFieldClass}
                                        labelClass={participantLabelClass}
                                        loadingCep={loadingCep}
                                        buscaCep={buscaCepParticipante}
                                    />

                                    {participantMode === "manual" && (
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleSaveParticipantClient}
                                                disabled={savingParticipantClient}
                                                className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-black text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {savingParticipantClient ? "Salvando..." : "Salvar cliente"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    )}

                    {step === "items" && (
                        <section className="space-y-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-[#1A1A1A]">Itens da NF-e</h2>
                                    <p className="text-sm text-stone-500">
                                        {usesOriginItems
                                            ? "Selecione os itens da nota de origem e as quantidades desta emissão."
                                            : "Tributação e CFOP são tratados por item."}
                                    </p>
                                </div>
                                {!usesOriginItems && (
                                    <button
                                        type="button"
                                        onClick={() => setItems((current) => [...current, { ...makeItem(), cfop: suggestedCfop }])}
                                        className="flex w-fit items-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-2 text-xs font-black text-[#FACC15] transition hover:bg-black"
                                    >
                                        <Package size={16} /> Adicionar item
                                    </button>
                                )}
                            </div>

                            {usesOriginItems ? (
                                <ReturnItemsTable
                                    items={returnItems}
                                    loading={loadingEntryItems}
                                    toggleItem={toggleReturnItem}
                                    updateQty={updateReturnQty}
                                    mode={(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp) ? "retorno" : "devolucao"}
                                />
                            ) : (
                            <div className="space-y-3">
                                {items.map((item, index) => (
                                    <div key={item.id} className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-sm font-black text-[#1A1A1A]">Item {index + 1}</p>
                                            <button
                                                type="button"
                                                onClick={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))}
                                                className="text-xs font-black text-red-500 disabled:opacity-30"
                                                disabled={items.length === 1}
                                            >
                                                Remover
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                                            <div className="xl:col-span-12">
                                                <label className={itemLabelClass}>Descrição</label>
                                                <div className="relative">
                                                    <input
                                                        value={item.descricao}
                                                        onChange={(e) => updateItem(item.id, { descricao: e.target.value, codigo: item.codigo && item.descricao !== e.target.value ? "" : item.codigo })}
                                                        onFocus={() => setFocusedItemId(item.id)}
                                                        onBlur={() => setTimeout(() => setFocusedItemId(null), 180)}
                                                        className={`${itemFieldClass} !border-amber-300 !bg-amber-100`}
                                                        placeholder="Buscar peça do estoque..."
                                                    />
                                                    {focusedItemId === item.id && (
                                                        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
                                                            <ProductLookup
                                                                query={item.descricao}
                                                                onSelect={(product) => selectProductForItem(item.id, product)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="xl:col-span-3">
                                                <label className={itemLabelClass}>NCM</label>
                                                <input value={item.ncm} onChange={(e) => updateItem(item.id, { ncm: digits(e.target.value).slice(0, 8) })} className={itemFieldClass} />
                                            </div>

                                            <div className="xl:col-span-3">
                                                <label className={itemLabelClass}>CFOP</label>
                                                <input
                                                    value={item.cfop}
                                                    onChange={(e) => updateItem(item.id, { cfop: digits(e.target.value).slice(0, 4) })}
                                                    readOnly={operation !== "advanced"}
                                                    className={`${itemFieldClass} ${operation !== "advanced" ? "bg-stone-100 text-stone-500" : ""}`}
                                                />
                                            </div>

                                            <div className="xl:col-span-2">
                                                <label className={itemLabelClass}>UN</label>
                                                <input value={item.unidade} onChange={(e) => updateItem(item.id, { unidade: e.target.value.toUpperCase().slice(0, 6) })} className={itemFieldClass} />
                                            </div>

                                            <div className="xl:col-span-2">
                                                <label className={itemLabelClass}>Qtd</label>
                                                <input type="number" value={item.quantidade} onChange={(e) => updateItem(item.id, { quantidade: Number(e.target.value) })} className={itemFieldClass} />
                                            </div>

                                            <div className="xl:col-span-2">
                                                <label className={itemLabelClass}>Valor</label>
                                                <input type="number" step="0.01" value={item.valor_unitario} onChange={(e) => updateItem(item.id, { valor_unitario: Number(e.target.value) })} className={itemFieldClass} />
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
                                            <div className="xl:col-span-3">
                                                <label className={itemLabelClass}>CSOSN/CST</label>
                                                <input value={item.csosn} onChange={(e) => updateItem(item.id, { csosn: e.target.value })} className={itemFieldClass} />
                                            </div>
                                            <div className="xl:col-span-5">
                                                <label className={itemLabelClass}>Origem</label>
                                                <select value={item.origem} onChange={(e) => updateItem(item.id, { origem: e.target.value })} className={itemFieldClass}>
                                                    <option value="0">0 - Nacional</option>
                                                    <option value="1">1 - Estrangeira direta</option>
                                                    <option value="2">2 - Estrangeira mercado interno</option>
                                                </select>
                                            </div>
                                            <div className="rounded-xl bg-white p-4 xl:col-span-4">
                                                <p className="text-[10px] font-black uppercase text-stone-400">Total do item</p>
                                                <p className="mt-1 text-2xl font-black text-[#1A1A1A]">{money(item.quantidade * item.valor_unitario)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </section>
                    )}

                    {step === "transport" && (
                        <section className="space-y-5">
                            <div>
                                <h2 className="text-lg font-black text-[#1A1A1A]">Transporte e observações</h2>
                                <p className="text-sm text-stone-500">Preencha frete, volumes e textos fiscais/comerciais.</p>
                            </div>

                            <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                <label className={labelClass}>Modalidade do frete</label>
                                <select value={modFrete} onChange={(e) => setModFrete(e.target.value)} className={fieldClass}>
                                    <option value="9">9 - Sem ocorrência de transporte</option>
                                    <option value="0">0 - Por conta do emitente</option>
                                    <option value="1">1 - Por conta do destinatário</option>
                                    <option value="2">2 - Por conta de terceiros</option>
                                    <option value="3">3 - Transporte próprio por conta do remetente</option>
                                    <option value="4">4 - Transporte próprio por conta do destinatário</option>
                                </select>

                                {modFrete !== "9" && (
                                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div>
                                            <label className={labelClass}>Transportadora</label>
                                            <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className={fieldClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>CPF/CNPJ</label>
                                            <input value={carrierDoc} onChange={(e) => setCarrierDoc(e.target.value)} className={fieldClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Volumes</label>
                                            <input value={volumes} onChange={(e) => setVolumes(e.target.value)} className={fieldClass} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className={labelClass}>Observações comerciais</label>
                                    <textarea value={infCpl} onChange={(e) => setInfCpl(e.target.value)} rows={6} className={`${fieldClass} resize-none`} />
                                </div>
                                <div>
                                    <label className={labelClass}>Observações fiscais</label>
                                    <textarea value={infAdFisco} onChange={(e) => setInfAdFisco(e.target.value)} rows={6} className={`${fieldClass} resize-none`} />
                                </div>
                            </div>
                        </section>
                    )}

                    {step === "review" && (
                        <section className="space-y-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-[#1A1A1A]">{"Revis\u00e3o fiscal"}</h2>
                                    <p className="text-sm text-stone-500">
                                        {isEmissionSupported || operation === "return"
                                            ? "Confira todos os dados antes de transmitir a NF-e."
                                            : "Confira o rascunho. Esta finalidade ainda n\u00e3o transmite NF-e."}
                                    </p>
                                </div>
                                {operation === "advanced" && (
                                    <span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                                        {"IA ser\u00e1 executada automaticamente ao emitir"}
                                    </span>
                                )}
                            </div>

                            {pending.length > 0 ? (
                                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                                    <p className="font-black text-red-700">{"Pend\u00eancias bloqueantes"}</p>
                                    <div className="mt-2 space-y-1">
                                        {pending.map((issue) => (
                                            <p key={issue} className="text-sm font-medium text-red-700">- {issue}</p>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                                    <p className="flex items-center gap-2 font-black text-green-700"><CheckCircle size={18} /> {"Rascunho sem pend\u00eancias estruturais."}</p>
                                </div>
                            )}

                            {aiAudit && (
                                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                    <p className="font-black text-blue-700">Auditoria por IA</p>
                                    <p className="mt-1 text-sm font-medium text-blue-700">{aiAudit}</p>
                                </div>
                            )}

                            {usesOriginItems && (
                                <ReturnTechnicalPreview
                                    entryInvoice={selectedEntryInvoice}
                                    referencedKey={referencedKey}
                                    selectedItems={selectedReturnItems}
                                    total={returnTotal}
                                    environment={environment}
                                    mode={(isRetornoConsertoMvp || isRetornoGarantiaMvp || isRetornoDepositoMvp) ? "retorno" : "devolucao"}
                                />
                            )}

                            {operation === "shipment" && !isRetornoConsertoMvp && !isRetornoGarantiaMvp && (
                                <ShipmentTechnicalPreview
                                    purpose={purpose}
                                    cfop={suggestedCfop}
                                    destinationLabel={destinationLabel}
                                    items={items}
                                    total={totalItems}
                                    canEmit={isRemessaConsertoMvp || isRemessaGarantiaMvp || isRetornoConsertoMvp}
                                />
                            )}

                            {operation === "bonus" && null}

                            <DanfePreview
                                operation={currentOperation.title}
                                purpose={purpose}
                                destinationLabel={destinationLabel}
                                participant={participant}
                                items={previewItems}
                                total={displayTotal}
                                modFrete={modFrete}
                                infCpl={infCpl}
                                infAdFisco={infAdFisco}
                            />
                        </section>
                    )}

                    <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
                        <button
                            type="button"
                            onClick={goBack}
                            disabled={stepIndex === 0}
                            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-black text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"
                        >
                            <ChevronLeft size={16} /> Voltar
                        </button>

                        {step !== "review" ? (
                            <button
                                type="button"
                                onClick={goNext}
                                disabled={step === "operation" && (isSalePurposeUnavailable || isReferenceSelectionPending)}
                                className="flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-black text-[#FACC15] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {"Pr\u00f3ximo"} <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={pending.length > 0 || emitting}
                                onClick={handleEmitirNFe}
                                className="flex items-center gap-2 rounded-xl bg-[#FACC15] px-4 py-2 text-sm font-black text-[#1A1A1A] transition hover:bg-yellow-300 disabled:opacity-40"
                            >
                                {emitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {emitting ? "Emitindo..." : operation === "return" ? "Emitir NF-e de Devolução" : isVendaComumMvp ? "Emitir NF-e de Venda" : (isRemessaConsertoMvp || isRemessaGarantiaMvp) ? "Emitir NF-e de Remessa" : (isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "Emitir NF-e de Retorno" : isTransferenciaMvp ? "Emitir NF-e de Transferência" : isBonusMvp ? "Emitir NF-e de Bonificação/Doação" : operation === "advanced" ? "Emitir NF-e assistida" : "Emissão indisponível"}
                            </button>
                        )}
                    </div>
                </main>

                <aside className="space-y-3">
                    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                        <p className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]"><AlertCircle size={16} /> {"Pend\u00eancias"}</p>
                        {pending.length === 0 ? (
                            <p className="mt-3 text-sm font-medium text-green-700">{"Nenhuma pend\u00eancia estrutural."}</p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {pending.slice(0, 6).map((issue) => (
                                    <p key={issue} className="rounded-xl bg-red-50 p-2 text-xs font-bold text-red-700">{issue}</p>
                                ))}
                                {pending.length > 6 && <p className="text-xs font-bold text-stone-400">+ {pending.length - 6} {"pend\u00eancia(s)"}</p>}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                        <p className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]"><Truck size={16} /> Regra atual</p>
                        <div className="mt-3 space-y-2 text-sm font-medium text-stone-600">
                            <p>UF emitente: <strong>{companyUf || "N\u00e3o carregada"}</strong></p>
                            <p>UF participante: <strong>{participantUf || "Pendente"}</strong></p>
                            <p>{"Classifica\u00e7\u00e3o"}: <strong>{destinationLabel}</strong></p>
                            <p>CFOP sugerido: <strong>{suggestedCfop || "Modo avan\u00e7ado"}</strong></p>
                        </div>
                    </div>

                    {isTransferDepositFlow && transferHasDifferentRoot && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                            <p className="text-sm font-black text-amber-800">{"Alerta para dep\u00f3sito"}</p>
                            <p className="mt-2 text-xs font-medium text-amber-700">
                                {"CNPJ do destinat\u00e1rio com raiz diferente do emitente. Em dep\u00f3sito de terceiro pode ser v\u00e1lido, mas confirme com o contador antes de emitir."}
                            </p>
                        </div>
                    )}
                </aside>
            </div>
            {cloneModalOpen && (
                <CloneInvoiceModal
                    environment={environment}
                    query={cloneSearch}
                    setQuery={setCloneSearch}
                    status={cloneStatus}
                    setStatus={setCloneStatus}
                    invoices={cloneResults}
                    loading={cloneLoading}
                    onClose={() => setCloneModalOpen(false)}
                    onSelect={applyCloneInvoice}
                />
            )}
        </div>
    );
}

function CloneInvoiceModal({
    environment,
    query,
    setQuery,
    status,
    setStatus,
    invoices,
    loading,
    onClose,
    onSelect,
}: {
    environment: "production" | "homologation";
    query: string;
    setQuery: Dispatch<SetStateAction<string>>;
    status: "authorized" | "error" | "rejected" | "all";
    setStatus: Dispatch<SetStateAction<"authorized" | "error" | "rejected" | "all">>;
    invoices: CloneInvoiceSummary[];
    loading: boolean;
    onClose: () => void;
    onSelect: (invoice: CloneInvoiceSummary) => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-stone-100 p-4">
                    <div>
                        <p className="text-lg font-black text-[#1A1A1A]">Clonar NF-e</p>
                        <p className="text-xs font-bold text-stone-500">{environment === "production" ? "Produção" : "Homologação"}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-600">Fechar</button>
                </div>
                <div className="grid grid-cols-1 gap-3 border-b border-stone-100 p-4 md:grid-cols-[1fr_180px]">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-bold outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20"
                        placeholder="Numero, cliente, documento ou chave"
                    />
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value as "authorized" | "error" | "rejected" | "all")}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20"
                    >
                        <option value="authorized">Autorizadas</option>
                        <option value="rejected">Rejeitadas</option>
                        <option value="error">Com erro</option>
                        <option value="all">Todas</option>
                    </select>
                </div>
                <div className="max-h-[56vh] overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-4 text-sm font-bold text-stone-500"><Loader2 size={16} className="animate-spin" /> Buscando notas...</div>
                    ) : invoices.length === 0 ? (
                        <div className="rounded-xl bg-stone-50 p-4 text-sm font-bold text-stone-500">Nenhuma NF-e encontrada para os filtros atuais.</div>
                    ) : (
                        <div className="space-y-2">
                            {invoices.map((invoice) => (
                                <button key={invoice.id} type="button" onClick={() => onSelect(invoice)} className="w-full rounded-xl border border-stone-200 bg-white p-3 text-left transition hover:border-[#FACC15] hover:bg-yellow-50/40">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-black text-[#1A1A1A]">NF {invoice.numero || "-"} {invoice.serie ? `Serie ${invoice.serie}` : ""}</p>
                                            <p className="mt-1 text-xs font-bold text-stone-500">{invoice.destinatario_nome || "Destinatário sem nome"} | {invoice.destinatario_cnpj || "Documento pendente"}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-[#1A1A1A]">{money(Number(invoice.valor_total || 0))}</p>
                                            <p className="mt-1 text-[11px] font-bold text-stone-500">
                                                {invoice.data_emissao ? new Date(invoice.data_emissao).toLocaleDateString("pt-BR") : "Data n?o informada"}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ParticipantForm({
    participant,
    setParticipant,
    fieldClass,
    labelClass,
    loadingCep,
    buscaCep,
}: {
    participant: Participant;
    setParticipant: Dispatch<SetStateAction<Participant>>;
    fieldClass: string;
    labelClass: string;
    loadingCep: boolean;
    buscaCep: () => Promise<void>;
}) {
    const patch = (data: Partial<Participant>) => setParticipant((current) => ({ ...current, ...data }));
    const numeroInputId = "nfe-participant-numero";

    return (
        <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
                <UserPlus size={16} className="text-stone-500" />
                <p className="text-sm font-black text-[#1A1A1A]">Dados do participante</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                    <label className={labelClass}>Nome/Razão social</label>
                    <input value={participant.nome} onChange={(e) => patch({ nome: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>CPF/CNPJ</label>
                    <input value={participant.cpf_cnpj} onChange={(e) => patch({ cpf_cnpj: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>IE</label>
                    <input value={participant.inscricao_estadual} onChange={(e) => patch({ inscricao_estadual: e.target.value, ind_ie_dest: e.target.value ? "1" : "9" })} className={fieldClass} />
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>Indicador IE</label>
                    <select value={participant.ind_ie_dest} onChange={(e) => patch({ ind_ie_dest: e.target.value as Participant["ind_ie_dest"] })} className={fieldClass}>
                        <option value="1">Contribuinte</option>
                        <option value="2">Isento</option>
                        <option value="9">Não contribuinte</option>
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>Email</label>
                    <input value={participant.email} onChange={(e) => patch({ email: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>Telefone</label>
                    <input value={participant.telefone} onChange={(e) => patch({ telefone: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>CEP</label>
                    <div className="relative">
                        <input
                            value={participant.cep}
                            onChange={(e) => patch({ cep: e.target.value })}
                            onBlur={async () => {
                                const numeroAntes = (participant.numero || "").trim();
                                await buscaCep();
                                if (!numeroAntes) {
                                    const numeroInput = document.getElementById(numeroInputId) as HTMLInputElement | null;
                                    numeroInput?.focus();
                                }
                            }}
                            className={`${fieldClass} pr-9`}
                        />
                        <button type="button" tabIndex={-1} onClick={buscaCep} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400">
                            {loadingCep ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                        </button>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>Logradouro</label>
                    <input value={participant.logradouro} onChange={(e) => patch({ logradouro: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>Número</label>
                    <input id={numeroInputId} value={participant.numero} onChange={(e) => patch({ numero: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>Bairro</label>
                    <input value={participant.bairro} onChange={(e) => patch({ bairro: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>Cidade</label>
                    <input value={participant.cidade} onChange={(e) => patch({ cidade: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>UF</label>
                    <input value={participant.uf} onChange={(e) => patch({ uf: e.target.value.toUpperCase().slice(0, 2) })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>Código município</label>
                    <input value={participant.codigo_municipio} onChange={(e) => patch({ codigo_municipio: e.target.value.replace(/\D/g, "").slice(0, 7) })} className={fieldClass} />
                </div>
            </div>
        </div>
    );
}

function ReturnItemsTable({
    items,
    loading,
    toggleItem,
    updateQty,
    mode,
}: {
    items: ReturnItemState[];
    loading: boolean;
    toggleItem: (index: number) => void;
    updateQty: (index: number, value: string) => void;
    mode: "devolucao" | "retorno";
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center rounded-2xl border border-stone-100 bg-[#F8F7F2] p-10 text-stone-400">
                <Loader2 size={24} className="mr-2 animate-spin" /> Carregando itens da NF-e de origem...
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-medium text-amber-700">
                {mode === "retorno"
                    ? "Selecione uma remessa para conserto na primeira etapa para carregar os itens do retorno."
                    : "Selecione uma NF-e de entrada na primeira etapa para carregar os itens da devolução."}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-stone-100 bg-white">
            <div className="border-b border-stone-100 bg-[#F8F7F2] p-4">
                <p className="font-black text-[#1A1A1A]">
                    {mode === "retorno" ? "Itens da remessa de origem" : "Itens espelhados da NF-e de entrada"}
                </p>
                <p className="mt-1 text-xs font-medium text-stone-500">
                    {mode === "retorno"
                        ? "O retorno referencia a chave original e usa os itens do XML autorizado como base."
                        : "A emissão usa o mesmo backend aprovado: os impostos/taxas são espelhados a partir do XML original."}
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-stone-50 text-[10px] font-black uppercase text-stone-500">
                        <tr>
                            <th className="px-4 py-3 text-left"></th>
                            <th className="px-4 py-3 text-left">Produto</th>
                            <th className="px-4 py-3 text-left">NCM</th>
                            <th className="px-4 py-3 text-right">Qtd. original</th>
                            <th className="px-4 py-3 text-right">{mode === "retorno" ? "Qtd. retornar" : "Qtd. devolver"}</th>
                            <th className="px-4 py-3 text-right">Valor unit.</th>
                            <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {items.map((item, index) => (
                            <tr key={`${item.codigo}-${index}`} className={item.selected ? "" : "opacity-45"}>
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={item.selected}
                                        onChange={() => toggleItem(index)}
                                        className="h-4 w-4 accent-[#1A1A1A]"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <p className="font-black text-[#1A1A1A]">{item.descricao}</p>
                                    <p className="mt-1 text-xs font-medium text-stone-400">{item.codigo}</p>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-stone-500">{item.ncm}</td>
                                <td className="px-4 py-3 text-right font-bold text-stone-600">{item.quantidade} {item.unidade}</td>
                                <td className="px-4 py-3 text-right">
                                    <input
                                        type="number"
                                        min={0}
                                        max={item.quantidade}
                                        step={0.001}
                                        value={item.qtd_devolver}
                                        onChange={(event) => updateQty(index, event.target.value)}
                                        disabled={!item.selected}
                                        className="w-28 rounded-lg border border-stone-200 px-2 py-1 text-right font-black outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20 disabled:bg-stone-50"
                                    />
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-stone-600">{money(item.valor_unitario)}</td>
                                <td className="px-4 py-3 text-right font-black text-[#1A1A1A]">{money(item.qtd_devolver * item.valor_unitario)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ShipmentGuidance({ purpose, cfop, destinationLabel, canEmit }: { purpose: string; cfop: string; destinationLabel: string; canEmit: boolean }) {
    const status = getShipmentRuleStatus(purpose);

    return (
        <div className={`rounded-2xl border p-4 ${canEmit ? "border-green-100 bg-green-50" : "border-blue-100 bg-blue-50"}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className={`font-black ${canEmit ? "text-green-800" : "text-blue-800"}`}>
                        {canEmit ? `${purpose} liberada para emiss?o` : status.title}
                    </p>
                    <p className={`mt-1 text-sm font-medium ${canEmit ? "text-green-700" : "text-blue-700"}`}>
                        {canEmit
                            ? `A tela vai emitir NF-e de saida sem cobranca, usando CFOP ${purpose === "Retorno de conserto" ? "5916/6916" : "5915/6915"} conforme UF do participante e CSOSN 400.`
                            : status.detail}
                    </p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-[10px] font-black uppercase text-stone-400">{destinationLabel}</p>
                    <p className="mt-1 text-xl font-black text-[#1A1A1A]">CFOP {cfop || "-"}</p>
                </div>
            </div>
        </div>
    );
}

function BlockedOperationGuidance({
    operation,
    purpose,
    cfop,
    destinationLabel,
}: {
    operation: OperationGroup;
    purpose: string;
    cfop: string;
    destinationLabel: string;
}) {
    const status = getOperationRuleStatus(operation, purpose);

    return (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="font-black text-indigo-800">{status.title}</p>
                    <p className="mt-1 text-sm font-medium text-indigo-700">{status.detail}</p>
                </div>
                <div className="rounded-xl bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-[10px] font-black uppercase text-stone-400">{destinationLabel}</p>
                    <p className="mt-1 text-xl font-black text-[#1A1A1A]">CFOP {cfop || "-"}</p>
                </div>
            </div>
        </div>
    );
}

function ShipmentTechnicalPreview({
    purpose,
    cfop,
    destinationLabel,
    items,
    total,
    canEmit,
}: {
    purpose: string;
    cfop: string;
    destinationLabel: string;
    items: DraftItem[];
    total: number;
    canEmit: boolean;
}) {
    const status = getShipmentRuleStatus(purpose);

    return (
        <div className={`rounded-2xl border p-4 ${canEmit ? "border-green-100 bg-green-50" : "border-blue-100 bg-blue-50"}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className={`font-black ${canEmit ? "text-green-800" : "text-blue-800"}`}>Pr?via t?cnica de Remessa/Retorno</p>
                    <p className={`mt-1 text-sm font-medium ${canEmit ? "text-green-700" : "text-blue-700"}`}>
                        {canEmit
                            ? "Esta finalidade esta pronta para transmissao: nota sem cobranca, CFOP automatico e impostos sem destaque."
                            : "Sem transmissao nesta fase. Esta previa serve para validar UX, itens e regra fiscal futura."}
                    </p>
                </div>
                <span className={`w-fit rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase ${canEmit ? "text-green-700" : "text-blue-700"}`}>
                    {canEmit ? "Liberado" : "Bloqueado"}
                </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">Finalidade</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">{purpose}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">Classificacao</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">{destinationLabel}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">CFOP sugerido</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">{cfop || "Pendente"}</p>
                </div>
            </div>

            <div className="mt-3 rounded-xl bg-white p-3">
                <p className="text-[10px] font-black uppercase text-stone-400">Status fiscal</p>
                <p className="mt-1 text-sm font-medium text-stone-700">{status.detail}</p>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3">
                <span className="text-sm font-black text-stone-500">{items.length} item(ns) no rascunho</span>
                <span className="text-xl font-black text-[#1A1A1A]">{money(total)}</span>
            </div>
        </div>
    );
}

function BlockedOperationTechnicalPreview({
    operation,
    purpose,
    cfop,
    destinationLabel,
    items,
    total,
}: {
    operation: OperationGroup;
    purpose: string;
    cfop: string;
    destinationLabel: string;
    items: DraftItem[];
    total: number;
}) {
    const status = getOperationRuleStatus(operation, purpose);
    const title = operation === "transfer" ? "Pr?via t?cnica de Transfer?ncia" : "Pr?via t?cnica de Bonifica??o/Doa??o";

    return (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="font-black text-indigo-800">{title}</p>
                    <p className="mt-1 text-sm font-medium text-indigo-700">Sem transmissao nesta fase. Esta previa ajuda a conferir dados antes de criar o motor fiscal.</p>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-indigo-700">
                    Bloqueado
                </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">Finalidade</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">{purpose}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">Classificacao</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">{destinationLabel}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">CFOP sugerido</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">{cfop || "Pendente"}</p>
                </div>
            </div>

            <div className="mt-3 rounded-xl bg-white p-3">
                <p className="text-[10px] font-black uppercase text-stone-400">Motivo do bloqueio</p>
                <p className="mt-1 text-sm font-medium text-stone-700">{status.detail}</p>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3">
                <span className="text-sm font-black text-stone-500">{items.length} item(ns) no rascunho</span>
                <span className="text-xl font-black text-[#1A1A1A]">{money(total)}</span>
            </div>
        </div>
    );
}

function ReturnTechnicalPreview({
    entryInvoice,
    referencedKey,
    selectedItems,
    total,
    environment,
    mode,
}: {
    entryInvoice: EntryInvoiceSummary | null;
    referencedKey: string;
    selectedItems: ReturnItemState[];
    total: number;
    environment: "homologation" | "production";
    mode: "devolucao" | "retorno";
}) {
    return (
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="font-black text-orange-800">
                        {mode === "retorno" ? "Pr\u00e9via t\u00e9cnica do retorno de conserto" : "Pr\u00e9via t\u00e9cnica da devolu\u00e7\u00e3o"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-orange-700">
                        {mode === "retorno"
                            ? "Esta emiss\u00e3o referenciar\u00e1 a NF-e original e usar\u00e1 CFOP 5916/6916 conforme a UF do participante."
                            : "Esta emiss\u00e3o chamar\u00e1 o mesmo backend aprovado em produ\u00e7\u00e3o: `emitirNFeDevolucao`."}
                    </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${environment === "production" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {environment === "production" ? "Produ\u00e7\u00e3o" : "Homologa\u00e7\u00e3o"}
                </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">entry_invoice_id</p>
                    <p className="mt-1 break-all font-mono text-xs font-bold text-[#1A1A1A]">{entryInvoice?.id || "pendente"}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">nota de origem</p>
                    <p className="mt-1 text-sm font-black text-[#1A1A1A]">
                        NF {entryInvoice?.numero || "-"} | {mode === "retorno" ? (entryInvoice?.destinatario_nome || "-") : (entryInvoice?.emitente_nome || "-")}
                    </p>
                </div>
                <div className="rounded-xl bg-white p-3 md:col-span-2">
                    <p className="text-[10px] font-black uppercase text-stone-400">chave referenciada</p>
                    <p className="mt-1 break-all font-mono text-xs font-bold text-[#1A1A1A]">{referencedKey || "pendente"}</p>
                </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-orange-100 bg-white">
                <div className="grid grid-cols-[1fr_90px_120px] gap-2 border-b border-orange-100 bg-orange-100/60 px-3 py-2 text-[10px] font-black uppercase text-orange-800">
                    <span>Item selecionado</span>
                    <span className="text-right">Qtd.</span>
                    <span className="text-right">Total</span>
                </div>
                {selectedItems.length === 0 ? (
                    <p className="p-3 text-sm font-medium text-orange-700">
                        {mode === "retorno" ? "Nenhum item selecionado para retorno." : "Nenhum item selecionado para devolu\u00e7\u00e3o."}
                    </p>
                ) : (
                    selectedItems.map((item, index) => (
                        <div key={`${item.codigo}-${index}`} className="grid grid-cols-[1fr_90px_120px] gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-b-0">
                            <span className="font-bold text-stone-800">{item.descricao}</span>
                            <span className="text-right font-mono text-stone-600">{item.qtd_devolver}</span>
                            <span className="text-right font-black text-[#1A1A1A]">{money(item.qtd_devolver * item.valor_unitario)}</span>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-3">
                <span className="text-sm font-black text-stone-500">valor_total enviado</span>
                <span className="text-xl font-black text-[#1A1A1A]">{money(total)}</span>
            </div>
        </div>
    );
}

function ProductLookup({ query, onSelect }: { query: string; onSelect: (product: ProductResult) => void }) {
    const [results, setResults] = useState<ProductResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!query || query.trim().length < 2) {
            setResults([]);
            return;
        }

        let cancelled = false;

        const run = async () => {
            setLoading(true);
            const data = await searchProducts(query.trim());
            if (!cancelled) {
                setResults((data || []) as ProductResult[]);
                setLoading(false);
            }
        };

        const timeout = setTimeout(run, 250);
        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query]);

    if (!query || query.trim().length < 2) {
        return <p className="p-2 text-xs font-medium text-stone-400">Digite ao menos 2 caracteres para buscar no estoque.</p>;
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-2 text-xs font-medium text-stone-400">
                <Loader2 size={14} className="animate-spin" /> Buscando peças...
            </div>
        );
    }

    if (results.length === 0) {
        return <p className="p-2 text-xs font-medium text-stone-400">Nenhuma peça encontrada. Você pode continuar preenchendo manualmente.</p>;
    }

    return (
        <div className="space-y-1">
            {results.map((product) => (
                <button
                    key={product.id}
                    type="button"
                    onMouseDown={(event) => {
                        event.preventDefault();
                        onSelect(product);
                    }}
                    className="w-full rounded-lg p-2 text-left transition hover:bg-stone-100"
                >
                    <p className="text-xs font-black text-[#1A1A1A]">{product.nome}</p>
                    <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] font-medium text-stone-500">
                        <span>{product.marca || "Sem marca"}</span>
                        <span>NCM {product.ncm || "pendente"}</span>
                        <span>{money(Number(product.preco_venda || 0))}</span>
                    </div>
                </button>
            ))}
        </div>
    );
}

function DanfePreview({
    operation,
    purpose,
    destinationLabel,
    participant,
    items,
    total,
    modFrete,
    infCpl,
    infAdFisco,
}: {
    operation: string;
    purpose: string;
    destinationLabel: string;
    participant: Participant;
    items: DraftItem[];
    total: number;
    modFrete: string;
    infCpl: string;
    infAdFisco: string;
}) {
    const modFreteLabel: Record<string, string> = {
        "0": "Por conta do emitente",
        "1": "Por conta do destinatário",
        "2": "Por conta de terceiros",
        "3": "Transporte próprio por conta do remetente",
        "4": "Transporte próprio por conta do destinatário",
        "9": "Sem ocorrência de transporte",
    };

    return (
        <div className="overflow-hidden rounded-2xl border-2 border-stone-300 bg-white">
            <div className="grid grid-cols-1 border-b-2 border-stone-300 md:grid-cols-[1fr_220px]">
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-stone-400">Previa estilo DANFE</p>
                    <h3 className="mt-1 text-lg font-black text-[#1A1A1A]">NF-e - {operation}</h3>
                    <p className="text-sm font-medium text-stone-500">{purpose} | {destinationLabel}</p>
                </div>
                <div className="border-t-2 border-stone-300 p-4 md:border-l-2 md:border-t-0">
                    <p className="text-[10px] font-black uppercase text-stone-400">Total da nota</p>
                        <p className="mt-1 text-xl font-black text-[#1A1A1A]">{money(total)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 border-b-2 border-stone-300 md:grid-cols-2">
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-stone-400">Emitente</p>
                    <p className="mt-1 font-black text-[#1A1A1A]">Empresa emissora</p>
                    <p className="text-xs font-medium text-stone-500">Dados reais entram pelo cadastro da empresa.</p>
                </div>
                <div className="border-t-2 border-stone-300 p-4 md:border-l-2 md:border-t-0">
                    <p className="text-[10px] font-black uppercase text-stone-400">Destinatário/Remetente</p>
                    <p className="mt-1 font-black text-[#1A1A1A]">{participant.nome || "Nao informado"}</p>
                    <p className="text-xs font-medium text-stone-500">{participant.cpf_cnpj || "Documento pendente"}</p>
                    <p className="text-xs font-medium text-stone-500">{participant.cidade || "Cidade"} / {participant.uf || "UF"}</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="border-b-2 border-stone-300 bg-stone-100 text-[10px] font-black uppercase text-stone-500">
                        <tr>
                            <th className="px-3 py-3">Produto</th>
                            <th className="px-3 py-3">NCM</th>
                            <th className="px-3 py-3">CFOP</th>
                            <th className="px-3 py-3">Qtd</th>
                            <th className="px-3 py-3 text-right">Valor</th>
                            <th className="px-3 py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id} className="border-b border-stone-200">
                                <td className="px-3 py-3 font-bold text-stone-800">{item.descricao || "Item sem descrição"}</td>
                                <td className="px-3 py-3">{item.ncm || "-"}</td>
                                <td className="px-3 py-3">{item.cfop || "-"}</td>
                                <td className="px-3 py-3">{item.quantidade} {item.unidade}</td>
                                <td className="px-3 py-3 text-right">{money(item.valor_unitario)}</td>
                                <td className="px-3 py-3 text-right font-black">{money(item.quantidade * item.valor_unitario)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3">
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-stone-400">Transporte</p>
                    <p className="mt-1 text-sm font-bold text-stone-700">{modFreteLabel[modFrete] || `Modalidade ${modFrete}`}</p>
                </div>
                <div className="border-t-2 border-stone-300 p-4 md:border-l-2 md:border-t-0">
                    <p className="text-[10px] font-black uppercase text-stone-400">Informacoes complementares</p>
                    <p className="mt-1 text-sm font-medium text-stone-600">{infCpl || "Sem observacoes comerciais."}</p>
                </div>
                <div className="border-t-2 border-stone-300 p-4 md:border-l-2 md:border-t-0">
                    <p className="text-[10px] font-black uppercase text-stone-400">Observacoes fiscais</p>
                    <p className="mt-1 text-sm font-medium text-stone-600">{infAdFisco || "Sem observacoes fiscais."}</p>
                </div>
            </div>
        </div>
    );
}
