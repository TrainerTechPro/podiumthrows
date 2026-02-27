import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Warm amber/gold primary palette
        primary: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },
        // Neutral grays for backgrounds/text
        surface: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          300: "#d4d4d4",
          400: "#a3a3a3",
          500: "#737373",
          600: "#525252",
          700: "#404040",
          800: "#262626",
          850: "#1e1e1e",
          900: "#171717",
          950: "#0a0a0a",
        },
        // Semantic colors
        success: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        info: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      fontFamily: {
        heading: ["var(--font-outfit)", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Strict type scale (per design system)
        "display": ["2rem", { lineHeight: "1.2", fontWeight: "800", letterSpacing: "-0.02em" }],
        "title": ["1.5rem", { lineHeight: "1.25", fontWeight: "700", letterSpacing: "-0.015em" }],
        "section": ["1.25rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.5", fontWeight: "400" }],
        "body": ["0.9375rem", { lineHeight: "1.5", fontWeight: "400" }],
        "caption": ["0.8125rem", { lineHeight: "1.4", fontWeight: "400" }],
        "micro": ["0.6875rem", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "0.05em" }],
        // Legacy display scale (keep for backward compatibility)
        "display-xl": ["3.5rem", { lineHeight: "1.1", fontWeight: "700" }],
        "display-lg": ["2.5rem", { lineHeight: "1.15", fontWeight: "700" }],
        "display-md": ["2rem", { lineHeight: "1.2", fontWeight: "600" }],
        "display-sm": ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
        "glow": "0 0 20px rgb(245 158 11 / 0.15)",
        "glow-lg": "0 0 40px rgb(245 158 11 / 0.2)",
      },
      keyframes: {
        // Existing animations
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInUp: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInDown: {
          "0%": { opacity: "0", transform: "translateY(-40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideOutUp: {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-40px)" },
        },
        slideOutDown: {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(40px)" },
        },
        // Spring animations (from TrainingTracker)
        "spring-in": {
          "0%": { transform: "translateX(40px) scale(0.98)", opacity: "0" },
          "50%": { transform: "translateX(-4px) scale(1.01)", opacity: "0.8" },
          "75%": { transform: "translateX(2px) scale(1)", opacity: "1" },
          "100%": { transform: "translateX(0) scale(1)", opacity: "1" },
        },
        "spring-up": {
          "0%": { transform: "translateY(20px) scale(0.98)", opacity: "0" },
          "50%": { transform: "translateY(-3px) scale(1.01)", opacity: "0.8" },
          "75%": { transform: "translateY(1px) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "scale-spring": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "50%": { transform: "scale(1.05)", opacity: "0.9" },
          "75%": { transform: "scale(0.98)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "count-up-spring": {
          "0%": { transform: "translateY(12px) scale(0.9)", opacity: "0" },
          "60%": { transform: "translateY(-2px) scale(1.02)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "draw-in": {
          "0%": { strokeDashoffset: "100%", opacity: "0.3" },
          "100%": { strokeDashoffset: "0%", opacity: "1" },
        },
        "bar-grow": {
          "0%": { transform: "scaleY(0)", transformOrigin: "bottom" },
          "60%": { transform: "scaleY(1.03)", transformOrigin: "bottom" },
          "100%": { transform: "scaleY(1)", transformOrigin: "bottom" },
        },
        "holographic": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "shimmer-fast": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.15)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
        "chip-in": {
          "0%": { transform: "translateY(8px) scale(0.95)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "progress-fill": {
          "0%": { width: "0%" },
        },
        "streak-flame": {
          "0%, 100%": { transform: "scaleY(1) rotate(0deg)" },
          "25%": { transform: "scaleY(1.1) rotate(-3deg)" },
          "50%": { transform: "scaleY(0.95) rotate(2deg)" },
          "75%": { transform: "scaleY(1.05) rotate(-1deg)" },
        },
      },
      animation: {
        // Existing
        "shimmer": "shimmer 2s infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "slide-in-up": "slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-down": "slideInDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-out-up": "slideOutUp 0.25s ease-in",
        "slide-out-down": "slideOutDown 0.25s ease-in",
        // Spring animations
        "spring-in": "spring-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "spring-up": "spring-up 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "scale-spring": "scale-spring 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "count-up-spring": "count-up-spring 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "draw-in": "draw-in 1.2s ease-out both",
        "bar-grow": "bar-grow 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "holographic": "holographic 3s ease-in-out infinite",
        "shimmer-fast": "shimmer-fast 1.5s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        "chip-in": "chip-in 0.3s ease-out both",
        "progress-fill": "progress-fill 1s ease-out both",
        "streak-flame": "streak-flame 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "smooth-out": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [
    // Orientation variants for responsive comparison view
    plugin(function ({ addVariant }) {
      addVariant("landscape", "@media (orientation: landscape)");
      addVariant("portrait", "@media (orientation: portrait)");
    }),
    // Animation delay utilities: animate-delay-{0|75|100|150|200|300|400|500|600|700|800}
    plugin(function ({ matchUtilities }) {
      matchUtilities(
        {
          "animate-delay": (value) => ({
            animationDelay: value,
          }),
        },
        {
          values: {
            "0": "0ms",
            "75": "75ms",
            "100": "100ms",
            "150": "150ms",
            "200": "200ms",
            "300": "300ms",
            "400": "400ms",
            "500": "500ms",
            "600": "600ms",
            "700": "700ms",
            "800": "800ms",
          },
        }
      );
    }),
  ],
};

export default config;
