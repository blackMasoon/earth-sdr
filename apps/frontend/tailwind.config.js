/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        'atlas-bg': '#0f172a',
        'atlas-surface': '#1e293b',
        'atlas-border': '#334155',
        'atlas-text': '#e2e8f0',
        'atlas-accent': '#3b82f6',
        'atlas-accent-hover': '#2563eb',
      },
    },
  },
  plugins: [],
};
