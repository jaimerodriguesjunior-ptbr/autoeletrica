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
import { emitirNFeDevolucaoAction, emitirNFeRemessaConsertoUiAction, emitirNFeRemessaGarantiaUiAction, emitirNFeRetornoConsertoUiAction, emitirNFeRetornoGarantiaUiAction, emitirNFeVendaAction } from "@/src/actions/fiscal_emission_actions";
import { getEntryInvoiceWithItemsAction, getNFeInvoiceWithItemsAction, searchProducts, type ParsedNFeItem } from "@/src/actions/fiscal_db";

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

type ReturnItemState = ParsedNFeItem & {
    selected: boolean;
    qtd_devolver: number;
};

const STEPS: { id: StepId; label: string }[] = [
    { id: "operation", label: "Operacao" },
    { id: "participant", label: "Participante" },
    { id: "items", label: "Itens" },
    { id: "transport", label: "Transporte" },
    { id: "review", label: "Revisao" },
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
        title: "Devolucao",
        subtitle: "Devolucao de compra ou venda",
        icon: RotateCcw,
        purposes: ["Devolucao de compra", "Devolucao de venda"],
    },
    {
        id: "shipment",
        title: "Remessa/Retorno",
        subtitle: "Garantia, conserto, demonstracao ou industrializacao",
        icon: Repeat2,
        purposes: [
            "Remessa para conserto",
            "Retorno de conserto",
            "Remessa em garantia",
            "Retorno de garantia",
            "Remessa para demonstracao",
            "Retorno de demonstracao",
            "Remessa para industrializacao",
            "Retorno de industrializacao",
        ],
    },
    {
        id: "transfer",
        title: "Transferencia",
        subtitle: "Entre filiais ou depositos",
        icon: Warehouse,
        purposes: ["Transferencia entre filiais", "Transferencia para deposito", "Retorno de deposito"],
    },
    {
        id: "bonus",
        title: "Bonificacao/Doacao",
        subtitle: "Bonificacao, brinde ou doacao",
        icon: Gift,
        purposes: ["Bonificacao", "Brinde", "Doacao"],
    },
    {
        id: "advanced",
        title: "Outra operacao",
        subtitle: "Modo avancado com validacoes",
        icon: ShieldCheck,
        purposes: ["Operacao avancada"],
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

function money(value: number) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getGuidedCfop(operation: OperationGroup, purpose: string, isInterstate: boolean) {
    const prefix = isInterstate ? "6" : "5";

    if (operation === "sale") return `${prefix}102`;
    if (operation === "return") return `${prefix}202`;
    if (operation === "transfer") return `${prefix}152`;
    if (operation === "bonus") return `${prefix}910`;

    if (operation === "shipment") {
        if (purpose === "Remessa para conserto") return `${prefix}915`;
        if (purpose === "Retorno de conserto") return `${prefix}916`;
        if (purpose === "Remessa em garantia") return `${prefix}915`;
        if (purpose === "Retorno de garantia") return `${prefix}916`;
        if (purpose === "Remessa para demonstracao") return `${prefix}912`;
        if (purpose === "Retorno de demonstracao") return `${prefix}913`;
        if (purpose === "Remessa para industrializacao") return `${prefix}901`;
        if (purpose === "Retorno de industrializacao") return `${prefix}902`;
    }

    return "";
}

function getOperationRuleStatus(operation: OperationGroup, purpose: string) {
    if (operation === "transfer") {
        return {
            title: "Transferencia ainda bloqueada para emissao",
            detail: "A sugestao atual considera mercadoria adquirida de terceiros (5152/6152). Antes de transmitir, sera necessario validar filial/deposito, titularidade, estoque e regra de ICMS.",
        };
    }

    if (operation === "bonus") {
        return {
            title: "Bonificacao/Doacao ainda bloqueada para emissao",
            detail: "A sugestao atual usa CFOP 5910/6910, mas a saida gratuita pode exigir base de calculo, observacoes e tratamento tributario proprio.",
        };
    }

    return {
        title: "Cenario ainda bloqueado para emissao",
        detail: `A finalidade "${purpose}" precisa de parametrizacao fiscal antes da transmissao.`,
    };
}

function getShipmentRuleStatus(purpose: string) {
    if (purpose.includes("garantia")) {
        return {
            title: "Sugestao inicial: tratar como conserto/garantia",
            detail: "A tela sugere CFOP de conserto/reparo para remessa em garantia, mas a emissao real ainda precisa parametrizacao e validacao do contador.",
        };
    }

    if (purpose.includes("industrializacao")) {
        return {
            title: "Industrializacao exige regra propria",
            detail: "A sugestao de CFOP e apenas estrutural. Antes de emitir, sera necessario parametrizar retorno, insumos, cobranca e observacoes fiscais.",
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

    const [companyUf, setCompanyUf] = useState("");
    const [participantMode, setParticipantMode] = useState<"search" | "manual">("search");
    const [participantSearch, setParticipantSearch] = useState("");
    const [clientResults, setClientResults] = useState<ClientResult[]>([]);
    const [searchingClients, setSearchingClients] = useState(false);
    const [participant, setParticipant] = useState<Participant>(emptyParticipant);
    const [loadingCep, setLoadingCep] = useState(false);

    const [referencedKey, setReferencedKey] = useState("");
    const [entryInvoices, setEntryInvoices] = useState<EntryInvoiceSummary[]>([]);
    const [legacyGuaranteeInvoices, setLegacyGuaranteeInvoices] = useState<EntryInvoiceSummary[]>([]);
    const [entrySearch, setEntrySearch] = useState("");
    const [originQuickFilter, setOriginQuickFilter] = useState<"recent" | "all">("recent");
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

    const currentOperation = OPERATIONS.find((item) => item.id === operation) || OPERATIONS[0];
    const stepIndex = STEPS.findIndex((item) => item.id === step);
    const participantUf = participant.uf.trim().toUpperCase();
    const isVendaComumMvp = operation === "sale" && purpose === "Venda comum";
    const isRemessaConsertoMvp = operation === "shipment" && purpose === "Remessa para conserto";
    const isRemessaGarantiaMvp = operation === "shipment" && purpose === "Remessa em garantia";
    const isRetornoConsertoMvp = operation === "shipment" && purpose === "Retorno de conserto";
    const isRetornoGarantiaMvp = operation === "shipment" && purpose === "Retorno de garantia";
    const usesOriginItems = operation === "return" || isRetornoConsertoMvp || isRetornoGarantiaMvp;
    const isEmissionSupported = isVendaComumMvp || isRemessaConsertoMvp || isRemessaGarantiaMvp || isRetornoConsertoMvp || isRetornoGarantiaMvp;
    const destinationLabel = !participantUf || !companyUf
        ? "Aguardando endereco"
        : participantUf === companyUf
            ? "Operacao interna"
            : "Operacao interestadual";
    const totalItems = items.reduce((sum, item) => sum + item.quantidade * item.valor_unitario, 0);
    const requiresReference = operation === "return" || isRetornoConsertoMvp || isRetornoGarantiaMvp;
    const selectedReturnItems = returnItems.filter((item) => item.selected && item.qtd_devolver > 0);
    const returnTotal = selectedReturnItems.reduce((sum, item) => sum + item.qtd_devolver * item.valor_unitario, 0);
    const displayTotal = usesOriginItems ? returnTotal : totalItems;

    useEffect(() => {
        const loadCompany = async () => {
            if (!profile?.organization_id) return;

            const { data } = await supabase
                .from("company_settings")
                .select("uf")
                .eq("organization_id", profile.organization_id)
                .maybeSingle();

            setCompanyUf(String(data?.uf || "").toUpperCase());
        };

        loadCompany();
    }, [profile?.organization_id, supabase]);

    useEffect(() => {
        const op = OPERATIONS.find((item) => item.id === operation);
        setPurpose(op?.purposes[0] || "");
        setAiAudit(null);
    }, [operation]);

    useEffect(() => {
        setSelectedEntryInvoice(null);
        setReferencedKey("");
        setReturnItems([]);
        setEntrySearch("");
        setOriginQuickFilter("recent");
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
                    if (isRetornoGarantiaMvp) {
                        return natOp.includes("REMESSA") && natOp.includes("GARANTIA");
                    }
                    return natOp.includes("REMESSA") && natOp.includes("CONSERTO");
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
    }, [operation, purpose, requiresReference, environment, profile?.organization_id, supabase, isRetornoConsertoMvp, isRetornoGarantiaMvp]);

    useEffect(() => {
        if (!profile?.organization_id || participantSearch.trim().length < 2) {
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

        if (!operation) issues.push("Escolha o tipo de operacao.");
        if (!purpose) issues.push("Escolha a finalidade especifica.");
        if (!isEmissionSupported && operation !== "return") {
            issues.push("Emissao real liberada apenas para Venda comum, Remessa para conserto, Remessa em garantia, Retorno de conserto e Retorno de garantia neste MVP.");
        }
        if (operation === "return") {
            if (purpose !== "Devolucao de compra") issues.push("Emissao real de devolucao liberada apenas para Devolucao de compra com NF-e de entrada importada.");
            if (!selectedEntryInvoice) issues.push("Selecione uma NF-e de entrada importada para devolucao.");
            if (digits(referencedKey).length !== 44) issues.push("A nota de origem precisa ter chave de acesso valida.");
            if (selectedReturnItems.length === 0) issues.push("Selecione ao menos um item da nota de origem para devolver.");
        }
        if (isRetornoConsertoMvp || isRetornoGarantiaMvp) {
            if (!selectedEntryInvoice) issues.push(`Selecione uma NF-e de remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"} autorizada.`);
            if (digits(referencedKey).length !== 44) issues.push("A remessa de origem precisa ter chave de acesso valida.");
            if (selectedReturnItems.length === 0) issues.push("Selecione ao menos um item da remessa para retornar.");
        }
        if (operation !== "return") {
            if (!participant.nome.trim()) issues.push("Informe ou selecione o participante.");
            if (!isValidDoc(participant.cpf_cnpj)) issues.push("Informe CPF/CNPJ valido do participante.");
            if (!participant.logradouro || !participant.numero || !participant.bairro || !participant.cidade || !participant.uf || !participant.cep || !participant.codigo_municipio) {
                issues.push("Complete o endereco do participante.");
            }
            if (!isRetornoConsertoMvp && !isRetornoGarantiaMvp) {
                if (items.length === 0) issues.push("Adicione ao menos um item.");
                items.forEach((item, index) => {
                    if (!item.descricao.trim()) issues.push(`Item ${index + 1}: informe a descricao.`);
                    if (!/^\d{8}$/.test(digits(item.ncm))) issues.push(`Item ${index + 1}: informe NCM valido.`);
                    if (!item.cfop || digits(item.cfop).length !== 4) issues.push(`Item ${index + 1}: CFOP pendente.`);
                    if (item.quantidade <= 0) issues.push(`Item ${index + 1}: quantidade deve ser maior que zero.`);
                    if (item.valor_unitario < 0) issues.push(`Item ${index + 1}: valor unitario invalido.`);
                });
            }
        }

        if (modFrete !== "9" && (!carrierName.trim() || !isValidDoc(carrierDoc))) {
            issues.push("Informe transportadora com CPF/CNPJ valido ou use frete sem transporte.");
        }

        return issues;
    }, [operation, purpose, isEmissionSupported, isRetornoConsertoMvp, isRetornoGarantiaMvp, selectedEntryInvoice, referencedKey, selectedReturnItems.length, participant, items, modFrete, carrierName, carrierDoc]);

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
    };

    const selectEntryInvoice = async (invoice: EntryInvoiceSummary) => {
        setSelectedEntryInvoice(invoice);
        setReferencedKey(invoice.chave_acesso || "");
        setLoadingEntryItems(true);

        try {
            const data = operation === "return"
                ? await getEntryInvoiceWithItemsAction(invoice.id)
                : await getNFeInvoiceWithItemsAction(invoice.id);
            if (!data) {
                alert("Nao foi possivel carregar a NF-e de origem selecionada.");
                setReturnItems([]);
                return;
            }

            if (isRetornoConsertoMvp || isRetornoGarantiaMvp) {
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

    const runAiAuditMock = () => {
        if (pending.length > 0) {
            setAiAudit(`Auditoria simulada: existem ${pending.length} pendencia(s) bloqueante(s). Corrija antes de emitir.`);
            return;
        }

        setAiAudit(`Auditoria simulada: rascunho coerente para "${purpose}" em ${destinationLabel.toLowerCase()}. A emissao ainda depende do motor fiscal final.`);
    };

    const handleEmitirVendaComum = async () => {
        if (!profile?.organization_id) {
            alert("Organizacao nao encontrada. Recarregue a pagina e tente novamente.");
            return;
        }

        if (!isVendaComumMvp) {
            alert("Nesta etapa, a emissao real da tela completa esta liberada apenas para Venda comum.");
            return;
        }

        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const confirmMessage =
            `Emitir NF-e de Venda comum em ${environment === "production" ? "PRODUCAO" : "HOMOLOGACAO"}?\n\n` +
            `Destinatario: ${participant.nome}\n` +
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

        if (purpose !== "Devolucao de compra") {
            alert("Nesta etapa, a emissao real de devolucao esta liberada apenas para Devolucao de compra com NF-e de entrada importada.");
            return;
        }

        if (!selectedEntryInvoice) {
            alert("Selecione uma NF-e de entrada para devolucao.");
            return;
        }

        if (selectedReturnItems.length === 0) {
            alert("Selecione ao menos um item para devolver.");
            return;
        }

        const confirmMessage =
            `Emitir NF-e de Devolucao em ${environment === "production" ? "PRODUCAO" : "HOMOLOGACAO"}?\n\n` +
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
                alert("NF-e de devolucao enviada.");
                window.location.href = "/fiscal";
            } else {
                alert(`Erro ao emitir devolucao:\n${result.error || "Erro desconhecido"}`);
            }
        } catch (error: any) {
            alert(`Erro ao emitir devolucao:\n${error.message || "Erro desconhecido"}`);
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
            alert("Nesta etapa, a emissao real de remessa esta liberada apenas para Remessa para conserto e Remessa em garantia.");
            return;
        }

        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const remessaLabel = isRemessaGarantiaMvp ? "Remessa em garantia" : "Remessa para conserto";
        const confirmMessage =
            `Emitir NF-e de ${remessaLabel} em ${environment === "production" ? "PRODUCAO" : "HOMOLOGACAO"}?\n\n` +
            `Destinatario: ${participant.nome}\n` +
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
            alert("Nesta etapa, a emissao real de retorno esta liberada apenas para Retorno de conserto e Retorno de garantia.");
            return;
        }

        if (pending.length > 0) {
            alert(`Corrija as pendencias antes de emitir:\n${pending.join("\n")}`);
            return;
        }

        const retornoLabel = isRetornoGarantiaMvp ? "Retorno de garantia" : "Retorno de conserto";
        const confirmMessage =
            `Emitir NF-e de ${retornoLabel} em ${environment === "production" ? "PRODUCAO" : "HOMOLOGACAO"}?\n\n` +
            `Destinatario: ${participant.nome}\n` +
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

    const handleEmitirNFe = () => {
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

        handleEmitirVendaComum();
    };

    const fieldClass = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 outline-none transition focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20";
    const labelClass = "ml-1 text-[10px] font-black uppercase text-stone-400";
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/fiscal">
                        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-600 shadow-sm transition hover:bg-stone-50">
                            <ArrowLeft size={18} />
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-[#1A1A1A]">Emissao completa de NF-e</h1>
                        <p className="text-sm font-medium text-stone-500">Rascunho guiado para operacoes comuns e modo avancado.</p>
                    </div>
                </div>

                <div className="flex w-fit items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setEnvironment("homologation")}
                        className={`rounded-lg px-4 py-2 text-xs font-black transition ${environment === "homologation" ? "bg-yellow-100 text-yellow-700" : "text-stone-400 hover:text-stone-700"}`}
                    >
                        Homologacao
                    </button>
                    <button
                        type="button"
                        onClick={() => setEnvironment("production")}
                        className={`rounded-lg px-4 py-2 text-xs font-black transition ${environment === "production" ? "bg-green-100 text-green-700" : "text-stone-400 hover:text-stone-700"}`}
                    >
                        Producao
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr_320px]">
                <aside className="space-y-3">
                    <div className="rounded-2xl border border-stone-100 bg-white p-3 shadow-sm">
                        {STEPS.map((item, index) => {
                            const active = item.id === step;
                            const done = index < stepIndex;
                            const blocked = stepHasPending(item.id);

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setStep(item.id)}
                                    className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition last:mb-0 ${active ? "bg-[#1A1A1A] text-[#FACC15]" : "text-stone-600 hover:bg-stone-50"}`}
                                >
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${active ? "bg-[#FACC15] text-[#1A1A1A]" : done ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-400"}`}>
                                        {done ? <CheckCircle size={14} /> : index + 1}
                                    </span>
                                    <span className="flex-1 text-sm font-black">{item.label}</span>
                                    {blocked && <AlertCircle size={14} className={active ? "text-[#FACC15]" : "text-red-400"} />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                        <p className="text-xs font-black uppercase text-stone-400">Resumo</p>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-stone-500">Operacao</span>
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
                    {step === "operation" && (
                        <section className="space-y-5">
                            <div>
                                <h2 className="text-lg font-black text-[#1A1A1A]">Tipo de operacao</h2>
                                <p className="text-sm text-stone-500">Escolha a natureza de negocio. O CFOP vem depois, como resultado das regras.</p>
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

                            <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                <label className={labelClass}>Finalidade especifica</label>
                                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={fieldClass}>
                                    {currentOperation.purposes.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>

                            {requiresReference && (
                                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <p className="font-black text-orange-800">
                                                {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "Remessa de origem autorizada" : "Nota de origem importada"}
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-orange-700">
                                                {(isRetornoConsertoMvp || isRetornoGarantiaMvp)
                                                    ? `O retorno usa uma NF-e de remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"} autorizada para referenciar a chave e carregar os itens.`
                                                    : "A devolucao usa a NF-e de entrada importada para referenciar a chave e espelhar os impostos no backend aprovado."}
                                            </p>
                                        </div>
                                        {loadingEntryInvoices && <Loader2 size={18} className="animate-spin text-orange-500" />}
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                            <div className="flex-1">
                                                <label className="ml-1 text-[10px] font-black uppercase text-orange-500">
                                                    {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? `Buscar remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"}` : "Buscar NF-e de entrada"}
                                                </label>
                                                <input
                                                    value={entrySearch}
                                                    onChange={(e) => {
                                                        setEntrySearch(e.target.value);
                                                        if (e.target.value.trim()) setOriginQuickFilter("all");
                                                    }}
                                                    className="mt-1 w-full rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                                                    placeholder={(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "Cliente, CPF/CNPJ, numero ou chave" : "Fornecedor, CNPJ, numero ou chave"}
                                                />
                                            </div>

                                            <div className="flex w-fit gap-1 rounded-xl border border-orange-200 bg-orange-100 p-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setOriginQuickFilter("recent")}
                                                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${originQuickFilter === "recent" ? "bg-white text-orange-800 shadow-sm" : "text-orange-600"}`}
                                                >
                                                    Ultimas 10
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setOriginQuickFilter("all")}
                                                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${originQuickFilter === "all" ? "bg-white text-orange-800 shadow-sm" : "text-orange-600"}`}
                                                >
                                                    Todas
                                                </button>
                                            </div>
                                        </div>
                                        <p className="mt-2 text-xs font-bold text-orange-700">
                                            Mostrando {filteredEntryInvoices.length} de {entryInvoices.length} {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "remessa(s) autorizada(s)" : "nota(s) encontrada(s)"}.
                                        </p>
                                    </div>

                                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
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
                                                                NF {invoice.numero || "-"} | {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? (invoice.destinatario_nome || "Destinatario sem nome") : (invoice.emitente_nome || "Fornecedor sem nome")}
                                                            </p>
                                                            <p className="mt-1 text-xs font-medium text-stone-500">
                                                                {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? (invoice.destinatario_cnpj || "CNPJ pendente") : (invoice.emitente_cnpj || "CNPJ pendente")} | {invoice.chave_acesso || "chave pendente"}
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
                                                {(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? `Nenhuma remessa para ${isRetornoGarantiaMvp ? "garantia" : "conserto"} autorizada encontrada neste ambiente.` : "Nenhuma NF-e de entrada encontrada."}
                                            </p>
                                        )}
                                    </div>

                                    {isRetornoGarantiaMvp && legacyGuaranteeInvoices.length > 0 && (
                                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                            <p className="text-xs font-black uppercase text-amber-700">
                                                Notas legadas (fora do padrao atual): {legacyGuaranteeInvoices.length}
                                            </p>
                                            <p className="mt-1 text-xs font-medium text-amber-700">
                                                Estas notas tem observacao de garantia, mas natureza de conserto. Ficam separadas e marcadas como legado.
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
                                                                        NF {invoice.numero || "-"} | {invoice.destinatario_nome || "Destinatario sem nome"}
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

                            {operation === "sale" && purpose !== "Venda comum" && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Cenario ainda nao parametrizado</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        Por enquanto, a emissao real da nova tela esta liberada apenas para Venda comum. Esta finalidade fica disponivel como rascunho para evolucao fiscal posterior.
                                    </p>
                                </div>
                            )}

                            {operation === "return" && purpose !== "Devolucao de compra" && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Cenario ainda nao parametrizado</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        A copia cirurgica do fluxo aprovado cobre a devolucao de compra baseada em NF-e de entrada importada. Devolucao de venda sera parametrizada depois.
                                    </p>
                                </div>
                            )}

                            {operation === "shipment" && (
                                <ShipmentGuidance
                                    purpose={purpose}
                                    cfop={suggestedCfop}
                                    destinationLabel={destinationLabel}
                                    canEmit={isRemessaConsertoMvp || isRemessaGarantiaMvp || isRetornoConsertoMvp}
                                />
                            )}

                            {(operation === "transfer" || operation === "bonus") && (
                                <BlockedOperationGuidance
                                    operation={operation}
                                    purpose={purpose}
                                    cfop={suggestedCfop}
                                    destinationLabel={destinationLabel}
                                />
                            )}

                            {operation !== "sale" && operation !== "return" && !isRemessaConsertoMvp && !isRemessaGarantiaMvp && !isRetornoConsertoMvp && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                    <p className="font-black text-amber-800">Rascunho sem emissao real nesta fase</p>
                                    <p className="mt-1 text-sm font-medium text-amber-700">
                                        Esta operacao precisa de motor fiscal proprio antes de transmitir. A UI permite estruturar o rascunho, mas bloqueia a emissao.
                                    </p>
                                </div>
                            )}
                        </section>
                    )}

                    {step === "participant" && (
                        <section className="space-y-5">
                            <div>
                                <h2 className="text-lg font-black text-[#1A1A1A]">Participante da nota</h2>
                                <p className="text-sm text-stone-500">
                                    {operation === "return"
                                        ? "Na devolucao, o participante vem da NF-e de entrada selecionada."
                                        : "Busque um cadastro existente ou preencha um novo destinatario/remetente."}
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
                                            className={`rounded-lg px-3 py-2 text-xs font-black transition ${participantMode === "search" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-stone-500"}`}
                                        >
                                            Buscar cadastro
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setParticipantMode("manual")}
                                            className={`rounded-lg px-3 py-2 text-xs font-black transition ${participantMode === "manual" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-stone-500"}`}
                                        >
                                            Novo participante
                                        </button>
                                    </div>

                                    {participantMode === "search" && (
                                        <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                            <label className={labelClass}>Buscar por nome, CPF/CNPJ ou telefone</label>
                                            <div className="relative mt-1">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                                <input
                                                    value={participantSearch}
                                                    onChange={(e) => setParticipantSearch(e.target.value)}
                                                    className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-10 pr-3 text-sm font-medium outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/20"
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
                                        </div>
                                    )}

                                    <ParticipantForm
                                        participant={participant}
                                        setParticipant={setParticipant}
                                        fieldClass={fieldClass}
                                        labelClass={labelClass}
                                        loadingCep={loadingCep}
                                        buscaCep={buscaCepParticipante}
                                    />
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
                                            ? "Selecione os itens da nota de origem e as quantidades desta emissao."
                                            : "Tributacao e CFOP sao tratados por item."}
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
                                    mode={(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "retorno" : "devolucao"}
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
                                                <label className={labelClass}>Descricao</label>
                                                <div className="relative">
                                                    <input
                                                        value={item.descricao}
                                                        onChange={(e) => updateItem(item.id, { descricao: e.target.value, codigo: item.codigo && item.descricao !== e.target.value ? "" : item.codigo })}
                                                        onFocus={() => setFocusedItemId(item.id)}
                                                        onBlur={() => setTimeout(() => setFocusedItemId(null), 180)}
                                                        className={fieldClass}
                                                        placeholder="Buscar peca do estoque..."
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
                                                <label className={labelClass}>NCM</label>
                                                <input value={item.ncm} onChange={(e) => updateItem(item.id, { ncm: digits(e.target.value).slice(0, 8) })} className={fieldClass} />
                                            </div>

                                            <div className="xl:col-span-3">
                                                <label className={labelClass}>CFOP</label>
                                                <input
                                                    value={item.cfop}
                                                    onChange={(e) => updateItem(item.id, { cfop: digits(e.target.value).slice(0, 4) })}
                                                    readOnly={operation !== "advanced"}
                                                    className={`${fieldClass} ${operation !== "advanced" ? "bg-stone-100 text-stone-500" : ""}`}
                                                />
                                            </div>

                                            <div className="xl:col-span-2">
                                                <label className={labelClass}>UN</label>
                                                <input value={item.unidade} onChange={(e) => updateItem(item.id, { unidade: e.target.value.toUpperCase().slice(0, 6) })} className={fieldClass} />
                                            </div>

                                            <div className="xl:col-span-2">
                                                <label className={labelClass}>Qtd</label>
                                                <input type="number" value={item.quantidade} onChange={(e) => updateItem(item.id, { quantidade: Number(e.target.value) })} className={fieldClass} />
                                            </div>

                                            <div className="xl:col-span-2">
                                                <label className={labelClass}>Valor</label>
                                                <input type="number" step="0.01" value={item.valor_unitario} onChange={(e) => updateItem(item.id, { valor_unitario: Number(e.target.value) })} className={fieldClass} />
                                            </div>
                                        </div>

                                        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
                                            <div className="xl:col-span-3">
                                                <label className={labelClass}>CSOSN/CST</label>
                                                <input value={item.csosn} onChange={(e) => updateItem(item.id, { csosn: e.target.value })} className={fieldClass} />
                                            </div>
                                            <div className="xl:col-span-5">
                                                <label className={labelClass}>Origem</label>
                                                <select value={item.origem} onChange={(e) => updateItem(item.id, { origem: e.target.value })} className={fieldClass}>
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
                                <h2 className="text-lg font-black text-[#1A1A1A]">Transporte e observacoes</h2>
                                <p className="text-sm text-stone-500">Preencha frete, volumes e textos fiscais/comerciais.</p>
                            </div>

                            <div className="rounded-2xl border border-stone-100 bg-[#F8F7F2] p-4">
                                <label className={labelClass}>Modalidade do frete</label>
                                <select value={modFrete} onChange={(e) => setModFrete(e.target.value)} className={fieldClass}>
                                    <option value="9">9 - Sem ocorrencia de transporte</option>
                                    <option value="0">0 - Por conta do emitente</option>
                                    <option value="1">1 - Por conta do destinatario</option>
                                    <option value="2">2 - Por conta de terceiros</option>
                                    <option value="3">3 - Transporte proprio por conta do remetente</option>
                                    <option value="4">4 - Transporte proprio por conta do destinatario</option>
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
                                    <label className={labelClass}>Observacoes comerciais</label>
                                    <textarea value={infCpl} onChange={(e) => setInfCpl(e.target.value)} rows={6} className={`${fieldClass} resize-none`} />
                                </div>
                                <div>
                                    <label className={labelClass}>Observacoes fiscais</label>
                                    <textarea value={infAdFisco} onChange={(e) => setInfAdFisco(e.target.value)} rows={6} className={`${fieldClass} resize-none`} />
                                </div>
                            </div>
                        </section>
                    )}

                    {step === "review" && (
                        <section className="space-y-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-[#1A1A1A]">Revisao fiscal</h2>
                                    <p className="text-sm text-stone-500">
                                        {isEmissionSupported || operation === "return"
                                            ? "Confira todos os dados antes de transmitir a NF-e."
                                            : "Confira o rascunho. Esta finalidade ainda nao transmite NF-e."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={runAiAuditMock}
                                    className="flex w-fit items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700 shadow-sm transition hover:border-[#FACC15]"
                                >
                                    <ShieldCheck size={16} /> Auditar com IA
                                </button>
                            </div>

                            {pending.length > 0 ? (
                                <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                                    <p className="font-black text-red-700">Pendencias bloqueantes</p>
                                    <div className="mt-2 space-y-1">
                                        {pending.map((issue) => (
                                            <p key={issue} className="text-sm font-medium text-red-700">- {issue}</p>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                                    <p className="flex items-center gap-2 font-black text-green-700"><CheckCircle size={18} /> Rascunho sem pendencias estruturais.</p>
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
                                    mode={(isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "retorno" : "devolucao"}
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

                            {(operation === "transfer" || operation === "bonus") && (
                                <BlockedOperationTechnicalPreview
                                    operation={operation}
                                    purpose={purpose}
                                    cfop={suggestedCfop}
                                    destinationLabel={destinationLabel}
                                    items={items}
                                    total={totalItems}
                                />
                            )}

                            <DanfePreview
                                operation={currentOperation.title}
                                purpose={purpose}
                                destinationLabel={destinationLabel}
                                participant={participant}
                                items={previewItems}
                                total={displayTotal}
                                modFrete={modFrete}
                                infCpl={infCpl}
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
                                className="flex items-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-2 text-sm font-black text-[#FACC15] transition hover:bg-black"
                            >
                                Proximo <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={pending.length > 0 || emitting}
                                onClick={handleEmitirNFe}
                                className="flex items-center gap-2 rounded-xl bg-[#FACC15] px-4 py-2 text-sm font-black text-[#1A1A1A] transition hover:bg-yellow-300 disabled:opacity-40"
                            >
                                {emitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {emitting ? "Emitindo..." : operation === "return" ? "Emitir NF-e de Devolucao" : isVendaComumMvp ? "Emitir NF-e de Venda" : (isRemessaConsertoMvp || isRemessaGarantiaMvp) ? "Emitir NF-e de Remessa" : (isRetornoConsertoMvp || isRetornoGarantiaMvp) ? "Emitir NF-e de Retorno" : "Emissao indisponivel"}
                            </button>
                        )}
                    </div>
                </main>

                <aside className="space-y-3">
                    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                        <p className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]"><AlertCircle size={16} /> Pendencias</p>
                        {pending.length === 0 ? (
                            <p className="mt-3 text-sm font-medium text-green-700">Nenhuma pendencia estrutural.</p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {pending.slice(0, 6).map((issue) => (
                                    <p key={issue} className="rounded-xl bg-red-50 p-2 text-xs font-bold text-red-700">{issue}</p>
                                ))}
                                {pending.length > 6 && <p className="text-xs font-bold text-stone-400">+ {pending.length - 6} pendencia(s)</p>}
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
                        <p className="flex items-center gap-2 text-sm font-black text-[#1A1A1A]"><Truck size={16} /> Regra atual</p>
                        <div className="mt-3 space-y-2 text-sm font-medium text-stone-600">
                            <p>UF emitente: <strong>{companyUf || "Nao carregada"}</strong></p>
                            <p>UF participante: <strong>{participantUf || "Pendente"}</strong></p>
                            <p>Classificacao: <strong>{destinationLabel}</strong></p>
                            <p>CFOP sugerido: <strong>{suggestedCfop || "Modo avancado"}</strong></p>
                        </div>
                    </div>
                </aside>
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

    return (
        <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
                <UserPlus size={16} className="text-stone-500" />
                <p className="text-sm font-black text-[#1A1A1A]">Dados do participante</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                    <label className={labelClass}>Nome/Razao social</label>
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
                <div>
                    <label className={labelClass}>Indicador IE</label>
                    <select value={participant.ind_ie_dest} onChange={(e) => patch({ ind_ie_dest: e.target.value as Participant["ind_ie_dest"] })} className={fieldClass}>
                        <option value="1">Contribuinte</option>
                        <option value="2">Isento</option>
                        <option value="9">Nao contribuinte</option>
                    </select>
                </div>
                <div>
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
                        <input value={participant.cep} onChange={(e) => patch({ cep: e.target.value })} onBlur={buscaCep} className={`${fieldClass} pr-9`} />
                        <button type="button" onClick={buscaCep} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400">
                            {loadingCep ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                        </button>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className={labelClass}>Logradouro</label>
                    <input value={participant.logradouro} onChange={(e) => patch({ logradouro: e.target.value })} className={fieldClass} />
                </div>
                <div>
                    <label className={labelClass}>Numero</label>
                    <input value={participant.numero} onChange={(e) => patch({ numero: e.target.value })} className={fieldClass} />
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
                    <label className={labelClass}>Codigo municipio</label>
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
                    : "Selecione uma NF-e de entrada na primeira etapa para carregar os itens da devolucao."}
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
                        : "A emissao usa o mesmo backend aprovado: os impostos/taxas sao espelhados a partir do XML original."}
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
                        {canEmit ? `${purpose} liberada para emissao` : status.title}
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
                    <p className={`font-black ${canEmit ? "text-green-800" : "text-blue-800"}`}>Previa tecnica de Remessa/Retorno</p>
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
    const title = operation === "transfer" ? "Previa tecnica de Transferencia" : "Previa tecnica de Bonificacao/Doacao";

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
                        {mode === "retorno" ? "Previa tecnica do retorno de conserto" : "Previa tecnica da devolucao"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-orange-700">
                        {mode === "retorno"
                            ? "Esta emissao referenciara a NF-e original e usara CFOP 5916/6916 conforme a UF do participante."
                            : "Esta emissao chamara o mesmo backend aprovado em producao: `emitirNFeDevolucao`."}
                    </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase ${environment === "production" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {environment === "production" ? "Producao" : "Homologacao"}
                </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">entry_invoice_id</p>
                    <p className="mt-1 break-all font-mono text-xs font-bold text-[#1A1A1A]">{entryInvoice?.id || "pendente"}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-stone-400">nota origem</p>
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
                        {mode === "retorno" ? "Nenhum item selecionado para retorno." : "Nenhum item selecionado para devolucao."}
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
                <Loader2 size={14} className="animate-spin" /> Buscando pecas...
            </div>
        );
    }

    if (results.length === 0) {
        return <p className="p-2 text-xs font-medium text-stone-400">Nenhuma peca encontrada. Voce pode continuar preenchendo manualmente.</p>;
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
}: {
    operation: string;
    purpose: string;
    destinationLabel: string;
    participant: Participant;
    items: DraftItem[];
    total: number;
    modFrete: string;
    infCpl: string;
}) {
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
                    <p className="text-[10px] font-black uppercase text-stone-400">Destinatario/Remetente</p>
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
                                <td className="px-3 py-3 font-bold text-stone-800">{item.descricao || "Item sem descricao"}</td>
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

            <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-stone-400">Transporte</p>
                    <p className="mt-1 text-sm font-bold text-stone-700">modFrete {modFrete}</p>
                </div>
                <div className="border-t-2 border-stone-300 p-4 md:border-l-2 md:border-t-0">
                    <p className="text-[10px] font-black uppercase text-stone-400">Informacoes complementares</p>
                    <p className="mt-1 text-sm font-medium text-stone-600">{infCpl || "Sem observacoes comerciais."}</p>
                </div>
            </div>
        </div>
    );
}
