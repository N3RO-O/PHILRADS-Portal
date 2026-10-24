/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PHILRADS brand palette (branding guide)
        burgundy: {
          DEFAULT: '#640606',
          50: '#fbf2f2',
          100: '#f5e1e1',
          600: '#7a0b0b',
          700: '#640606',
          800: '#4d0404',
        },
        cloud: '#F1F1F1',
        charcoal: '#353535',
        uplift: {
          DEFAULT: '#EC952A', // Uplifting Yellow: the highlight colour of the dark UI
          soft: '#F3AE57',
          700: '#8f5410',
        },
        // Light burgundy for data and alerts on dark surfaces (Dark Burgundy itself is too dark to read there).
        rose: '#D97B7B',
        // Dark interface surfaces, built on the brand's Charcoal.
        page: '#1c1d21',
        surface: {
          DEFAULT: '#26272c',
          sunken: '#202125',
          raised: '#303137',
        },
        line: '#36373d',
        ink: {
          DEFAULT: '#F1F1F1', // Cloud
          soft: '#c4c6cd',
          mute: '#9a9ca6',
        },
        muted: '#9a9ca6',
        // Inventory status colours. All meet WCAG AA (>= 5:1) as text on dark surfaces,
        // always paired with an icon and a word so status never relies on colour alone.
        status: {
          in: '#4ade80', // In stock: green
          low: '#fbbf24', // Low / reorder: amber
          out: '#f87171', // Out of stock / critical: red
          expiring: '#c4b5fd', // Expiring soon: purple
          expired: '#fb923c', // Expired: dark orange
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Arial Black"', 'system-ui', 'sans-serif'],
        sans: ['Montserrat', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"EB Garamond"', 'Georgia', 'Cambria', 'serif'],
      },
      // Smooth motion: one soft "ease-out-quint" curve for every transition and animation.
      // Only transform and opacity are animated; all of it is disabled for prefers-reduced-motion (index.css).
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(-6px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'grow-y': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'sheet-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        // Undo bar: shrinks to nothing over the undo window.
        'undo-countdown': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
      },
      animation: {
        // Entrances use fill-mode "backwards": hidden during their delay, and no transform is held afterwards.
        'fade-up': 'fade-up 480ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'fade-in': 'fade-in 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'pop-in': 'pop-in 180ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'slide-in-left': 'slide-in-left 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'grow-x': 'grow-x 800ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'grow-y': 'grow-y 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'sheet-up': 'sheet-up 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'sheet-left': 'sheet-left 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'undo-countdown': 'undo-countdown 3s linear forwards',
      },
    },
  },
  plugins: [],
};
