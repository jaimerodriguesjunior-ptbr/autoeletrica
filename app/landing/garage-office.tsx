"use client";

import { useEffect, useRef } from "react";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const n = clamp(v); return n * n * (3 - 2 * n); };

const scenes = [
  { label: "VENDA DIRETA", title: "Uma venda rápida.", highlight: "Tudo registrado.", description: "Venda peças no balcão sem precisar abrir uma ordem de serviço para um veículo." },
  { label: "SERVIÇO DE BANCADA", title: "Chegou uma peça?", highlight: "O serviço também tem lugar.", description: "Organize serviços avulsos, mesmo quando não há um veículo na oficina." },
  { label: "ESTOQUE E COMPRAS", title: "A mercadoria chega.", highlight: "O estoque acompanha.", description: "Importe o XML da nota, confira os itens e registre a entrada no estoque." },
  { label: "GESTÃO FINANCEIRA", title: "Sua oficina em dia.", highlight: "Seus números também.", description: "Acompanhe entradas, despesas e o resultado da oficina em um só lugar." },
  { label: "NOTAS FISCAIS", title: "Peças e serviços.", highlight: "As notas no mesmo lugar.", description: "A partir da ordem de serviço, revise os dados e encaminhe as notas de produtos e serviços na mesma tela." },
];

export default function GarageOffice() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = clamp(-section.getBoundingClientRect().top / distance);
      const position = Math.min(progress * scenes.length, scenes.length - 0.0001);
      const index = Math.floor(position);
      const within = position - index;
      const targets = [0.02, 0.34, 0.66, 0.98, 0.98];
      const next = Math.min(index + 1, scenes.length - 1);
      const pan = smooth((within - 0.82) / 0.18);
      const camera = targets[index] + (targets[next] - targets[index]) * pan;
      const zoomIn = smooth(within / 0.18);
      const zoomOut = index === scenes.length - 1 ? 0 : smooth((within - 0.68) / 0.18);
      const zoom = 1 + 0.34 * Math.max(0, zoomIn - zoomOut);
      section.style.setProperty("--office-camera", String(camera));
      section.style.setProperty("--office-zoom", String(zoom));
      section.style.setProperty("--office-entry", String(smooth(progress / 0.04)));
      const visibility = scenes.map((_, i) => {
        const local = progress * scenes.length - i;
        const enter = smooth((local - 0.12) / 0.16);
        const exit = i === scenes.length - 1 ? 0 : smooth((local - 0.62) / 0.12);
        return enter * (1 - exit);
      });
      section.querySelectorAll<HTMLElement>(".garage-office__scene").forEach((node, i) => {
        const visible = visibility[i];
        node.style.setProperty("--visible", String(visible));
        node.inert = !reduced.matches && visible < 0.05;
      });
      section.style.setProperty("--office-right-shade", String(Math.max(visibility[0], visibility[1])));
      section.style.setProperty("--office-left-shade", String(Math.max(visibility[2], visibility[3], visibility[4])));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="garage-office" aria-label="A rotina do escritório e do balcão">
      <div className="garage-office__stage">
        <div className="garage-office__photo" aria-hidden="true" />
        <div className="garage-office__shade" aria-hidden="true" />
        <div className="garage-office__brand" aria-hidden="true"><b>MB<span>.</span></b><span>GARAGE <small>/ A OFICINA EM MOVIMENTO</small></span></div>
        {scenes.map((scene, i) => (
          <div className={`garage-office__scene garage-office__scene--${i}`} key={scene.label}>
            <p className="garage-office__label"><span /> {scene.label}</p>
            <h2>{scene.title}<br /><em>{scene.highlight}</em></h2>
            <p className="garage-office__description">{scene.description}</p>
            {i === 4 && <div className="garage-office__documents"><span>PRODUTOS <b>NFC-e</b></span><span>SERVIÇOS <b>NFS-e</b></span></div>}
          </div>
        ))}
        <div className="garage-office__bottom" aria-hidden="true"><span>UMA OFICINA. MAIS SIMPLICIDADE.</span><span>02 / 02</span></div>
      </div>
    </section>
  );
}
