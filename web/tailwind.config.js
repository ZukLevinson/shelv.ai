/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          800: '#111827',
          900: '#0b0f19',
          700: '#1f2937'
        }
      }
    },
  },
  plugins: [],
}