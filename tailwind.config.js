/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slack: {
          dark: '#1A1D21',
          sidebar: '#1E1F22',
          purple: '#4A154B',
          green: '#2BAC76',
          hover: '#2A2B2F',
          active: '#35373C'
        }
      }
    },
  },
  plugins: [],
}
