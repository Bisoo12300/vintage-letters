import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ink — night-sky indigo used for all text and the primary action
        ink: {
          200: '#C3C8E6',
          300: '#A4AAD4',
          400: '#7F86B8',
          500: '#5F6699',
          600: '#454C80',
          700: '#343A6B',
          800: '#232858',
          900: '#161A40',
        },
        // Mist — pearl-lavender surfaces, hairlines, quiet fills
        mist: {
          50: '#F6F7FD',
          100: '#ECEEF9',
          200: '#DDE1F3',
          300: '#C9CFEA',
        },
        pearl: '#EEF0FA',
        moon: { DEFAULT: '#8C9BD6', deep: '#4A56A0', glow: '#DCE3FF' },
        sun: { DEFAULT: '#F2A541', deep: '#E07A2E', glow: '#FFE7B8' },
        rose: { DEFAULT: '#E0668A', soft: '#F8D3DE' },
        // Letter paper stays warm — the one analog object in a glass world
        parchment: {
          50: '#fdf9f3',
          100: '#f5f0e1',
          200: '#e8dcc4',
        },
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        letter: ['var(--font-lora)', 'Georgia', 'serif'],
      },
      borderRadius: {
        glass: '1.375rem',
        'glass-lg': '1.75rem',
      },
      boxShadow: {
        glass:
          '0 1px 1px rgba(35, 40, 88, 0.04), 0 8px 24px -6px rgba(35, 40, 88, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.75)',
        'glass-lg':
          '0 2px 4px rgba(35, 40, 88, 0.05), 0 24px 48px -12px rgba(35, 40, 88, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        letter: '0 30px 60px -20px rgba(35, 40, 88, 0.35), 0 8px 18px -8px rgba(35, 40, 88, 0.18)',
      },
      backgroundImage: {
        'paper-texture':
          'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(ellipse at 80% 85%, rgba(61,52,41,0.03), transparent 60%)',
      },
      transitionTimingFunction: {
        // iOS-style curves
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
