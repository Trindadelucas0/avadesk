import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        hub: {
          base: "var(--bg-base)",
          elevated: "var(--bg-elevated)",
          subtle: "var(--bg-subtle)",
          hover: "var(--bg-hover)",
          border: "var(--border)",
          "border-strong": "var(--border-strong)",
          muted: "var(--text-muted)",
          secondary: "var(--text-secondary)",
          accent: "var(--accent)",
          success: "var(--success)",
          warning: "var(--warning)",
          danger: "var(--danger)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "300ms",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms var(--ease-standard)",
        shimmer: "shimmer 1.2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
