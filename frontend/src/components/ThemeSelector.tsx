"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Gamepad2,
  Minus,
  Cpu,
  Heart,
  Terminal,
  Search,
  Crown,
  Sparkles,
  Ruler,
  Palette,
  ChevronDown,
} from "lucide-react";

export type ThemeId =
  | "executive"
  | "blueprint"
  | "iron-man"
  | "kawai"
  | "cyborg"
  | "matrix"
  | "gamer-rgb"
  | "corporativo-vip"
  | "criminologia"
  | "blanco-simple";

interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  icon: React.ReactNode;
  preview: {
    bg: string;
    primary: string;
    accent: string;
  };
}

const themes: Theme[] = [
  {
    id: "executive",
    name: "EXECUTIVE",
    description: "Tema Predeterminado Dorado VIP",
    icon: <Crown className="h-4 w-4" />,
    preview: {
      bg: "#000000",
      primary: "#FFD700",
      accent: "#FFB300",
    },
  },
  {
    id: "blueprint",
    name: "BLUEPRINT",
    description: "Blueprint Técnico Profesional",
    icon: <Ruler className="h-4 w-4" />,
    preview: {
      bg: "#1e3a5f",
      primary: "#4A90E2",
      accent: "#FFFFFF",
    },
  },
  {
    id: "iron-man",
    name: "IRON MAN",
    description: "Rojo Dorado Tecnológico Stark",
    icon: <Briefcase className="h-4 w-4" />,
    preview: {
      bg: "#141414",
      primary: "#FF0000",
      accent: "#FFD700",
    },
  },
  {
    id: "kawai",
    name: "KAWAI",
    description: "Rosa Pastel Brillante",
    icon: <Heart className="h-4 w-4" />,
    preview: {
      bg: "#FFF0F5",
      primary: "#FF1493",
      accent: "#FFB6C1",
    },
  },
  {
    id: "cyborg",
    name: "CYBORG",
    description: "Cyan Neon Futurista",
    icon: <Cpu className="h-4 w-4" />,
    preview: {
      bg: "#0a0a0a",
      primary: "#00FFFF",
      accent: "#FF00FF",
    },
  },
  {
    id: "matrix",
    name: "MATRIX",
    description: "Terminal Verde Matrix",
    icon: <Terminal className="h-4 w-4" />,
    preview: {
      bg: "#0d1f0d",
      primary: "#00FF41",
      accent: "#00FF00",
    },
  },
  {
    id: "gamer-rgb",
    name: "GAMER RGB",
    description: "Gaming RGB Multicolor",
    icon: <Gamepad2 className="h-4 w-4" />,
    preview: {
      bg: "#0a0a0a",
      primary: "#00FF00",
      accent: "#FF00FF",
    },
  },
  {
    id: "corporativo-vip",
    name: "CORPORATIVO VIP",
    description: "Azul Premium Ejecutivo",
    icon: <Briefcase className="h-4 w-4" />,
    preview: {
      bg: "#1a2332",
      primary: "#0077CC",
      accent: "#0055AA",
    },
  },
  {
    id: "criminologia",
    name: "CRIMINOLOGIA",
    description: "Forense Detective Noir",
    icon: <Search className="h-4 w-4" />,
    preview: {
      bg: "#F5F5DC",
      primary: "#556B2F",
      accent: "#8B4513",
    },
  },
  {
    id: "blanco-simple",
    name: "BLANCO SIMPLE",
    description: "Minimalista Blanco Puro",
    icon: <Minus className="h-4 w-4" />,
    preview: {
      bg: "#FFFFFF",
      primary: "#000000",
      accent: "#333333",
    },
  },
];

interface ThemeSelectorProps {
  onThemeChange?: (theme: ThemeId) => void;
}

export function ThemeSelector({ onThemeChange }: ThemeSelectorProps) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("executive");
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved theme
    const saved = localStorage.getItem("nexo-theme") as ThemeId;
    if (saved && themes.find(t => t.id === saved)) {
      setCurrentTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme("executive");
    }
  }, []);

  const applyTheme = (themeId: ThemeId) => {
    document.documentElement.setAttribute("data-theme", themeId);
    // Force re-render of CSS variables
    document.body.style.backgroundColor = "";
    document.body.offsetHeight; // Trigger reflow
  };

  const handleThemeChange = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem("nexo-theme", themeId);
    setIsOpen(false);
    onThemeChange?.(themeId);
  };

  const currentThemeData = themes.find(t => t.id === currentTheme);

  if (!mounted) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {themes.map((theme) => (
        <button
          key={theme.id}
          onClick={() => handleThemeChange(theme.id)}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border-2 transition-all duration-200 text-left relative overflow-hidden group",
            currentTheme === theme.id
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          {/* Background Highlight on Active */}
          {currentTheme === theme.id && (
            <div className="absolute top-0 right-0 p-1.5 bg-primary rounded-bl-xl text-primary-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </div>
          )}

          {/* Preview Colors */}
          <div className="flex gap-1.5 mb-3 p-1.5 rounded-full bg-muted/50 border border-border/50 self-start">
            <div
              className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
              style={{ backgroundColor: theme.preview.bg }}
              title="Fondo"
            />
            <div
              className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
              style={{ backgroundColor: theme.preview.primary }}
              title="Primario"
            />
            <div
              className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
              style={{ backgroundColor: theme.preview.accent }}
              title="Acento"
            />
          </div>

          {/* Theme Info */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn("p-1.5 rounded-md", currentTheme === theme.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              {theme.icon}
            </span>
            <span
              className="font-bold text-sm tracking-tight"
            >
              {theme.name}
            </span>
          </div>
          <span
            className="text-[10px] text-muted-foreground pl-1"
          >
            {theme.description}
          </span>
        </button>
      ))}
    </div>
  );
}
