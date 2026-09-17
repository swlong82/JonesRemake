import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--c-surface)',
        'surface-2': 'var(--c-surface-2)',
        'surface-3': 'var(--c-surface-3)',
        ink: 'var(--c-ink)',
        'ink-muted': 'var(--c-ink-muted)',
        line: 'var(--c-line)',
        accent: 'var(--c-accent)',
        'accent-strong': 'var(--c-accent-strong)',
        focus: 'var(--c-focus)',
        danger: 'var(--c-danger)',
        ok: 'var(--c-ok)',
        warn: 'var(--c-warn)',
      },
      minHeight: { 11: '2.75rem' },
    },
  },
  plugins: [],
} satisfies Config;
