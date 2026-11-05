/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PHILRADS brand palette (branding guide)
        // Dominant colour (docs/design-system.md): a fill with Cloud text, never text on the dark page.
        burgundy: {
          DEFAULT: '#640606',
          50: '#fbf2f2',
          100: '#f5e1e1',
          400: '#b3302f', // edge of a burgundy fill (selected chip, active menu item)
          500: '#8c1414', // burgundy fill on dark surfaces: Cloud text on it is 8:1
          600: '#7a0b0b',
          700: '#640606',
          800: '#4d0404',
        },
        cloud: '#F1F1F1',
        // Dark text on an Uplift fill: the same in both themes.
        onaccent: '#1c1d21',
        charcoal: '#353535',
        // Theme colours are CSS variables (src/index.css): dark by default, light with data-theme="light".
        uplift: {
          DEFAULT: 'rgb(var(--uplift) / <alpha-value>)', // Accent: primary action, links, focus, your own progress. Nothing else.
          soft: 'rgb(var(--uplift-soft) / <alpha-value>)',
          700: '#8f5410',
        },
        // Kept as a name for older code; it is the red of status-out (late, failed, high priority).
        rose: 'rgb(var(--status-out) / <alpha-value>)',
        // Dark interface surfaces, built on the brand's Charcoal.
        page: 'rgb(var(--page) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)', // Cloud on dark
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          mute: 'rgb(var(--ink-mute) / <alpha-value>)',
        },
        muted: 'rgb(var(--ink-mute) / <alpha-value>)',
        // Status colours: state only, always next to a word (docs/design-system.md). All meet WCAG AA
        // (>= 5:1) as text on dark surfaces.
        status: {
          in: 'rgb(var(--status-in) / <alpha-value>)', // Done, in stock, connected, live: green
          low: 'rgb(var(--status-low) / <alpha-value>)', // Needs attention soon: amber
          out: 'rgb(var(--status-out) / <alpha-value>)', // Wrong or late: red
          expiring: 'rgb(var(--status-low) / <alpha-value>)', // = low
          expired: 'rgb(var(--status-out) / <alpha-value>)', // = out
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
        // Calendar: the new month slides in from the side you went to.
        'cal-next': { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'cal-prev': { from: { opacity: '0', transform: 'translateX(-24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'roll-in': { from: { opacity: '0', transform: 'translateY(100%)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        // Undo bar: shrinks to nothing over the undo window.
        'undo-countdown': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
      },
      animation: {
        // Entrances use fill-mode "backwards": hidden during their delay, and no transform is held afterwards.
        'fade-up': 'fade-up 480ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'fade-in': 'fade-in 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'cal-next': 'cal-next 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'cal-prev': 'cal-prev 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'pop-in': 'pop-in 180ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'slide-in-left': 'slide-in-left 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'grow-x': 'grow-x 800ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'grow-y': 'grow-y 700ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'sheet-up': 'sheet-up 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'sheet-left': 'sheet-left 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'undo-countdown': 'undo-countdown 3s linear forwards',
        'roll-in': 'roll-in 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
      },
    },
  },
  plugins: [],
};
