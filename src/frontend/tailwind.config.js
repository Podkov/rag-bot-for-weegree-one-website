/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // nasze brandowe kolory
        primary: '#4F46E5',    // indygo-600
        secondary: '#7C3AED',  // fiolet-600
      },
      boxShadow: {
        // dodatkowe cienie
        chat: '0 4px 6px rgba(0,0,0,0.1)',
      },
      animation: {
        // animacja "bounce" dla kropek
        bounce: 'bounce 0.8s infinite',
      },
      keyframes: {
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-5px)' },
        },
      },
    },
  },
  plugins: [
    // dla lepszego stylowania formularzy
    require('@tailwindcss/forms'),
  ],
} 