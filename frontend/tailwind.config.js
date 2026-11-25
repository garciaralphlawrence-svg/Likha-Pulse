/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#0c0d10", 900: "#14161b", 800: "#1d2027", 700: "#2a2e37", 500: "#5b606b", 400: "#8a8f99" },
        gold: { 700: "#8c6d36", 600: "#a5844a", 500: "#b8975a", 300: "#d9c39a", 100: "#f3ead8", 50: "#faf6ee" },
        ivory: { 50: "#fcfaf6", 100: "#f7f3ec", 200: "#efe8dc", 300: "#e4dacb" },
        navy: { 950: "#0c0d10", 900: "#14161b", 800: "#1d2027", 700: "#2a2e37", 100: "#efe8dc", 50: "#f7f3ec" },
        pos: "#2f7d62", neg: "#b4544a", neu: "#a99f8f",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,27,.04), 0 8px 24px -12px rgba(20,22,27,.12)",
        lift: "0 18px 40px -18px rgba(20,22,27,.35)",
      },
    },
  },
  plugins: [],
};
