import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            primary: {
              DEFAULT: "#facc15",
              foreground: "#000000",
              50: "#fefce8",
              100: "#fef9c3",
              200: "#fef08a",
              300: "#fde047",
              400: "#facc15",
              500: "#eab308",
              600: "#ca8a04",
              700: "#a16207",
              800: "#854d0e",
              900: "#713f12",
            },
            focus: "#facc15",
          },
        },
        light: {
          colors: {
            primary: {
              DEFAULT: "#eab308",
              foreground: "#000000",
              50: "#fefce8",
              100: "#fef9c3",
              200: "#fef08a",
              300: "#fde047",
              400: "#facc15",
              500: "#eab308",
              600: "#ca8a04",
              700: "#a16207",
              800: "#854d0e",
              900: "#713f12",
            },
            focus: "#eab308",
          },
        },
      },
    }),
  ],
};
