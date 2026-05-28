/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1a22",
        sand: "#f6f4ef",
        accent: "#ff6a3d",
        navy: "#1d4e89",
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 20px 40px rgba(28, 26, 34, 0.08)",
      },
    },
  },
  plugins: [],
};

