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
      colors: {
        background: 'var(--background)',
        card: 'var(--card)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        foreground: 'var(--foreground)',
        'secondary-foreground': 'var(--secondary-foreground)',
        'subtle-foreground': 'var(--subtle-foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        success: 'var(--success)',
        destructive: 'var(--destructive)',
        info: 'var(--info)',
        violet: 'var(--violet)',
        lavender: 'var(--lavender)',
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
        hairline: 'inset 0 0 0 1px var(--border)',
        float: 'rgba(8, 9, 10, 0.6) 0px 4px 32px',
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
