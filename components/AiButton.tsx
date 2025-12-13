import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AiButton() {
  return (
    <Link
      href="https://gemini.google.com/gem/1K76TU5NY4zOMpSVjOTRhizygEv6OHnX0?usp=sharing"
      target="_blank"
      className="fixed bottom-24 md:bottom-8 right-6 z-50 flex items-center gap-2 bg-[#1A1A1A] text-[#FACC15] px-5 py-3 rounded-full shadow-xl hover:scale-105 hover:shadow-2xl transition-all border border-[#FACC15]/20 font-bold text-sm group"
      title="Tirar dúvidas sobre como usar o programa. Converse com a IA para obter ajuda."
    >
      <Sparkles size={20} className="group-hover:animate-pulse" />
      <span className="hidden md:inline">Tutorial IA</span>
      <span className="md:hidden">IA</span>
    </Link>
  );
}