import type { Config } from "tailwindcss";

/**
 * "Serene Alpine Lakes" palette.
 * Anchor colors: lake #3A6A9B · sage #A3C6C4 · steel #3C4B59 · mist #F1F5F6 · ink #2B2D42
 * Ramps are tints/shades derived from those anchors so hover states, borders,
 * and badges all stay on-palette.
 */
const config: Config = {
  // lib/ matters: the severity and status palettes are plain strings there,
  // and anything not scanned never reaches the stylesheet.
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — alpine lake blue
        lake: {
          50: "#EDF3F8",
          100: "#D7E4F0",
          200: "#B0C9DF",
          300: "#87ABC9",
          400: "#5C8AB3",
          500: "#4577A4",
          600: "#3A6A9B", // anchor
          700: "#305777",
          800: "#274764",
          900: "#213B52",
        },
        // Accent — glacial sage / teal
        sage: {
          50: "#EEF5F4",
          100: "#DCEBEA",
          200: "#C4DCDA",
          300: "#A3C6C4", // anchor
          400: "#84B0AD",
          500: "#6B9895",
          600: "#567A78",
          700: "#456160",
          800: "#374D4C",
        },
        // Cool neutral ramp — mist (light) through steel to ink (dark)
        steel: {
          50: "#F1F5F6", // mist anchor — page background
          100: "#E6ECEE",
          200: "#D4DDE1",
          300: "#B7C3C9",
          400: "#8B9AA3",
          500: "#66757F",
          600: "#4B5B69",
          700: "#3C4B59", // steel anchor
          800: "#313C48",
          900: "#2B2D42", // ink anchor — headings / body text
        },
        ink: "#2B2D42",
        mist: "#F1F5F6",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(43, 45, 66, 0.04), 0 4px 16px rgba(43, 45, 66, 0.06)",
        lift: "0 2px 6px rgba(43, 45, 66, 0.08), 0 12px 28px rgba(43, 45, 66, 0.10)",
        // Focus/among-equals emphasis in the primary hue, never a neutral drop.
        glow: "0 0 0 1px rgba(58, 106, 155, 0.12), 0 8px 24px rgba(58, 106, 155, 0.16)",
      },
      keyframes: {
        // Content settles in rather than popping — paired with a stagger delay.
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Skeleton sweep. Travels twice its own width so the pause reads natural.
        shimmer: {
          "100%": { transform: "translateX(200%)" },
        },
        // Bars and dials draw from nothing on first paint.
        "grow-x": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s infinite",
        "grow-x": "grow-x 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
