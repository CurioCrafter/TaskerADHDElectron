/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ADHD-friendly color palette
        primary: {
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
        // Low-stim mode colors
        calm: {
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
        // Energy level colors
        energy: {
          low: '#10b981',    // Green - low energy
          medium: '#f59e0b', // Amber - medium energy  
          high: '#ef4444',   // Red - high energy
        },
        // Priority colors
        priority: {
          low: '#6b7280',     // Gray
          medium: '#3b82f6',  // Blue
          high: '#f59e0b',    // Amber
          urgent: '#ef4444',  // Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    // Custom plugin for reduced motion support
    function({ addUtilities, theme, variants }) {
      const reducedMotionUtilities = {
        '@media (prefers-reduced-motion: reduce)': {
          '.animate-fade-in': {
            animation: 'none',
          },
          '.animate-slide-up': {
            animation: 'none',
          },
          '.animate-pulse-slow': {
            animation: 'none',
          },
          '.animate-bounce-gentle': {
            animation: 'none',
          },
          '.transition-all': {
            transition: 'none',
          },
          '.transition-transform': {
            transition: 'none',
          },
          '.transition-opacity': {
            transition: 'none',
          },
        }
      }
      addUtilities(reducedMotionUtilities)
    }
  ],
}
