/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand / Primary
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        app: {
          bg: '#eef3fb',
          surface: '#ffffff',
          surfaceMuted: '#f8fafc',
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        info: {
          DEFAULT: '#2563eb',
          light: '#eff6ff',
          border: '#bfdbfe',
          dark: '#1d4ed8',
        },
        // Neutral / Slate scale (mirrors existing palette)
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#0f172a',
          900: '#0b1222',
        },
        // Semantic
        success: { DEFAULT: '#16a34a', light: '#ecfdf3', border: '#a7f3d0' },
        warning: { DEFAULT: '#b45309', light: '#fffbeb', border: '#fde68a' },
        danger: { DEFAULT: '#dc2626', dark: '#b91c1c', light: '#fef2f2', border: '#fecaca' },
        critical: { DEFAULT: '#7f1d1d', light: '#fef2f2' },
      },
      fontSize: {
        '2xs': ['0.68rem', { lineHeight: '1rem' }],
        xs: ['0.74rem', { lineHeight: '1.1rem' }],
        sm: ['0.82rem', { lineHeight: '1.25rem' }],
        base: ['0.9rem', { lineHeight: '1.4rem' }],
        md: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.6rem' }],
        xl: ['1.25rem', { lineHeight: '1.7rem' }],
      },
      spacing: {
        // Compact scale for dense UI elements
        1.5: '0.375rem',
        2.5: '0.625rem',
        3.5: '0.875rem',
        4.5: '1.125rem',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(15,23,42,0.07)',
        panel: '0 4px 18px rgba(15,23,42,0.08)',
        modal: '0 10px 28px rgba(15,23,42,0.1)',
      },
      minHeight: {
        btn: '34px',
        'btn-sm': '28px',
        'btn-lg': '40px',
      },
    },
  },
  plugins: [],
}
