"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Mail, MessageCircle, Send } from "lucide-react";

const benefits = [
  { title: "Feito para a rotina da oficina", description: "Atendimentos, peças, serviços e clientes organizados para acompanhar o dia a dia." },
  { title: "Menos tempo digitando", description: "Identifique o veículo pela foto da placa e registre informações usando a voz." },
  { title: "Mais clareza para o cliente", description: "Compartilhe o acompanhamento, as fotos e o orçamento pelo celular." },
  { title: "Controle em um só lugar", description: "Acompanhe o financeiro e encaminhe as notas de produtos e serviços pela mesma tela." },
];

const testimonials = [
  { name: "Norberto Tajiri", role: "Proprietário da NHT Centro Automotivo, Guaíra", quote: "Diferente de outros programas, o MB Garage é extremamente estável. E se surge qualquer dúvida, o suporte é imediato. Estou muito satisfeito com a confiança que o sistema passa." },
  { name: "Paulinho", role: "Proprietário da Rally Auto-Center, Guaíra", quote: "O Portal do Cliente resolveu minha maior dor de cabeça: a garantia de peças de terceiros. Agora eu envio o link pelo WhatsApp e o cliente autoriza tudo pelo portal, sendo informado juridicamente no ato. Isso nos traz uma tranquilidade enorme." },
  { name: "Delson Kabroski", role: "Proprietário da Dom Centro Automotivo, Toledo", quote: "Acredito que este seja o melhor sistema de gestão de oficinas da nossa região. Conseguiram unir simplicidade com ferramentas poderosas. É o equilíbrio perfeito para o dia a dia." },
];

export default function GarageFinale() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = section.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    elements.forEach((element) => { element.classList.add("is-ready"); observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="garage-finale" id="contato" aria-labelledby="garage-finale-title">
      <div className="garage-finale__inner">
        <p className="garage-finale__eyebrow" data-reveal><span /> POR QUE MB GARAGE?</p>
        <div className="garage-finale__intro" data-reveal>
          <h2 id="garage-finale-title">Sua oficina tem seu jeito.<br /><em>A organização pode ser simples.</em></h2>
          <p>Cada oficina tem sua rotina. O MB Garage ajuda você a acompanhar o que acontece, sem tirar seu foco do trabalho.</p>
        </div>
        <div className="garage-finale__benefits">
          {benefits.map((benefit, index) => (
            <article className="garage-finale__benefit" data-reveal key={benefit.title}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h3>{benefit.title}</h3><p>{benefit.description}</p></div>
            </article>
          ))}
        </div>
        <p className="garage-finale__statement" data-reveal>Seu lugar é na oficina.<br /><em>O MB Garage ajuda a cuidar do resto.</em></p>
        <section className="garage-testimonials" aria-labelledby="garage-testimonials-title">
          <p className="garage-finale__eyebrow" data-reveal><span /> QUEM USA NO DIA A DIA</p>
          <h2 id="garage-testimonials-title" data-reveal>A experiência de quem<br /><em>vive a oficina.</em></h2>
          <div className="garage-testimonials__grid">
            {testimonials.map((testimonial) => (
              <figure className="garage-testimonial" data-reveal key={testimonial.name}>
                <span className="garage-testimonial__mark" aria-hidden="true">“</span>
                <blockquote>{testimonial.quote}</blockquote>
                <figcaption><strong>{testimonial.name}</strong><span>{testimonial.role}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>
        <div className="garage-finale__contact" data-reveal>
          <div className="garage-finale__invitation"><p className="garage-finale__eyebrow"><span /> UM CONVITE PARA COMEÇAR</p><h2>Vamos conversar?</h2><p>Conheça o MB Garage e descubra como ele pode ajudar na rotina da sua oficina.</p><div className="garage-finale__trial"><h3>1 mês grátis</h3><p>Teste o MB Garage por 1 mês, com possibilidade de prorrogação por mais 1 mês.</p></div></div>
          <nav className="garage-finale__links" aria-label="Canais de contato">
            <a href="https://wa.me/5544999261487" target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /><span><strong>WhatsApp</strong><small>(44) 99926-1487</small></span><ArrowUpRight aria-hidden="true" /></a>
            <a href="https://t.me/+5544999261487" target="_blank" rel="noopener noreferrer"><Send aria-hidden="true" /><span><strong>Telegram</strong><small>(44) 99926-1487</small></span><ArrowUpRight aria-hidden="true" /></a>
            <a href="mailto:mentebinariasoldig@gmail.com"><Mail aria-hidden="true" /><span><strong>E-mail</strong><small>mentebinariasoldig@gmail.com</small></span><ArrowUpRight aria-hidden="true" /></a>
          </nav>
        </div>
        <footer className="garage-finale__footer" data-reveal><div className="garage-finale__brand"><b>MB<span>.</span></b><span>GARAGE<small>POR MENTE BINÁRIA</small></span></div><div><p>MB Garage é uma solução da Mente Binária</p><p>MENTE BINÁRIA SOLUÇÕES DIGITAIS LTDA - ME · CNPJ: 65.667.543/0001-02</p></div></footer>
      </div>
    </section>
  );
}
