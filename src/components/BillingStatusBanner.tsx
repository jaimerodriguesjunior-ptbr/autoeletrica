"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, QrCode, X } from "lucide-react";
import { usePathname } from "next/navigation";

import type { CobrancaStoreBillingStatus } from "@/src/lib/nuvemLocalCobranca";
import { createClient } from "@/src/utils/supabase/client";

function formatCurrency(value?: number | null) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(value?: string | null) {
  if (!value) return null;

  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function isPastDate(value?: string | null) {
  if (!value) return false;

  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return false;

  return new Date(year, month - 1, day).getTime() < localToday;
}

function isTodayDate(value?: string | null) {
  if (!value) return false;

  const today = new Date();
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return false;

  return (
    today.getFullYear() === year &&
    today.getMonth() === month - 1 &&
    today.getDate() === day
  );
}

function localDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function differenceInCalendarDays(target?: string | null) {
  if (!target) return null;

  const [year, month, day] = target.split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date();
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const targetDate = Date.UTC(year, month - 1, day);
  return Math.round((targetDate - current) / (24 * 60 * 60 * 1000));
}

export function BillingStatusBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<CobrancaStoreBillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissedNoticeKey, setDismissedNoticeKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadStatus() {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        const headers = session?.access_token
          ? {
              Authorization: `Bearer ${session.access_token}`
            }
          : undefined;

        const response = await fetch("/api/cobranca/status", {
          cache: "no-store",
          headers
        });
        const data = await response.json().catch(() => null);

        if (active && response.ok) {
          setStatus(data);
        }
      } catch (error) {
        console.warn("Não foi possível consultar o status de cobrança.", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      active = false;
    };
  }, [pathname]);

  const noticeKey = status
    ? `billing-notice:${status.store?.store_id ?? "unknown"}:${status.status}:${localDateKey()}`
    : null;

  useEffect(() => {
    setDismissedNoticeKey(noticeKey && window.localStorage.getItem(noticeKey) ? noticeKey : null);
  }, [noticeKey]);

  if (loading || !status) return null;

  const isBlocked = status.shouldBlockNewOperations || status.status === "bloqueado";
  const amount = formatCurrency(status.store?.monthly_amount);
  const paidUntil = formatDate(status.store?.paid_until);
  const copyPaste = status.store?.payment_copy_paste;
  const qrCode = status.store?.payment_qr_code;
  const isOverdue = isPastDate(status.store?.paid_until);
  const isDueToday = isTodayDate(status.store?.paid_until);
  const isFriendlyReminder = !isBlocked && !isOverdue;
  const daysUntilBlock = differenceInCalendarDays(status.blockAfter);
  const isFinalGraceDay = status.status === "pendente" && daysUntilBlock === 0;
  const shouldShowBanner = status.paymentDueSoon || status.status === "pendente" || isBlocked;
  const shouldShowPaymentButton =
    status.status !== "vip" &&
    status.status !== "liberado" &&
    (status.status === "pendente" ||
      isBlocked ||
      status.paymentDueSoon ||
      (status.daysUntilDue !== null && status.daysUntilDue !== undefined && status.daysUntilDue >= 0 && status.daysUntilDue <= 2));
  const bannerDismissed = dismissedNoticeKey === noticeKey;

  const title = isBlocked
    ? "Mensalidade em atraso"
    : isOverdue
      ? "Mensalidade pendente"
      : "Mensalidade em dia";
  const message = isBlocked
    ? "Novas operações estão bloqueadas por falta de pagamento. Seus dados, históricos e relatórios continuam salvos. Entre em contato com o administrador para regularizar o acesso."
    : isFinalGraceDay
      ? "Seu acesso será bloqueado hoje, no fim do expediente. Seus dados continuarão salvos, mas novas operações ficarão bloqueadas."
      : paidUntil
        ? isOverdue
          ? daysUntilBlock !== null && daysUntilBlock > 0 && daysUntilBlock <= 4
            ? `Sua mensalidade está em atraso. Seu acesso será bloqueado em ${daysUntilBlock} ${daysUntilBlock === 1 ? "dia" : "dias"}. Seus dados continuarão salvos.`
            : `Sua mensalidade venceu em ${paidUntil}. Regularize quando puder para evitar o bloqueio de novas operações.`
          : isDueToday
            ? "Sua mensalidade vence hoje. Use o QR Code para realizar o pagamento por Pix."
            : `Sua mensalidade vence em ${paidUntil}. O QR Code já está disponível para pagamento antecipado.`
        : "Existe uma mensalidade pendente.";
  const bannerClasses = isBlocked
    ? "border-red-200 bg-red-50 text-red-950"
    : isOverdue
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";
  const iconClasses = isBlocked
    ? "bg-red-100 text-red-700"
    : isOverdue
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";
  const BannerIcon = isFriendlyReminder ? CheckCircle2 : AlertTriangle;

  async function copyPix() {
    if (!copyPaste) return;

    await navigator.clipboard.writeText(copyPaste);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function dismissBanner() {
    if (isFinalGraceDay) return;
    if (!noticeKey) return;

    window.localStorage.setItem(noticeKey, "dismissed");
    setDismissedNoticeKey(noticeKey);
  }

  function closePaymentModal() {
    setPaymentOpen(false);
    window.alert("Se você realizou o pagamento, logo que for dado baixa as janelas de cobrança sumirão sozinhas.");
  }

  return (
    <>
      {shouldShowBanner && !bannerDismissed && (
      <section className={`mb-5 rounded-2xl border px-4 py-4 shadow-sm md:px-5 ${bannerClasses}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${iconClasses}`}>
              <BannerIcon size={20} />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em]">{title}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {shouldShowPaymentButton && (copyPaste || qrCode) && (
              <button
                type="button"
                onClick={() => setPaymentOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-black"
              >
                <QrCode size={18} />
                Pagar
              </button>
            )}
            {!isFinalGraceDay && (
              <button
                type="button"
                onClick={dismissBanner}
                className="rounded-full p-2 text-current/60 transition hover:bg-black/10 hover:text-current"
                aria-label="Fechar aviso de cobrança"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </section>
      )}

      {shouldShowPaymentButton && (copyPaste || qrCode) && (!shouldShowBanner || bannerDismissed) && (
        <button
          type="button"
          onClick={() => setPaymentOpen(true)}
          title="Clique para consultar as opções de pagamento."
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-4 py-3 text-sm font-extrabold text-white shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:bg-black"
        >
          <QrCode size={18} />
          Pagar
        </button>
      )}

      {paymentOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-stone-400">Pagamento PIX</p>
                <h2 className="mt-1 text-xl font-black text-[#1A1A1A]">{amount}</h2>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {qrCode && (
              <div className="mb-4 flex justify-center rounded-xl border border-stone-200 bg-stone-50 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR Code Pix" className="h-56 w-56 object-contain" />
              </div>
            )}

            {copyPaste && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Pix copia e cola</p>
                <div className="flex items-stretch gap-2">
                  <input
                    readOnly
                    value={copyPaste}
                    className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={copyPix}
                    className="inline-flex items-center justify-center rounded-lg bg-[#1A1A1A] px-3 text-white transition hover:bg-black"
                    aria-label="Copiar Pix"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                {copied && <p className="mt-2 text-xs font-bold text-emerald-700">Código Pix copiado.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
