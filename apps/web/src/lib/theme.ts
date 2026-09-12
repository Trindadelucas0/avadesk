export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "avadesk-theme";
export const DEFAULT_THEME: Theme = "light";

/** Cor da barra do navegador/PWA por tema (`meta[name="theme-color"]`). */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#f5f7fa",
  dark: "#07090d",
};

export const THEME_LABEL: Record<Theme, string> = {
  light: "Claro",
  dark: "Escuro",
};

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* modo privado / storage bloqueado: tema vale só nesta sessão */
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Roda antes do primeiro paint para evitar flash do tema errado.
 * Mantido como string porque é injetado inline no documento.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem("${THEME_STORAGE_KEY}");var t=v==="dark"||v==="light"?v:"${DEFAULT_THEME}";var r=document.documentElement;r.setAttribute("data-theme",t);if(t==="dark")r.classList.add("dark");}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");}})();`;
