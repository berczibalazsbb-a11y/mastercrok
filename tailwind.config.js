/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        power: '#dc2626',
        intelligence: '#2563eb',
        reflex: '#16a34a',
      },
    },
  },
  plugins: [],
};
