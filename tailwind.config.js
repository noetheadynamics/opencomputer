/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        oc: {
          bg: "var(--oc-bg)",
          surface: "var(--oc-surface)",
          "surface-border": "var(--oc-surface-border)",
          bezel: "var(--oc-bezel)",
          "text-primary": "var(--oc-text-primary)",
          "text-secondary": "var(--oc-text-secondary)",
          accent: "var(--oc-accent)",
          "accent-glow": "var(--oc-accent-glow)",
          "accent-muted": "var(--oc-accent-muted)",
          danger: "#ef4444",
        },
      },
      boxShadow: {
        "oc-glow": "0 0 20px var(--oc-accent-glow)",
        "oc-glow-sm": "0 0 10px var(--oc-accent-glow)",
      },
      backdropBlur: {
        xs: "2px",
      },
      transitionTimingFunction: {
        "oc-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "oc-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "oc-fade-in": "oc-fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
