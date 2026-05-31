/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:    "#1c1a22",
        sand:   "#f6f4ef",
        accent: "#ff6a3d",
        navy:   "#1d4e89",
      },
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 4px 24px rgba(28, 26, 34, 0.07), 0 1px 4px rgba(28, 26, 34, 0.04)",
        card: "0 2px 12px rgba(28, 26, 34, 0.06)",
      },
      borderWidth: {
        "0.5": "0.5px",
      },
      opacity: {
        2:  "0.02",
        3:  "0.03",
        4:  "0.04",
        6:  "0.06",
        8:  "0.08",
        15: "0.15",
      },
      animation: {
        "fade-in":   "fadeIn 0.25s ease-out",
        "slide-up":  "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundOpacity: {
        2:  "0.02",
        3:  "0.03",
        4:  "0.04",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
