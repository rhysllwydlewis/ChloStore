import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        chlo: {
          cream: '#F7F1E7',
          surface: '#FFFCF7',
          beige: '#E7D8C6',
          tan: '#C9A983',
          brown: '#3B2F2A',
          muted: '#6E5B52',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'drift-slow': 'drift 20s infinite ease-in-out',
        'drift-medium': 'drift 15s infinite ease-in-out reverse',
        'drift-fast': 'drift 10s infinite ease-in-out',
        shimmer: 'shimmer 2.5s infinite',
        'bounce-slow': 'hero-bounce 2.5s infinite',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '25%': { transform: 'translate(20px, -30px) scale(1.05)' },
          '50%': { transform: 'translate(-15px, 15px) scale(0.95)' },
          '75%': { transform: 'translate(30px, 20px) scale(1.02)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'hero-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(8px)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
