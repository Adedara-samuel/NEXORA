/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      // Every custom color carries the Tailwind `<alpha-value>` placeholder
      // so opacity modifiers (bg-surface/60, border-primary/40, ...) work —
      // without it Tailwind can't inject alpha into a plain hsl(var(..))
      // string and utilities using a slash silently render wrong.
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        surface: "hsl(var(--surface) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display, 'Orbitron')", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 0 0 1px hsl(var(--primary) / 0.4), 0 0 24px hsl(var(--primary) / 0.35)",
        "glow-sm": "0 0 0 1px hsl(var(--primary) / 0.3), 0 0 12px hsl(var(--primary) / 0.25)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.55))" },
          "50%": { opacity: "0.75", filter: "drop-shadow(0 0 22px hsl(var(--primary) / 0.85))" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
        "toast-in": {
          from: { opacity: "0", transform: "translateX(24px) scale(0.96)" },
          to: { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        "toast-out": {
          from: { opacity: "1", transform: "translateX(0) scale(1)", maxHeight: "80px" },
          to: { opacity: "0", transform: "translateX(24px) scale(0.96)", maxHeight: "0" },
        },
        "shrink-x": { from: { transform: "scaleX(1)" }, to: { transform: "scaleX(0)" } },
        "drift": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-2%, 2%)" },
        },
        "scan-sweep": {
          "0%": { top: "0%", opacity: "0" },
          "8%": { opacity: "1" },
          "45%": { opacity: "1" },
          "50%": { top: "100%", opacity: "0" },
          "100%": { top: "100%", opacity: "0" },
        },
        // Marching dashes: animates stroke-dashoffset, the correct way to
        // make an SVG dashed line "flow" — background-position (used by
        // `shimmer`) has no effect on SVG strokes at all.
        "circuit-flow": { to: { strokeDashoffset: "-24" } },
        "circuit-flow-reverse": { to: { strokeDashoffset: "24" } },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        "fade-in-up": "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-glow": "pulse-glow 2.2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin-slow 6s linear infinite",
        "toast-in": "toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        "toast-out": "toast-out 0.25s cubic-bezier(0.4, 0, 1, 1) both",
        "shrink-x": "shrink-x linear forwards",
        drift: "drift 12s ease-in-out infinite",
        "scan-sweep": "scan-sweep 5s ease-in-out infinite",
        "circuit-flow": "circuit-flow 1s linear infinite",
        "circuit-flow-slow": "circuit-flow 2s linear infinite",
        "circuit-flow-reverse": "circuit-flow-reverse 1.4s linear infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
