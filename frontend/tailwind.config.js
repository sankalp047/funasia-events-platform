/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#FDFAF6",
          card: "#FFFFFF",
          muted: "#F7F3ED",
          dark: "#1C1917",
          accent: "#DC3545",
          accentHover: "#B52D3A",
          gold: "#D4920B",
          goldBg: "#FEF9EC",
          teal: "#0D9488",
          tealBg: "#ECFDF5",
          text: "#1C1917",
          textMid: "#57534E",
          textLight: "#A8A29E",
          border: "#E7E5E4",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
