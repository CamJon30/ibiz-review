/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#E8C547",
          dark: "#d4a017",
          dim: "#886a1a",
          bg: "#1a1500",
          border: "#3a3000",
        },
        surface: {
          DEFAULT: "#0a0a0a",
          1: "#111111",
          2: "#141414",
          3: "#1a1a1a",
          4: "#222222",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        fadeSlideIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        progressFill: {
          from: { width: "0%" },
        },
        slideDown: {
          from: { opacity: "0", maxHeight: "0" },
          to: { opacity: "1", maxHeight: "300px" },
        },
      },
      animation: {
        "fade-in": "fadeSlideIn 0.3s ease both",
        "progress-fill": "progressFill 0.6s ease",
        "slide-down": "slideDown 0.25s ease",
      },
    },
  },
  plugins: [],
};
