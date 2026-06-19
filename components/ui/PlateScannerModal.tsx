"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";

type PlateScannerModalProps = {
  onPlateScanned: (plate: string) => void;
  onClose: () => void;
};

const SCAN_INTERVAL_MS = 1400;

function normalizePlate(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function PlateScannerModal({ onPlateScanned, onClose }: PlateScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const processingRef = useRef(false);
  const [feedback, setFeedback] = useState("Aponte a camera para a placa. Vamos identificar o texto e buscar a OS em aberto.");
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFeedback("Este navegador nao suporta acesso a camera.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          throw new Error("Elemento de video indisponivel.");
        }

        video.srcObject = stream;
        video.muted = true;
        video.setAttribute("playsinline", "true");
        await video.play();
        setCameraReady(true);
        setFeedback("Placa enquadrada? Aguarde um instante. A leitura roda sozinha.");
        scheduleNextScan(500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/permission|denied|notallowed/i.test(message)) {
          setFeedback("Permissao da camera negada.");
        } else {
          setFeedback("Nao foi possivel iniciar a camera neste dispositivo.");
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    processingRef.current = false;
  }

  function scheduleNextScan(delay = SCAN_INTERVAL_MS) {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      void scanFrame();
    }, delay);
  }

  function getCanvas() {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    return canvasRef.current;
  }

  async function scanFrame() {
    const video = videoRef.current;
    if (!video || processingRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scheduleNextScan();
      return;
    }

    processingRef.current = true;
    setProcessing(true);
    setAttempts((current) => current + 1);

    try {
      const canvas = getCanvas();
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Nao foi possivel processar a imagem da camera.");
      }

      const sourceWidth = video.videoWidth || 1280;
      const sourceHeight = video.videoHeight || 720;
      const targetWidth = Math.min(sourceWidth, 1280);
      const scale = targetWidth / sourceWidth;
      const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      context.drawImage(video, 0, 0, targetWidth, targetHeight);

      const imageBase64 = canvas.toDataURL("image/jpeg", 0.86);
      const response = await fetch("/api/placa-ia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64, categoria: "carro" }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao analisar a imagem da placa.");
      }

      const detectedPlate = normalizePlate(String(payload?.placa || ""));
      if (detectedPlate.length >= 6) {
        stopCamera();
        onPlateScanned(detectedPlate);
        return;
      }

      setFeedback("Ainda nao conseguimos ler a placa. Segure firme e aproxime um pouco mais.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/chave|configurada|interno/i.test(message)) {
        setFeedback("A leitura automatica de placa nao esta configurada no servidor.");
      } else {
        setFeedback("Nao deu para ler a placa nesta tentativa. Vamos continuar tentando.");
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
      if (streamRef.current) {
        scheduleNextScan();
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-black">
      <div className="z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 pt-8 text-white">
        <div>
          <h2 className="text-xl font-bold tracking-wide">Ler Placa</h2>
          <p className="text-xs text-white/70">A leitura gera o texto da placa para buscar OS em aberto.</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-white/20 p-3 transition-colors hover:bg-white/40"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" />

        <div className="pointer-events-none absolute inset-0">
          <div className="h-full w-full border-[56px] border-black/50 md:border-[96px]" />
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-40 w-[84vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-2 border-[#FACC15] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
          <div className="absolute -left-1 -top-1 h-8 w-8 rounded-tl-[28px] border-l-4 border-t-4 border-white" />
          <div className="absolute -right-1 -top-1 h-8 w-8 rounded-tr-[28px] border-r-4 border-t-4 border-white" />
          <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-[28px] border-b-4 border-l-4 border-white" />
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-br-[28px] border-b-4 border-r-4 border-white" />
        </div>

        {!cameraReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55">
            <div className="rounded-3xl border border-white/10 bg-white/10 px-6 py-5 text-center text-white backdrop-blur">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#FACC15]" />
              <p className="text-sm font-semibold">Abrindo camera...</p>
            </div>
          </div>
        )}
      </div>

      <div className="z-10 flex flex-col gap-4 bg-black p-6 pb-10 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-sm font-semibold leading-relaxed">{feedback}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.24em] text-white/60">
            {processing ? "Analisando imagem..." : `Tentativas ${attempts}`}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void scanFrame()}
            disabled={!cameraReady || processing}
            className="flex-1 rounded-2xl bg-[#FACC15] px-4 py-3 font-bold text-[#1A1A1A] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              Tentar Agora
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFeedback("Certo, vamos tentar de novo. Aponte a camera para a placa.");
              scheduleNextScan(250);
            }}
            disabled={!cameraReady}
            className="rounded-2xl border border-white/15 px-4 py-3 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Continuar
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
