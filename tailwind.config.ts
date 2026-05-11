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
        // Cyberpunk gold primary palette
        primary: {
          50: "#fffdf0",
          100: "#fff9d6",
          200: "#fff2a8",
          300: "#ffe866",
          400: "#ffd700",
          500: "#FFC800", // Main gold
          600: "#e6b400",
          700: "#cc9f00",
          800: "#997700",
          900: "#665000",
          950: "#332800",
        },
        // Deep dark surfaces for cyberpunk
        surface: {
          50: "#e8e8ea",
          100: "#c8c8cc",
          200: "#92929a",
          300: "#6a6a74",
          400: "#44444e",
          500: "#2a2a34",
          600: "#1e1e28",
          700: "#16161e",
          800: "#101016",
          850: "#0d0d12",
          900: "#0a0a0e",
          950: "#06060a",
        },
        // Brand accent (same as primary-500)
        brand: "#FFC800",
        // Semantic status colors
        success: {
          50: "#0a1a10",
          500: "#00FF88",
          600: "#00cc6d",
          700: "#009952",
        },
        warning: {
          50: "#1a1400",
          500: "#FF8800",
          600: "#e67a00",
          700: "#cc6c00",
        },
        danger: {
          50: "#1a0808",
          500: "#FF2222",
          600: "#e61e1e",
          700: "#cc1a1a",
        },
        info: {
          50: "#0a1020",
          500: "#4488FF",
          600: "#3d7ae6",
          700: "#366dcc",
        },
        // Status tokens — theme-aware aliases for --color-status-*.
        // Use `text-status-success-fg`, `bg-status-warning-bg`, etc. for
        // anything that conveys success/warning/danger/info STATE (not brand,
        // not decoration). Resolves to deep palette on light, vivid on dark
        // with documented WCAG ratios. See globals.css §Status.
        status: {
          "success-fg": "var(--color-status-success-fg)",
          "success-bg": "var(--color-status-success-bg)",
          "warning-fg": "var(--color-status-warning-fg)",
          "warning-bg": "var(--color-status-warning-bg)",
          "danger-fg": "var(--color-status-danger-fg)",
          "danger-bg": "var(--color-status-danger-bg)",
          "info-fg": "var(--color-status-info-fg)",
          "info-bg": "var(--color-status-info-bg)",
        },
      },
      fontFamily: {
        heading: ["var(--font-chakra-petch)", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Strict type scale (per design system)
        display: ["2rem", { lineHeight: "1.2", fontWeight: "800", letterSpacing: "-0.02em" }],
        title: ["1.5rem", { lineHeight: "1.25", fontWeight: "700", letterSpacing: "-0.015em" }],
        section: ["1.25rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.01em" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.5", fontWeight: "400" }],
        body: ["0.9375rem", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["0.8125rem", { lineHeight: "1.4", fontWeight: "400" }],
        micro: ["0.6875rem", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "0.05em" }],
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
        card: "0 1px 3px 0 rgb(0 0 0 / 0.3), 0 0 1px 0 rgb(255 200 0 / 0.05)",
        "card-hover": "0 4px 20px 0 rgb(0 0 0 / 0.4), 0 0 15px rgb(255 200 0 / 0.1)",
        // Glow is reserved for milestone moments (PR celebration, streak
        // milestone reveals). Use `shadow-warm-md` for brand CTAs that need
        // elevation without the omnidirectional glow. See audit Prompt 9.
        glow: "0 0 20px rgb(255 200 0 / 0.2)",
        "glow-lg": "0 0 40px rgb(255 200 0 / 0.3)",
        // Directional shadow with a hint of brand warmth — for elevated
        // CTAs, sticky bars, and surfaces that need to feel "lifted" without
        // radiating amber.
        "warm-md": "0 4px 12px -2px rgb(255 200 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.3)",
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
        // Ambient entry — smooth-out, no overshoot. See audit Prompt 3.
        "spring-in": {
          "0%": { transform: "translateX(40px) scale(0.98)", opacity: "0" },
          "100%": { transform: "translateX(0) scale(1)", opacity: "1" },
        },
        "spring-up": {
          "0%": { transform: "translateY(20px) scale(0.98)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        // Reserved for milestone moments only (PR celebration, streak milestones).
        // If you're tempted to use this for a regular entry animation, use
        // `animate-spring-up` (now smooth) instead.
        "milestone-pop": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "50%": { transform: "scale(1.05)", opacity: "0.9" },
          "75%": { transform: "scale(0.98)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "count-up-spring": {
          "0%": { transform: "translateY(12px) scale(0.9)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "bar-grow": {
          "0%": { transform: "scaleY(0)", transformOrigin: "bottom" },
          "100%": { transform: "scaleY(1)", transformOrigin: "bottom" },
        },
        "shimmer-fast": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
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
        "danger-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "fade-slide-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "step-slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "step-slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%": { opacity: "0.8", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.35)" },
        },
      },
      animation: {
        // Existing
        shimmer: "shimmer 2s infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "slide-in-up": "slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-down": "slideInDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-out-up": "slideOutUp 0.25s ease-in",
        "slide-out-down": "slideOutDown 0.25s ease-in",
        // Entry animations — smooth-out only. Bounce reserved for milestones.
        "spring-in": "spring-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "spring-up": "spring-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "milestone-pop": "milestone-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "count-up-spring": "count-up-spring 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        "bar-grow": "bar-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "shimmer-fast": "shimmer-fast 1.5s ease-in-out infinite",
        "chip-in": "chip-in 0.3s ease-out both",
        "progress-fill": "progress-fill 1s ease-out both",
        "streak-flame": "streak-flame 2s ease-in-out infinite",
        "danger-pulse": "danger-pulse 2s ease-in-out infinite",
        "fade-slide-in": "fade-slide-in 0.4s ease-out both",
        "slide-in-right": "step-slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-left": "step-slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "glow-pulse": "glow-pulse 0.4s ease-out forwards",
      },
      transitionTimingFunction: {
        // `spring` token removed — see audit Prompt 3. Use `smooth-out` for
        // entry/exit. The bounce curve survives only inside `milestone-pop`
        // keyframe for PR celebration + streak milestone surfaces.
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
