"use client";

import { useEffect, useRef, useState } from "react";

export default function ContactShortcut() {
  const [open, setOpen] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const contacts = document.querySelector(".garage-finale__contact");
    if (!contacts || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setContactsVisible(entry.intersectionRatio >= 0.5), { threshold: 0.5 });
    observer.observe(contacts);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  if (contactsVisible && !open) return null;

  return (
    <div className="garage-contact-shortcut" ref={containerRef}>
      {open && <nav className="garage-contact-shortcut__panel" id="garage-contact-options" aria-label="Escolha um canal de contato">
        <p>Vamos conversar?</p>
        <a href="https://wa.me/5544999261487" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span>WhatsApp</span><span aria-hidden="true">↗</span></a>
        <a href="https://t.me/+5544999261487" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}><span>Telegram</span><span aria-hidden="true">↗</span></a>
        <a href="mailto:mentebinariasoldig@gmail.com" onClick={() => setOpen(false)}><span>E-mail</span><span aria-hidden="true">↗</span></a>
      </nav>}
      <button className="garage-contact-shortcut__button" ref={buttonRef} type="button" aria-expanded={open} aria-controls="garage-contact-options" onClick={() => setOpen((value) => !value)}>
        <span>Fale com a gente</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
