/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: {
          base: "#080c14",
          surface: "#0d1322",
          elevated: "#131b2e",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.08)",
          DEFAULT: "rgba(255, 255, 255, 0.12)",
          bright: "rgba(255, 255, 255, 0.22)",
        },
        brand: {
          indigo: "#6366f1",
          cyan: "#06b6d4",
          violet: "#8b5cf6",
        },
        state: {
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#f43f5e",
          info: "#38bdf8",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
        card: "0 4px 24px -2px rgba(0, 0, 0, 0.5)",
        glow: "0 0 25px -4px rgba(99, 102, 241, 0.35)",
        glowCyan: "0 0 25px -4px rgba(6, 182, 212, 0.35)",
        glowEmerald: "0 0 25px -4px rgba(16, 185, 129, 0.35)",
        glowRose: "0 0 25px -4px rgba(244, 63, 94, 0.35)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.2s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
}
