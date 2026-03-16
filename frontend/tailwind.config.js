/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        qblue: {
          50: '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#3253DC',
          700: '#2942b8',
          800: '#1e3099',
          900: '#0f1f6b',
          950: '#070d3a',
        },
        qpurple: '#7c3aed',
        qdark: {
          50: '#f8faff',
          100: '#e8ecf8',
          800: '#0d1117',
          900: '#080c12',
          950: '#030508',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right': 'slideRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        slideRight: { '0%': { opacity: 0, transform: 'translateX(24px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(50, 83, 220, 0.4)',
        'glow-purple': '0 0 20px rgba(124, 58, 237, 0.4)',
        'card': '0 4px 24px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
};
