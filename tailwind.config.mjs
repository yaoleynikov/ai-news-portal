/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0a0a0b', light: '#141416', lighter: '#1c1c1f' },
        accent: { DEFAULT: '#6d5dfc', hover: '#5b4aee' },
        surface: { DEFAULT: '#2a2a2e', light: '#3a3a40' },
        text: { DEFAULT: '#e4e4e7', muted: '#a1a1aa', dim: '#71717a' },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
