"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type ScannerModalProps = {
  onCodeScanned: (code: string) => void;
  onClose: () => void;
};

export function ScannerModal({ onCodeScanned, onClose }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerFrameRef = useRef<number | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const isDetectingRef = useRef(false);
  const [feedback, setFeedback] = useState("Aponte a câmera para o código de barras.");

  useEffect(() => {
    let isCancelled = false;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFeedback("Este navegador não suporta acesso à câmera.");
        return;
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      if (!BarcodeDetectorCtor) {
        setFeedback("Este dispositivo não suporta leitura de código pela câmera.");
        return;
      }

      try {
        const preferredFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"];
        const supportedFormats = typeof BarcodeDetectorCtor.getSupportedFormats === "function"
          ? await BarcodeDetectorCtor.getSupportedFormats()
          : preferredFormats;

        const formats = preferredFormats.filter((format) => supportedFormats.includes(format));
        barcodeDetectorRef.current = new BarcodeDetectorCtor({
          formats: formats.length > 0 ? formats : preferredFormats
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" }
          }
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        scannerStreamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          throw new Error("Elemento de vídeo não disponível.");
        }

        video.srcObject = stream;
        video.muted = true;
        video.setAttribute("playsinline", "true");
        await video.play();
        scanFrame();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao abrir a câmera.";
        if (/permission|denied|notallowed/i.test(message)) {
          setFeedback("Permissão da câmera negada.");
        } else {
          setFeedback("Não foi possível iniciar a câmera neste dispositivo.");
        }
      }
    }

    void startScanner();

    return () => {
      isCancelled = true;
      stopScanner();
    };
  }, []);

  function stopScanner() {
    if (scannerFrameRef.current !== null) {
      window.cancelAnimationFrame(scannerFrameRef.current);
      scannerFrameRef.current = null;
    }

    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    barcodeDetectorRef.current = null;
    isDetectingRef.current = false;
  }

  function scanFrame() {
    scannerFrameRef.current = window.requestAnimationFrame(scanFrame);

    const video = videoRef.current;
    const detector = barcodeDetectorRef.current;
    if (!video || !detector || isDetectingRef.current) {
      return;
    }

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    isDetectingRef.current = true;

    void detector.detect(video)
      .then((codes: any[]) => {
        const detectedValue = codes.find((code) => typeof code.rawValue === "string" && code.rawValue.trim().length > 0)?.rawValue;
        if (detectedValue) {
          stopScanner();
          onCodeScanned(detectedValue.trim());
        }
      })
      .catch(() => {
        // Keep scanner active even if a frame fails
      })
      .finally(() => {
        isDetectingRef.current = false;
      });
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex flex-shrink-0 items-center justify-between p-4 pt-8 text-white z-10 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="font-bold text-xl tracking-wide">Escanear Código</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-white/20 p-3 hover:bg-white/40 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
        />
        
        {/* Scanner overlay (viewfinder) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full border-[60px] md:border-[100px] border-black/50" />
        </div>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-[#FACC15] rounded-[30px] z-10 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-[30px] -m-1" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-[30px] -m-1" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-[30px] -m-1" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-[30px] -m-1" />
          
          <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.8)] -translate-y-1/2 animate-pulse" />
        </div>
      </div>

      <div className="flex-shrink-0 bg-black p-8 text-center pb-12 z-10">
        <p className="text-sm font-bold tracking-widest uppercase text-white/80">{feedback}</p>
      </div>
    </div>
  );
}
