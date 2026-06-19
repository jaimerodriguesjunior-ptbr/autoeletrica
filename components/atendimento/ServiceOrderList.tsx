"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Camera,
  Car,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../src/lib/supabase";
import { useAuth } from "../../src/contexts/AuthContext";
import { PlateScannerModal } from "@/components/ui/PlateScannerModal";

type WorkOrder = {
  id: string | number;
  status: string;
  total: number;
  created_at: string;
  tipo?: string;
  clients: {
    nome: string;
  } | null;
  vehicles: {
    modelo: string;
    placa: string;
  } | null;
};

type ScanFeedback = {
  kind: "info" | "warning" | "error";
  message: string;
  plate?: string;
};

const OPEN_STATUSES = ["orcamento", "aprovado", "em_servico", "aguardando_peca", "pronto"];

function normalizeText(value: string) {
  return value.toLowerCase();
}

function normalizePlate(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export default function ServiceOrderList() {
  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [scannerAberto, setScannerAberto] = useState(false);
  const [scanPlateFilter, setScanPlateFilter] = useState("");
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) {
      void fetchOrders();
    }
  }, [profile?.organization_id]);

  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id,
          status,
          total,
          created_at,
          tipo,
          clients ( nome ),
          vehicles ( modelo, placa )
        `)
        .eq("organization_id", profile?.organization_id)
        .not("vehicle_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setOrders((data || []) as unknown as WorkOrder[]);
    } catch (error) {
      console.error("Erro ao buscar OS:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatStatus(slug: string) {
    const map: Record<string, string> = {
      orcamento: "Orcamento",
      aprovado: "Aprovado",
      aguardando_peca: "Aguardando Peca",
      em_servico: "Em Execucao",
      pronto: "Pronto",
      entregue: "Finalizado",
      cancelado: "Cancelado",
    };
    return map[slug] || slug;
  }

  function getStatusStyle(slug: string) {
    switch (slug) {
      case "orcamento":
        return "bg-stone-100 text-stone-600 border border-stone-200";
      case "aprovado":
        return "bg-blue-50 text-blue-700 border border-blue-100";
      case "em_servico":
        return "bg-blue-100 text-blue-800 border border-blue-200 animate-pulse";
      case "aguardando_peca":
        return "bg-orange-50 text-orange-700 border border-orange-100";
      case "pronto":
        return "bg-green-100 text-green-700 border border-green-200 font-bold";
      case "entregue":
        return "bg-stone-800 text-[#FACC15] border border-stone-900";
      default:
        return "bg-stone-50 text-stone-500";
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  const filteredOrders = orders.filter((os) => {
    const searchLower = normalizeText(searchTerm);
    const searchPlate = normalizePlate(searchTerm);
    const vehiclePlate = os.vehicles?.placa || "";

    const matchSearch =
      scanPlateFilter.length > 0
        ? normalizePlate(vehiclePlate) === scanPlateFilter
        : normalizeText(os.clients?.nome || "").includes(searchLower) ||
          normalizeText(vehiclePlate).includes(searchLower) ||
          normalizePlate(vehiclePlate).includes(searchPlate) ||
          normalizeText(os.vehicles?.modelo || "").includes(searchLower) ||
          String(os.id).toLowerCase().includes(searchLower);

    if (!matchSearch) {
      return false;
    }

    if (filtroAtivo === "todos") {
      return true;
    }

    if (filtroAtivo === "abertas") {
      return OPEN_STATUSES.includes(os.status);
    }

    if (filtroAtivo === "orcamentos") {
      return os.status === "orcamento";
    }

    if (filtroAtivo === "em andamento") {
      return ["aprovado", "em_servico", "aguardando_peca"].includes(os.status);
    }

    if (filtroAtivo === "finalizados") {
      return ["pronto", "entregue", "cancelado"].includes(os.status);
    }

    return true;
  });

  function getWorkOrderHref(os: WorkOrder) {
    return os.tipo === "venda_balcao" ? `/recibo/${os.id}` : `/os/detalhes/${os.id}`;
  }

  async function handlePlateScanned(plate: string) {
    const normalizedPlate = normalizePlate(plate);
    setScannerAberto(false);
    setSearchTerm(normalizedPlate);
    setScanPlateFilter(normalizedPlate);
    setFiltroAtivo("abertas");

    const matchingOpenOrders = orders.filter((os) => {
      return OPEN_STATUSES.includes(os.status) && normalizePlate(os.vehicles?.placa || "") === normalizedPlate;
    });

    if (matchingOpenOrders.length === 1) {
      setScanFeedback({
        kind: "info",
        plate: normalizedPlate,
        message: `Placa ${normalizedPlate} identificada. Abrindo a OS encontrada...`,
      });
      setIsRedirecting(true);
      router.push(getWorkOrderHref(matchingOpenOrders[0]));
      return;
    }

    setIsRedirecting(false);

    if (matchingOpenOrders.length === 0) {
      setScanFeedback({
        kind: "error",
        plate: normalizedPlate,
        message: `Nenhuma OS encontrada pra essa placa.`,
      });
      return;
    }

    setScanFeedback({
      kind: "warning",
      plate: normalizedPlate,
      message: `Mais de uma OS encontrada pra essa placa.`,
    });
  }

  function clearScannedPlateFilter() {
    setScanPlateFilter("");
    setScanFeedback(null);
    setSearchTerm("");
    setFiltroAtivo("todos");
    setIsRedirecting(false);
  }

  const feedbackStyles: Record<ScanFeedback["kind"], string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Ordens de Servico</h2>
          <p className="text-sm text-stone-500">Manutencoes e servicos em veiculos</p>
        </div>

        <Link
          href="/os/nova"
          className="flex items-center gap-2 rounded-full bg-[#1A1A1A] px-5 py-2.5 text-xs font-bold text-[#FACC15] shadow-lg transition hover:scale-105 hover:bg-black"
        >
          <Plus size={18} /> Nova OS
        </Link>
      </div>

      <div className="flex flex-col gap-2 rounded-[24px] border-2 border-stone-300 bg-white p-2 shadow-sm md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setScanPlateFilter("");
              setScanFeedback(null);
              setIsRedirecting(false);
            }}
            placeholder="Buscar por placa, cliente ou OS..."
            className="w-full rounded-2xl border-2 border-stone-300 bg-stone-50 py-3 pl-12 pr-16 text-sm font-medium text-[#1A1A1A] outline-none transition focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50"
          />
          <button
            type="button"
            onClick={() => setScannerAberto(true)}
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-[#1A1A1A] text-[#FACC15] shadow-sm transition hover:scale-105 hover:bg-black"
            title="Ler placa pela camera"
          >
            <Camera size={18} />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border-2 border-stone-300 bg-stone-200 p-1.5 shadow-inner scrollbar-hide">
          {["todos", "abertas", "em andamento", "orcamentos", "finalizados"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFiltroAtivo(tab)}
              className={`whitespace-nowrap rounded-xl border-2 px-4 py-2 text-xs font-bold capitalize transition ${
                filtroAtivo === tab
                  ? "border-stone-300 bg-white text-[#1A1A1A] shadow-md"
                  : "border-transparent text-stone-500 hover:text-[#1A1A1A]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {scanFeedback && (
        <div className={`flex items-start justify-between gap-3 rounded-[28px] border px-4 py-3 ${feedbackStyles[scanFeedback.kind]}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1A1A1A] text-[#FACC15] shadow-sm">
              {isRedirecting ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles size={18} />}
            </div>
            <div>
              {scanFeedback.plate && (
                <p className="text-sm font-bold">Placa identificada: {scanFeedback.plate}</p>
              )}
              <p className="text-sm">{scanFeedback.message}</p>
              {scanPlateFilter && !isRedirecting && (
                <p className="text-xs opacity-80">A lista abaixo foi filtrada com essa placa nas OS em aberto.</p>
              )}
            </div>
          </div>

          {!isRedirecting && (
            <button
              type="button"
              onClick={clearScannedPlateFilter}
              className="mt-1 rounded-full p-1 transition hover:bg-black/5"
              title="Limpar leitura"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      <div className="flex min-h-[400px] flex-1 flex-col overflow-hidden rounded-[32px] border-2 border-stone-300 bg-white shadow-sm">
        <div className="h-full space-y-2 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-stone-400">
              <Loader2 className="animate-spin text-[#FACC15]" size={32} />
              <p className="text-xs font-medium">Buscando ordens...</p>
            </div>
          ) : filteredOrders.length > 0 ? (
            filteredOrders.map((os) => (
              <Link
                key={os.id}
                href={getWorkOrderHref(os)}
                className="block"
              >
                <div className="group mb-2 flex cursor-pointer flex-col items-start justify-between rounded-3xl border-2 border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 md:flex-row md:items-center">
                  <div className="flex w-full items-center gap-4 md:w-auto">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition ${
                        !os.vehicles
                          ? "bg-orange-50 text-orange-400 group-hover:bg-white"
                          : "bg-stone-50 text-stone-400 group-hover:bg-white"
                      }`}
                    >
                      {!os.vehicles ? <ShoppingBag size={24} /> : <Car size={24} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#1A1A1A]">
                          {os.vehicles?.modelo || `Venda #${os.id}`}
                        </span>
                        {os.vehicles?.placa && (
                          <span className="rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-500">
                            {os.vehicles.placa}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-4 text-sm text-stone-500">
                        <span className="flex items-center gap-1">
                          <User size={14} /> {os.clients?.nome || "Consumidor"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} /> {formatDate(os.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex w-full items-center justify-between gap-6 md:mt-0 md:w-auto md:justify-end">
                    <span className={`rounded-full px-4 py-2 text-xs font-bold ${getStatusStyle(os.status)}`}>
                      {formatStatus(os.status)}
                    </span>
                    <div className="min-w-[80px] text-right">
                      <p className="text-xs font-medium text-stone-400">Total</p>
                      <p className="font-bold text-[#1A1A1A]">
                        {os.total > 0 ? formatCurrency(os.total) : "--"}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-100 text-stone-300 transition group-hover:border-transparent group-hover:bg-[#1A1A1A] group-hover:text-[#FACC15]">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-stone-400">
              <div className="mb-2 rounded-full bg-stone-50 p-4">
                <AlertCircle size={32} />
              </div>
              <p>{scanPlateFilter ? "Nenhuma OS encontrada pra essa placa." : "Nenhuma ordem de servico encontrada."}</p>
            </div>
          )}
        </div>
      </div>

      {scannerAberto && (
        <PlateScannerModal
          onPlateScanned={handlePlateScanned}
          onClose={() => setScannerAberto(false)}
        />
      )}
    </div>
  );
}
