const withMT = require('@material-tailwind/react/utils/withMT');
const colors = require('tailwindcss/colors');
const scrollbar = require('tailwind-scrollbar');

/** @type {import('tailwindcss').Config} */
module.exports = withMT({
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    '../packages/crystalith-slidev/src/**/*.{js,jsx,ts,tsx}',
    // streamdown（聊天 markdown 渲染）的 utility classes 在其 dist 内；
    // v3 没有 @source，只能走 content 扫描（精确到 dist，勿放宽）
    'node_modules/streamdown/dist/*.js',
    'node_modules/@streamdown/code/dist/*.js',
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
        // ===== streamdown（聊天 markdown 渲染）shadcn token 体系 =====
        // 仅由 streamdown dist 内的 utility classes 消费；变量取值见 tailwind.css
        // 的 --sd-*（light=gray / dark=slate）。`<alpha-value>` 支持 bg-muted/80 等。
        background: 'rgb(var(--sd-background) / <alpha-value>)',
        foreground: 'rgb(var(--sd-foreground) / <alpha-value>)',
        muted: 'rgb(var(--sd-muted) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--sd-muted-foreground) / <alpha-value>)',
        border: 'rgb(var(--sd-border) / <alpha-value>)',
        sidebar: 'rgb(var(--sd-sidebar) / <alpha-value>)',
        primary: 'rgb(var(--sd-primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--sd-primary-foreground) / <alpha-value>)',
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
          // 主要文字
          text: colors.gray[800],
          // 次要文字
          'text-muted': colors.gray[600],
          // 辅助文字
          'text-subtle': colors.gray[500],
          // 边框颜色
          // 主要边框
          border: colors.gray[300],
          // 次要边框
          'border-muted': colors.gray[200],
          // 背景颜色
          // 浅色背景
          bg: colors.gray[100],
          // 更浅背景
          'bg-muted': colors.gray[50],
          // 悬停背景
          'bg-hover': colors.gray[200],
          // 交互状态
          hover: colors.gray[100],
          active: colors.gray[200],
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
  plugins: [scrollbar({ nocompatible: true })],
});
