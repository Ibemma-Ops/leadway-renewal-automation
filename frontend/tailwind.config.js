/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#E30613",
          orange: "#F58220",
          black: "#111111",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Aptos", "Arial", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.06)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06)",
      },
    },
  },
  plugins: [],
};
