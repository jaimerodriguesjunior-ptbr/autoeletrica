import type { Metadata } from "next";
import GarageIntro from "./garage-intro";
import GarageClosing from "./garage-closing";
import GarageCustomer from "./garage-customer";
import GarageFinale from "./garage-finale";
import ContactShortcut from "./contact-shortcut";
import "./landing.css";

export const metadata: Metadata = {
  title: "MB Garage | Sua oficina em movimento",
  description: "Uma forma simples de organizar a rotina da sua oficina.",
};

export default function LandingPage() {
  return (
    <main className="garage-landing"><GarageIntro /><GarageCustomer /><GarageClosing /><GarageFinale /><div className="garage-scroll-hint"><span aria-hidden="true">↕</span><span className="garage-scroll-hint__touch">Deslize para cima<br />ou para baixo</span><span className="garage-scroll-hint__mouse">Role para cima<br />ou para baixo</span></div><ContactShortcut /></main>
  );
}
