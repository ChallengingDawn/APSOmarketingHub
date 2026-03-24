import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        apso: {
          red: '#ed1b2f',
          'red-dark': '#d80901',
          teal: '#274e64',
          'teal-light': '#325f78',
          dark: '#050505',
          text: '#5e5e5e',
          gray: '#f6f6f6',
          border: '#e6e8ea',
        },
      },
      fontFamily: {
        sans: ['Arial', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
