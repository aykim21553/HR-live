import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        muted: "#64727B",
        line: "#D9E1E5",
        club: {
          deep: "#10262C",
          teal: "#0F5C63",
          soft: "#E7F3F2",
          rust: "#B4532A",
          gold: "#B7791F"
        }
      },
      boxShadow: {
        panel: "0 14px 34px rgba(24, 39, 47, 0.08)"
      },
      borderRadius: {
        panel: "8px"
      }
    }
  },
  plugins: []
};

export default config;
