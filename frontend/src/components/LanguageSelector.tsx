"use client";

import { useState, useEffect } from "react";
import { Languages } from "lucide-react";
import { Language, getCurrentLanguage, setCurrentLanguage } from "@/lib/i18n";

interface LanguageSelectorProps {
  onLanguageChange?: (lang: Language) => void;
}

export function LanguageSelector({ onLanguageChange }: LanguageSelectorProps) {
  const [currentLang, setCurrentLang] = useState<Language>('es');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const lang = getCurrentLanguage();
    setCurrentLang(lang);
  }, []);

  const toggleLanguage = () => {
    const newLang: Language = currentLang === 'es' ? 'en' : 'es';
    setCurrentLang(newLang);
    setCurrentLanguage(newLang);
    onLanguageChange?.(newLang);

    // Reload page to apply language changes
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          if (currentLang !== 'es') {
            setCurrentLanguage('es');
            setCurrentLang('es');
            window.location.reload();
          }
        }}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${currentLang === 'es'
          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/50'
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
          }`}
      >
        <span className="text-xl">🇪🇸</span>
        <div className="text-left">
          <div className="font-bold text-sm">Español</div>
          <div className="text-[10px] opacity-70">Idioma nativo</div>
        </div>
        {currentLang === 'es' && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
      </button>

      <button
        onClick={() => {
          if (currentLang !== 'en') {
            setCurrentLanguage('en');
            setCurrentLang('en');
            window.location.reload();
          }
        }}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${currentLang === 'en'
          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/50'
          : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
          }`}
      >
        <span className="text-xl">🇺🇸</span>
        <div className="text-left">
          <div className="font-bold text-sm">English</div>
          <div className="text-[10px] opacity-70">International</div>
        </div>
        {currentLang === 'en' && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
      </button>
    </div>
  );
}
