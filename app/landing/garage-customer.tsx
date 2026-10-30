"use client";

import { useEffect, useRef } from "react";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const v = clamp(n); return v * v * (3 - 2 * v); };
const framePath = (n: number) => `/landingpage/cliente-frames/frame-${String(n).padStart(3, "0")}.webp`;

export default function GarageCustomer() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const image = imageRef.current;
    if (!section || !image) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 1;
    let observer: IntersectionObserver | undefined;
    const preload = () => {
      for (let i = 1; i <= 60; i++) { const img = new Image(); img.decoding = "async"; img.src = framePath(i); }
      observer?.disconnect();
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) preload(); }, { rootMargin: "100% 0px" });
      observer.observe(section);
    } else preload();
    const update = () => {
      frame = 0;
      const distance = Math.max(1, section.offsetHeight - window.innerHeight);
      const p = clamp(-section.getBoundingClientRect().top / distance);
      const current = Math.round(1 + 18 * ease(p / 0.18) + 25 * ease((p - 0.48) / 0.22));
      if (previous !== current) { image.src = framePath(current); previous = current; }
      const first = ease((p - 0.10) / 0.12) * (1 - ease((p - 0.44) / 0.1));
      const second = ease((p - 0.65) / 0.12);
      section.style.setProperty("--customer-first", String(first));
      section.style.setProperty("--customer-second", String(second));
      section.querySelectorAll<HTMLElement>(".garage-customer__copy").forEach((element, i) => { element.inert = !reduced.matches && (i === 0 ? first : second) < 0.05; });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => { observer?.disconnect(); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); reduced.removeEventListener("change", schedule); if (frame) cancelAnimationFrame(frame); };
  }, []);

  return (
    <section className="garage-customer" ref={sectionRef} aria-label="Acompanhamento e aprovação pelo cliente">
      <div className="garage-customer__stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imageRef} className="garage-customer__frame" src={framePath(1)} alt="Cliente em casa acompanhando o atendimento pelo celular." />
        <div className="garage-customer__shade" aria-hidden="true" />
        <div className="garage-office__brand" aria-label="MB Garage"><b>MB<span>.</span></b><span>GARAGE <small>/ PORTAL DO CLIENTE</small></span></div>
        <div className="garage-customer__copy garage-customer__copy--first">
          <p className="garage-office__label"><span /> MAIS TRANQUILIDADE PARA O CLIENTE</p>
          <h2>Seu cliente acompanha<br /><em>de onde estiver.</em></h2>
          <p>O andamento, as fotos e o orçamento ficam disponíveis pelo celular.</p>
          <div className="garage-customer__card" aria-label="Exemplo ilustrativo do portal do cliente">
            <div className="garage-customer__card-label">PORTAL DO CLIENTE <span>EXEMPLO</span></div>
            <strong>Seu atendimento</strong>
            <div className="garage-customer__status"><span /> Aguardando aprovação</div>
            <div className="garage-customer__card-row"><span>Orçamento</span><span>Fotos do serviço</span></div>
          </div>
        </div>
        <div className="garage-customer__copy garage-customer__copy--second">
          <p className="garage-office__label"><span /> APROVAÇÃO PELO CELULAR</p>
          <h2>Aprovado.<br /><em>A oficina já pode seguir.</em></h2>
          <p>O cliente confere o orçamento e aprova pelo link de acompanhamento.</p>
          <div className="garage-customer__confirmation"><span>✓</span><div><small>EXEMPLO DE CONFIRMAÇÃO</small><strong>Orçamento aprovado</strong></div></div>
        </div>
        <div className="garage-office__bottom" aria-hidden="true"><span>MAIS CLAREZA PARA TODO MUNDO.</span><span>02 / 03</span></div>
      </div>
    </section>
  );
}
