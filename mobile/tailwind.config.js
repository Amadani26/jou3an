/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        red: '#E8272A',
        gold: '#FFB547',
        green: '#2DCE89',
        bg: '#080808',
        bg1: '#0F0F0F',
        bg2: '#141414',
        bg3: '#1A1A1A',
        bg4: '#222222',
        border: '#242424',
        borderSoft: '#1C1C1C',
        textPrimary: '#F2EDE8',
        textSecondary: '#8A847E',
        textMuted: '#504B47',
      },
    },
  },
  plugins: [],
}
