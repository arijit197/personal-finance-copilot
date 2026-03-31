/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#000000',
          secondary: '#0B0B0B',
          elevated: '#111111',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A1A1A1',
          muted: '#6B7280',
        },
        border: {
          subtle: '#1F1F1F',
        },
        accent: {
          soft: '#D4D4D8',
          muted: '#52525B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px rgba(0, 0, 0, 0.28)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(113,113,122,0.08))',
      },
      letterSpacing: {
        widePlus: '0.14em',
      },
    },
  },
  plugins: [],
}

