"use client";

import { useEffect, useRef, useState } from "react";

const part = (value: number, start: number, end: number) =>
  Math.max(0, Math.min(1, (value - start) / (end - start)));
const smooth = (value: number) => value * value * (3 - 2 * value);

export default function GarageIntro() {
  const storyRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (demoOpen && !dialog.open) dialog.showModal();
    if (!demoOpen && dialog.open) dialog.close();
  }, [demoOpen]);

  useEffect(() => {
    const story = storyRef.current;
    if (!story) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      const distance = Math.max(1, story.offsetHeight - window.innerHeight);
      // A última parte da rolagem mantém a cena da equipe em repouso para leitura.
      const progress = part(-story.getBoundingClientRect().top / distance, 0, 6 / 6.35);
      const journey = Math.min(1, progress / 0.72);
      const first = Math.min(1, journey / 0.55);
      const camera = smooth(part(first, 0.12, 0.48));
      const voiceCamera = smooth(part(journey, 0.63, 0.79));
      const firstExit = smooth(part(journey, 0.55, 0.65));
      const teamCamera = smooth(part(progress, 0.79, 0.9));
      const voiceExit = smooth(part(progress, 0.73, 0.81));
      const teamReveal = smooth(part(progress, 0.88, 0.95));
      const voiceReveal = smooth(part(journey, 0.75, 0.84)) * (1 - voiceExit);
      const reveal = smooth(part(first, 0.43, 0.57));
      story.style.setProperty("--camera", String(camera));
      story.style.setProperty("--voice-camera", String(voiceCamera));
      story.style.setProperty("--team-camera", String(teamCamera));
      story.style.setProperty("--team-opacity", String(teamReveal));
      story.style.setProperty("--intro-opacity", String(1 - smooth(part(first, 0.02, 0.18))));
      story.style.setProperty("--scene-shade", String(reveal));
      story.style.setProperty("--scene-opacity", String(reveal * (1 - firstExit)));
      story.style.setProperty("--voice-opacity", String(voiceReveal));
      story.style.setProperty("--speech-opacity", String(smooth(part(journey, 0.84, 0.93))));
      story.style.setProperty("--solution-opacity", String(smooth(part(journey, 0.91, 0.99))));
      story.style.setProperty("--vehicle-opacity", String(smooth(part(first, 0.53, 0.63))));
      story.style.setProperty("--client-opacity", String(smooth(part(first, 0.65, 0.75))));
      story.style.setProperty("--service-opacity", String(smooth(part(first, 0.77, 0.87))));
      const introduction = story.querySelector<HTMLElement>(".garage-copy");
      const scene = story.querySelector<HTMLElement>(".garage-scene-copy");
      const voice = story.querySelector<HTMLElement>(".garage-voice-copy");
      const team = story.querySelector<HTMLElement>(".garage-team");
      if (introduction) introduction.inert = !reducedMotion.matches && first > 0.24;
      if (scene) scene.inert = !reducedMotion.matches && (first < 0.43 || journey > 0.65);
      if (voice) voice.inert = !reducedMotion.matches && (journey < 0.75 || progress > 0.81);
      if (team) team.inert = !reducedMotion.matches && progress < 0.88;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goToScene = () => {
    const story = storyRef.current;
    if (!story) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.getElementById("primeiro-atendimento")?.scrollIntoView({ behavior: "auto" });
    } else {
      const distance = Math.max(0, story.offsetHeight - window.innerHeight);
      window.scrollTo({ top: story.offsetTop + distance * (6 / 6.35) * 0.35, behavior: "smooth" });
    }
  };

  return (
    <section className="garage-story" ref={storyRef} aria-label="Conheça o MB Garage">
      <div className="garage-hero">
        <div className="garage-hero__image" aria-hidden="true" />
        <div className="garage-hero__shade" aria-hidden="true" />

        <header className="garage-brand" aria-label="MB Garage, por Mente Binária">
          <span className="garage-brand__mark" aria-hidden="true">MB<span>.</span></span>
          <span className="garage-brand__name">GARAGE<small>POR MENTE BINÁRIA</small></span>
        </header>

        <div className="garage-copy">
          <p className="garage-eyebrow"><span /> FEITO PARA QUEM FAZ ACONTECER</p>
          <h1 id="garage-title"><span>Seu lugar é</span><span>na oficina.</span><em>O resto fica</em><em>mais simples.</em></h1>
          <span className="garage-rule" aria-hidden="true" />
          <p className="garage-description">Uma foto, uma conversa, um toque.<br />Sua oficina organizada enquanto você trabalha.</p>
          <button type="button" className="garage-cta" onClick={goToScene}>
            <span>Conheça o MB Garage</span><span className="garage-cta__arrow" aria-hidden="true">↓</span>
          </button>
        </div>

        <div className="garage-scene-copy" id="primeiro-atendimento">
          <p className="garage-scene-copy__label"><span /> O COMEÇO DE UM ATENDIMENTO</p>
          <h2>Uma foto.<br /><em>O veículo identificado.</em></h2>
          <p className="garage-scene-copy__description">Encontre o cliente e comece o atendimento em poucos passos.</p>
          <div className="garage-steps" aria-label="Etapas do atendimento">
            <div className="garage-step garage-step--vehicle"><span className="garage-step__icon">✓</span><span><small>PLACA RECONHECIDA</small><strong>Veículo identificado</strong></span></div>
            <div className="garage-step garage-step--client"><span className="garage-step__icon">02</span><span><small>ESCOLHA O CLIENTE</small><strong>Encontre ou cadastre</strong></span></div>
            <div className="garage-step garage-step--service"><span className="garage-step__icon">03</span><span><small>TUDO PRONTO PARA COMEÇAR</small><strong>Inicie o atendimento</strong></span></div>
          </div>
        </div>

        <div className="garage-voice-copy">
          <p className="garage-scene-copy__label"><span /> O TRABALHO VIRA REGISTRO</p>
          <h2>Você fala.<br /><em>O serviço fica registrado.</em></h2>
          <p className="garage-scene-copy__description">Registre o problema e o serviço previsto sem precisar parar para digitar.</p>
          <div className="garage-speech-list" aria-label="Exemplos de registros por voz na ordem de serviço">
            <div className="garage-speech">
              <div className="garage-speech__header"><span className="garage-speech__mic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-3 0h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span><span>DEFEITOS CONSTATADOS</span><span className="garage-speech__dots" aria-hidden="true">•••</span></div>
              <p>“Bateria descarregada.”</p>
            </div>
            <div className="garage-speech garage-speech--solution">
              <div className="garage-speech__header"><span className="garage-speech__mic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-3 0h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span><span>SERVIÇOS A SEREM EXECUTADOS</span><span className="garage-speech__dots" aria-hidden="true">•••</span></div>
              <p>“Substituir a bateria.”</p>
            </div>
            <span className="garage-speech__caption">Exemplos de registros na ordem de serviço</span>
          </div>
          <button className="garage-demo-link" type="button" onClick={() => setDemoOpen(true)}><span aria-hidden="true">▶</span> Veja na tela do sistema</button>
        </div>

        <div className="garage-team">
          <div className="garage-team__person garage-team__person--first"><span>CARLOS</span><strong>50%</strong><small>PARTICIPAÇÃO</small></div>
          <div className="garage-team__person garage-team__person--second"><span>RAFAEL</span><strong>50%</strong><small>PARTICIPAÇÃO</small></div>
          <div className="garage-team__copy">
            <p className="garage-scene-copy__label"><span /> TRABALHO EM EQUIPE</p>
            <h2>Cada serviço<br /><em>tem sua equipe.</em></h2>
            <p>O trabalho de cada profissional fica registrado, com a comissão configurada para cada um.</p>
            <small>Exemplo ilustrativo com dois participantes.</small>
          </div>
        </div>

        <div className="garage-bottom" aria-hidden="true"><span className="garage-bottom__line" /><span>MENOS BUROCRACIA. MAIS OFICINA.</span><span className="garage-bottom__number">01 / 03</span></div>
      </div>
      <dialog ref={dialogRef} className="garage-demo-dialog" onClose={() => setDemoOpen(false)} aria-labelledby="garage-demo-title">
        <div className="garage-demo-dialog__header"><div><span>MB GARAGE</span><h2 id="garage-demo-title">O laudo na tela da OS</h2></div><button type="button" onClick={() => setDemoOpen(false)} aria-label="Fechar demonstração">✕</button></div>
        {demoOpen && <video className="garage-demo-dialog__video" controls autoPlay playsInline preload="metadata" src="/landingpage/demonstracao-laudo-os.mp4">Seu navegador não suporta vídeo.</video>}
        <p>Exemplo ilustrativo de preenchimento dos campos do laudo.</p>
      </dialog>
    </section>
  );
}
