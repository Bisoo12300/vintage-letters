import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mora: {
          cream: '#FAF8F4',
          beige: {
            50: '#F5F1EB',
            100: '#EDE6DC',
            200: '#E0D6C8',
            300: '#D4C9B8',
          },
          brown: {
            200: '#C4B5A3',
            400: '#9A8775',
            500: '#7D6B5A',
            600: '#6B5A4A',
            700: '#574A3D',
            800: '#3D3429',
          },
        },
        // keep letter paper palette for reading view
        parchment: {
          50: '#fdf9f3',
          100: '#f5f0e1',
          200: '#e8dcc4',
        },
        ink: {
          DEFAULT: '#3D3429',
          light: '#574A3D',
          faded: '#7D6B5A',
        },
      },
      fontFamily: {
        display: ['var(--font-lora)', 'Georgia', 'serif'],
        body: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
        script: ['var(--font-lora)', 'Georgia', 'serif'],
      },
      borderRadius: {
        mora: '1.25rem',
        'mora-lg': '2rem',
      },
      boxShadow: {
        soft: '0 4px 24px rgba(61, 52, 41, 0.06)',
        'soft-lg': '0 8px 40px rgba(61, 52, 41, 0.08)',
        letter: '0 8px 32px rgba(61, 52, 41, 0.1)',
      },
      backgroundImage: {
        'paper-texture':
          'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5), transparent 60%), radial-gradient(ellipse at 80% 85%, rgba(61,52,41,0.03), transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
