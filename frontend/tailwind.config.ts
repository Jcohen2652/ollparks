import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#1e40af',
          600: '#1e3a8a',
          700: '#172554',
        },
      },
    },
  },
  plugins: [],
};

export default config;
