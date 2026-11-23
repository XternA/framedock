/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: 'rgb(var(--hover) / <alpha-value>)',
          100: 'rgb(var(--selection) / <alpha-value>)',
          200: 'rgb(var(--border) / <alpha-value>)',
          300: '#8FB8A2',
          400: '#5F9579',
          500: '#3C7A5C',
          600: '#2C6148',
          700: '#244E3B',
          800: '#1F4132',
          900: 'rgb(var(--selected-text) / <alpha-value>)',
        },
        ivory: 'rgb(var(--stage) / <alpha-value>)',
        white: 'rgb(var(--surface) / <alpha-value>)',
        charcoal: {
          DEFAULT: 'rgb(var(--text) / <alpha-value>)',
          soft: 'rgb(var(--text-soft) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
        },
        gold: {
          400: '#D4B071',
          500: '#C39A52',
          600: '#A87F3C',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(31, 30, 27, 0.06), 0 8px 24px rgba(31, 30, 27, 0.06)',
      },
    },
  },
  plugins: [],
}
