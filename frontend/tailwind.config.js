/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#0b1426", 900: "#0f1f3d", 800: "#16294f", 700: "#203a6b", 100: "#e8edf6", 50: "#f4f6fa" },
        pos: "#1f9d6b", neg: "#d64545", neu: "#8a94a6",
      },
      fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)" },
    },
  },
  plugins: [],
};
