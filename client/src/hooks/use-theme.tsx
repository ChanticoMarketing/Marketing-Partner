import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";
type ColorScheme = "brand" | "blue" | "green" | "purple" | "red" | "amber";
type FontSize = "small" | "medium" | "large";

interface ThemeOptions {
  theme: Theme;
  colorScheme: ColorScheme;
  fontSize: FontSize;
  reducedAnimations: boolean;
  highContrastMode: boolean;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  fontSize: FontSize;
  reducedAnimations: boolean;
  highContrastMode: boolean;
  setTheme: (theme: Theme) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setFontSize: (fontSize: FontSize) => void;
  setReducedAnimations: (reducedAnimations: boolean) => void;
  setHighContrastMode: (highContrastMode: boolean) => void;
  updateAllThemeOptions: (options: Partial<ThemeOptions>) => void;
}

const initialState: ThemeContextType = {
  theme: "system",
  colorScheme: "brand",
  fontSize: "medium",
  reducedAnimations: false,
  highContrastMode: false,
  setTheme: () => null,
  setColorScheme: () => null,
  setFontSize: () => null,
  setReducedAnimations: () => null,
  setHighContrastMode: () => null,
  updateAllThemeOptions: () => null,
};

const ThemeContext = createContext<ThemeContextType>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  ...props
}: ThemeProviderProps) {
  // Recuperar todas las configuraciones del localStorage o usar valores predeterminados
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(`${storageKey}-theme`) as Theme) || defaultTheme
  );

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(
    () => {
      const stored = localStorage.getItem(`${storageKey}-colorScheme`) as ColorScheme;
      // Force migration to brand if blue or undefined
      if (!stored || stored === "blue") return "brand";
      return stored;
    }
  );

  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem(`${storageKey}-fontSize`) as FontSize) || "medium"
  );

  const [reducedAnimations, setReducedAnimationsState] = useState<boolean>(
    () => localStorage.getItem(`${storageKey}-reducedAnimations`) === "true"
  );

  const [highContrastMode, setHighContrastModeState] = useState<boolean>(
    () => localStorage.getItem(`${storageKey}-highContrastMode`) === "true"
  );

  // Aplicar tema claro/oscuro
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);

      // Añadir listener para cambios en preferencia del sistema
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        root.classList.remove("light", "dark");
        root.classList.add(e.matches ? "dark" : "light");
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    root.classList.add(theme);
  }, [theme]);

  // Aplicar esquema de color
  useEffect(() => {
    const root = window.document.documentElement;

    // Eliminar clases de esquemas de color anteriores
    root.classList.remove("color-amber", "color-blue", "color-green", "color-purple", "color-red", "color-brand");

    // Aplicar el nuevo esquema de color
    root.classList.add(`color-${colorScheme}`);

    // Actualizar variables CSS para el esquema de color
    if (colorScheme === "brand") {
      document.documentElement.style.setProperty('--primary', '184 100% 50%'); // Neon Cyan
    } else if (colorScheme === "amber") {
      document.documentElement.style.setProperty('--primary', '184 100% 50%'); // Neon Cyan Fallback
    } else if (colorScheme === "blue") {
      document.documentElement.style.setProperty('--primary', '184 100% 50%'); // Neon Cyan Fallback
    } else if (colorScheme === "green") {
      document.documentElement.style.setProperty('--primary', '162 47% 50%'); // Muted Sage
    } else if (colorScheme === "purple") {
      document.documentElement.style.setProperty('--primary', '255 45% 60%'); // Muted Lavender
    } else if (colorScheme === "red") {
      document.documentElement.style.setProperty('--primary', '0 50% 60%'); // Muted Coral
    }
  }, [colorScheme]);

  // Aplicar tamaño de fuente
  useEffect(() => {
    const root = window.document.documentElement;

    // Eliminar clases de tamaño de fuente anteriores
    root.classList.remove("text-small", "text-medium", "text-large");

    // Aplicar el nuevo tamaño de fuente
    root.classList.add(`text-${fontSize}`);

    // Establecer la propiedad CSS directamente para el tamaño de fuente base
    if (fontSize === "small") {
      document.documentElement.style.fontSize = "14px";
    } else if (fontSize === "medium") {
      document.documentElement.style.fontSize = "16px";
    } else if (fontSize === "large") {
      document.documentElement.style.fontSize = "18px";
    }
  }, [fontSize]);

  // Aplicar modo de animaciones reducidas
  useEffect(() => {
    const root = window.document.documentElement;

    if (reducedAnimations) {
      root.classList.add("reduced-animations");
    } else {
      root.classList.remove("reduced-animations");
    }
  }, [reducedAnimations]);

  // Aplicar modo de alto contraste
  useEffect(() => {
    const root = window.document.documentElement;

    if (highContrastMode) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
  }, [highContrastMode]);

  // Métodos para actualizar cada configuración
  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(`${storageKey}-theme`, newTheme);
    setThemeState(newTheme);
  };

  const setColorScheme = (newColorScheme: ColorScheme) => {
    localStorage.setItem(`${storageKey}-colorScheme`, newColorScheme);
    setColorSchemeState(newColorScheme);
  };

  const setFontSize = (newFontSize: FontSize) => {
    localStorage.setItem(`${storageKey}-fontSize`, newFontSize);
    setFontSizeState(newFontSize);
  };

  const setReducedAnimations = (newReducedAnimations: boolean) => {
    localStorage.setItem(`${storageKey}-reducedAnimations`, String(newReducedAnimations));
    setReducedAnimationsState(newReducedAnimations);
  };

  const setHighContrastMode = (newHighContrastMode: boolean) => {
    localStorage.setItem(`${storageKey}-highContrastMode`, String(newHighContrastMode));
    setHighContrastModeState(newHighContrastMode);
  };

  // Método para actualizar múltiples opciones de una vez
  const updateAllThemeOptions = (options: Partial<ThemeOptions>) => {
    if (options.theme) setTheme(options.theme);
    if (options.colorScheme) setColorScheme(options.colorScheme);
    if (options.fontSize) setFontSize(options.fontSize);
    if (options.reducedAnimations !== undefined) setReducedAnimations(options.reducedAnimations);
    if (options.highContrastMode !== undefined) setHighContrastMode(options.highContrastMode);
  };

  const value = {
    theme,
    colorScheme,
    fontSize,
    reducedAnimations,
    highContrastMode,
    setTheme,
    setColorScheme,
    setFontSize,
    setReducedAnimations,
    setHighContrastMode,
    updateAllThemeOptions,
  };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined)
    throw new Error("useTheme debe usarse dentro de un ThemeProvider");

  return context;
};