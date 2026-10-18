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
          200: '#e7bdbd',
          600: '#7a0b0b',
          700: '#640606',
          800: '#4d0404',
        },
        cloud: '#F1F1F1',
        charcoal: '#353535',
        muted: '#5f5f5f',
        uplift: {
          DEFAULT: '#EC952A',
          50: '#fdf4e8',
          100: '#fbe7cd',
          700: '#8f5410',
        },
      },
      // Smooth motion: one soft "ease-out-quint" curve for every transition and animation.
      // Only transform and opacity are animated; all of it is disabled for prefers-reduced-motion (index.css).
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        DEFAULT: '220ms',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(-6px) scale(0.97)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'grow-y': { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
      },
      animation: {
        // Entrances use fill-mode "backwards" so the element is hidden during its delay but, once
        // finished, no longer holds a transform (hover lifts and other transforms keep working).
        'fade-up': 'fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'fade-in': 'fade-in 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'pop-in': 'pop-in 200ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'slide-in-left': 'slide-in-left 340ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'grow-x': 'grow-x 900ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'grow-y': 'grow-y 800ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Arial Black"', 'system-ui', 'sans-serif'],
        sans: ['Montserrat', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"EB Garamond"', 'Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
};
