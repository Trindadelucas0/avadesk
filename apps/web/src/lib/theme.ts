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

/**
 * `meta[name="theme-color"]` é criada aqui, não pelo `viewport` do Next: a
 * hidratação recria as tags de metadata e desfaria a cor do tema ativo.
 */
function applyThemeColor(theme: Theme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[theme];
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  applyThemeColor(theme);
}

/**
 * Roda antes do primeiro paint para evitar flash do tema errado.
 * Mantido como string porque é injetado inline no documento.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=localStorage.getItem("${THEME_STORAGE_KEY}");var t=v==="dark"||v==="light"?v:"${DEFAULT_THEME}";var r=document.documentElement;r.setAttribute("data-theme",t);if(t==="dark")r.classList.add("dark");var m=document.createElement("meta");m.name="theme-color";m.content=t==="dark"?"${THEME_COLOR.dark}":"${THEME_COLOR.light}";document.head.appendChild(m);}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");}})();`;
