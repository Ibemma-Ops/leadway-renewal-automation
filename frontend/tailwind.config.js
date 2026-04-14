/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:       "#002F6C",
          "blue-700": "#003d8f",
          "blue-800": "#002558",
          "blue-50":  "#e8eef8",
          "blue-100": "#c5d4ed",
          red:        "#E30613",
          "red-700":  "#b80510",
          "red-50":   "#fde8e9",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.06)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,.08), 0 2px 4px -2px rgba(0,0,0,.06)",
      },
    },
  },
  plugins: [],
};
