/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Barlow Condensed', 'sans-serif'],
        sans: ['Barlow', 'sans-serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#0B0F14',
          card: '#131C26',
          alt: '#101720',
        },
        teal: {
          DEFAULT: '#19D3C5',
          dim: 'rgba(25,211,197,0.10)',
          light: '#BDEFEA',
          dark: '#17BFAE',
        },
        ink: '#E8EDF2',
        muted: '#93A4B7',
        label: '#5E7188',
        error: '#f87171',
      },
      boxShadow: {
        teal: '0 0 24px rgba(25,211,197,0.25)',
        'teal-sm': '0 0 12px rgba(25,211,197,0.15)',
      },
    },
  },
  plugins: [],
}
