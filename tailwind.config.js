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
      fontFamily: {
        display: ['"Archivo Black"', '"Arial Black"', 'system-ui', 'sans-serif'],
        sans: ['Montserrat', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"EB Garamond"', 'Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
};
