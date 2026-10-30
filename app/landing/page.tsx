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
    <main className="garage-landing"><GarageIntro /><GarageCustomer /><GarageClosing /><GarageFinale /><ContactShortcut /></main>
  );
}
