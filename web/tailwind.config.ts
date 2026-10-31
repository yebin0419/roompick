import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd6ff",
          500: "#2b6ef0",
          600: "#1f58d1",
          700: "#1945a8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
