/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        finanz: {
          bg: '#0B0F19',
          card: '#161F30',
          'card-hover': '#1E2B42',
          surface: '#1E293B',
          border: '#283548',
          'border-subtle': '#1e293b',
          muted: '#94A3B8',
          emerald: '#10B981',
          'emerald-glow': 'rgba(16, 185, 129, 0.15)',
          crimson: '#EF4444',
          'crimson-glow': 'rgba(239, 68, 68, 0.15)',
          indigo: '#6366F1',
          'indigo-glow': 'rgba(99, 102, 241, 0.15)',
          amber: '#F59E0B',
          'amber-glow': 'rgba(245, 158, 11, 0.15)',
        }
      },
      boxShadow: {
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.25)',
        'glow-crimson': '0 0 25px -5px rgba(239, 68, 68, 0.25)',
        'glow-indigo': '0 0 25px -5px rgba(99, 102, 241, 0.25)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
