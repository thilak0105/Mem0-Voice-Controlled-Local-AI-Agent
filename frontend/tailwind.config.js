/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d1117",
        card: "#161b22",
        border: "#30363d",
        accent: "#2f81f7",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(48,54,61,0.7)",
      },
      keyframes: {
        pulseBlue: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(47,129,247,0.35)" },
          "50%": { boxShadow: "0 0 0 10px rgba(47,129,247,0)" },
        },
        pulseRed: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(248,81,73,0.35)" },
          "50%": { boxShadow: "0 0 0 10px rgba(248,81,73,0)" },
        },
      },
      animation: {
        pulseBlue: "pulseBlue 1.4s ease-out infinite",
        pulseRed: "pulseRed 1.2s ease-out infinite",
      },
    },
  },
  plugins: [],
};
