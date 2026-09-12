import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-display)', 'Iowan Old Style', 'Georgia', 'serif'],
      },
      // Every colour is handed to Tailwind as channels plus an <alpha-value>
      // placeholder, which is the only form it can apply an opacity modifier
      // to. Written as var(--accent), bg-accent/10 compiles to nothing.
      colors: {
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--secondary-foreground-rgb) / <alpha-value>)',
        'subtle-foreground': 'rgb(var(--subtle-foreground-rgb) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--muted-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground-rgb) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground-rgb) / <alpha-value>)',
          bright: 'rgb(var(--accent-bright-rgb) / <alpha-value>)',
          // Already an alpha of the accent, so it takes no modifier of its own.
          wash: 'var(--accent-wash)',
        },
        // Hover and pressed fills that used to be hardcoded white alphas.
        elevate: {
          DEFAULT: 'var(--elevate)',
          strong: 'var(--elevate-strong)',
        },
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        destructive: 'rgb(var(--destructive-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        violet: 'rgb(var(--violet-rgb) / <alpha-value>)',
        lavender: 'rgb(var(--lavender-rgb) / <alpha-value>)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius-control)',
        sm: '4px',
      },
      fontSize: {
        caption: ['13px', { lineHeight: '1.2' }],
        'body-sm': ['15px', { lineHeight: '1.6', letterSpacing: '-0.011em' }],
        body: ['16px', { lineHeight: '1.5', letterSpacing: '-0.010em' }],
        'body-lg': ['20px', { lineHeight: '1.33', letterSpacing: '-0.012em' }],
        'heading-sm': ['32px', { lineHeight: '1.13', letterSpacing: '-0.012em' }],
        heading: ['48px', { lineHeight: '1.0', letterSpacing: '-0.022em' }],
        'heading-lg': ['64px', { lineHeight: '1.0', letterSpacing: '-0.022em' }],
        display: ['72px', { lineHeight: '1.0', letterSpacing: '-0.022em' }],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '510',
        semibold: '590',
      },
      boxShadow: {
        hairline: 'var(--shadow-card)',
        card: 'var(--shadow-card)',
        raised: 'var(--shadow-raised)',
        float: 'var(--shadow-float)',
        soft: 'rgba(0, 0, 0, 0.4) 0px 2px 4px',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
