"use client";

import { useEffect, useRef } from "react";

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const n = clamp(v); return n * n * (3 - 2 * n); };
const framePath = (n: number) => `/landingpage/fechamento-frames/frame-${String(n).padStart(3, "0")}.webp`;

export default function GarageClosing() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    if (!section || !image) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation = 0;
    let previousFrame = 1;
    let observer: IntersectionObserver | undefined;
    const preload = () => {
      for (let i = 1; i <= 65; i++) { const frame = new Image(); frame.decoding = "async"; frame.src = framePath(i); }
      observer?.disconnect();
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) preload(); }, { rootMargin: "100% 0px" });
      observer.observe(section);
    } else preload();

    const update = () => {
      animation = 0;
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = clamp(-section.getBoundingClientRect().top / distance);
      const firstMovement = ease(progress / 0.18);
      const secondMovement = ease((progress - 0.48) / 0.23);
      const selected = Math.round(1 + 18 * firstMovement + 30 * secondMovement);
      if (selected !== previousFrame) { image.src = framePath(selected); previousFrame = selected; }
      const first = ease((progress - 0.12) / 0.09) * (1 - ease((progress - 0.43) / 0.09));
      const second = ease((progress - 0.65) / 0.1);
      section.style.setProperty("--closing-first", String(first));
      section.style.setProperty("--closing-second", String(second));
      section.querySelectorAll<HTMLElement>(".garage-closing__copy").forEach((node, i) => { node.inert = !reduced.matches && (i === 0 ? first : second) < 0.05; });
    };
    const schedule = () => { if (!animation) animation = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => { observer?.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); reduced.removeEventListener("change", schedule); if (animation) cancelAnimationFrame(animation); };
  }, []);

  return (
    <section className="garage-closing" ref={sectionRef} aria-label="Fechamento do atendimento e emissão de notas">
      <div className="garage-closing__stage">
        {/* Frames do vídeo permitem pausar e percorrer a cena nos dois sentidos. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imageRef} className="garage-closing__frame" src={framePath(1)} alt="Mecânico e cliente no balcão da oficina; depois, o mecânico usa o computador." />
        <div className="garage-closing__shade" aria-hidden="true" />
        <div className="garage-office__brand" aria-label="MB Garage"><b>MB<span>.</span></b><span>GARAGE <small>/ ATENDIMENTO CONCLUÍDO</small></span></div>
        <div className="garage-closing__copy garage-closing__copy--first">
          <p className="garage-office__label"><span /> ATENDIMENTO CONCLUÍDO</p>
          <h2>Serviço concluído.<br /><em>Tudo organizado.</em></h2>
          <p>Peças, serviços e pagamento registrados junto com o atendimento.</p>
        </div>
        <div className="garage-closing__copy garage-closing__copy--second">
          <p className="garage-office__label"><span /> NOTAS FISCAIS</p>
          <h2>Peças e serviços.<br /><em>As notas no mesmo lugar.</em></h2>
          <p>Revise os dados e encaminhe as notas de produtos e serviços na mesma tela.</p>
          <div className="garage-closing__documents" aria-label="Exemplo ilustrativo: emissão de nota de produtos e de serviços">
            <span className="garage-closing__button">Emitir nota <b>↗</b></span>
            <span className="garage-closing__document">PRODUTOS <b>NFC-e</b></span>
            <span className="garage-closing__document">SERVIÇOS <b>NFS-e</b></span>
          </div>
        </div>
        <div className="garage-office__bottom" aria-hidden="true"><span>UMA OFICINA. MAIS SIMPLICIDADE.</span><span>03 / 03</span></div>
      </div>
    </section>
  );
}
