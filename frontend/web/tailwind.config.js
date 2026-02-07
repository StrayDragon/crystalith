const withMT = require("@material-tailwind/react/utils/withMT");
const colors = require("tailwindcss/colors");
const scrollbar = require("tailwind-scrollbar");

/** @type {import('tailwindcss').Config} */
module.exports = withMT({
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    '../packages/crystalith-slidev/src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Use system fonts - no external font loading needed
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      colors: {
        slate: colors.slate || colors.gray,
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
        // ===== 语义化 UI 色彩 =====
        // 调整以下值可以统一修改整个应用的配色
        ui: {
          // 文字颜色
          'text': colors.gray[800],        // 主要文字
          'text-muted': colors.gray[600],  // 次要文字
          'text-subtle': colors.gray[500], // 辅助文字
          // 边框颜色
          'border': colors.gray[300],      // 主要边框
          'border-muted': colors.gray[200], // 次要边框
          // 背景颜色
          'bg': colors.gray[100],          // 浅色背景
          'bg-muted': colors.gray[50],     // 更浅背景
          'bg-hover': colors.gray[200],    // 悬停背景
          // 交互状态
          'hover': colors.gray[100],
          'active': colors.gray[200],
        },
      },
      boxShadow: {
        soft: '0 12px 28px rgba(15, 23, 42, 0.08)',
        glow: '0 16px 30px rgba(37, 99, 235, 0.25)',
      },
      keyframes: {
        'slide-in': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'slide-out': 'slide-out 0.3s ease-in',
      },
    },
  },
  plugins: [
    scrollbar({ nocompatible: true }),
  ],
});
