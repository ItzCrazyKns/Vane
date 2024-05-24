import type { Config } from 'tailwindcss';
import color from 'tailwindcss/colors';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: {
        light: 'rgba(0, 0, 0, 0.1)',
        dark: '#1c1c1c',
      },
      colors: {
        primaryDark: '#0a0a0a',
        secondDark: '#1c1c1c',
        primaryLight: '#fff',
        secondLight: color.gray[50],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
