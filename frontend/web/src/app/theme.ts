import { createTheme, alpha } from '@mui/material/styles';

// Responsive icon sizes based on viewport - using clamp for fluid scaling
// Base unit: 1rem = 16px, icons should be 1em-1.25em relative to text
const ICON_SIZES = {
  tiny: 12,    // For badges, chips
  small: 14,   // For compact buttons, menu items
  medium: 18,  // Default icon size
  large: 20,   // For primary actions
};

// Material Design 3 inspired theme with modern aesthetics
const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: {
      main: '#1e293b', // slate-800
      light: '#475569', // slate-600
      dark: '#0f172a', // slate-900
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#3b82f6', // blue-500
      light: '#60a5fa', // blue-400
      dark: '#2563eb', // blue-600
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    background: {
      default: '#edf0f6',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
      disabled: '#9ca3af',
    },
    divider: '#e5e7eb',
    action: {
      hover: alpha('#1e293b', 0.04),
      selected: alpha('#1e293b', 0.08),
      disabled: alpha('#1e293b', 0.26),
      disabledBackground: alpha('#1e293b', 0.12),
    },
  },
  typography: {
    fontFamily: [
      '"Work Sans"',
      '"Noto Sans SC"',
      '"Outfit"',
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ].join(','),
    h1: {
      fontFamily: '"Outfit", "Work Sans", "Noto Sans SC", sans-serif',
      fontWeight: 600,
    },
    h2: {
      fontFamily: '"Outfit", "Work Sans", "Noto Sans SC", sans-serif',
      fontWeight: 600,
    },
    h3: {
      fontFamily: '"Outfit", "Work Sans", "Noto Sans SC", sans-serif',
      fontWeight: 600,
    },
    h4: {
      fontFamily: '"Outfit", "Work Sans", "Noto Sans SC", sans-serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: '"Outfit", "Work Sans", "Noto Sans SC", sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Outfit", "Work Sans", "Noto Sans SC", sans-serif',
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    '0 18px 36px rgba(15, 23, 42, 0.08)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#cbd5e1 transparent',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: 6,
            height: 6,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 6,
            backgroundColor: '#cbd5e1',
            border: '1px solid transparent',
            backgroundClip: 'content-box',
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: '#94a3b8',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
    // Global icon sizing - more compact
    MuiSvgIcon: {
      styleOverrides: {
        fontSizeSmall: {
          fontSize: ICON_SIZES.small,
        },
        fontSizeMedium: {
          fontSize: ICON_SIZES.medium,
        },
        fontSizeLarge: {
          fontSize: ICON_SIZES.large,
        },
      },
      defaultProps: {
        fontSize: 'small',
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 9999, // pill shape
          padding: '5px 14px',
          fontSize: '0.75rem',
          fontWeight: 600,
          transition: 'all 0.2s ease',
          minHeight: 32,
          lineHeight: 1.4,
          '& .MuiButton-startIcon': {
            marginRight: 6,
            '& > *:nth-of-type(1)': {
              fontSize: ICON_SIZES.small,
            },
          },
          '& .MuiButton-endIcon': {
            marginLeft: 6,
            '& > *:nth-of-type(1)': {
              fontSize: ICON_SIZES.small,
            },
          },
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        },
        outlined: {
          borderColor: '#e2e8f0',
          '&:hover': {
            borderColor: '#cbd5e1',
            backgroundColor: alpha('#1e293b', 0.04),
          },
        },
        sizeSmall: {
          padding: '4px 12px',
          fontSize: '0.6875rem',
          minHeight: 28,
        },
        sizeMedium: {
          padding: '6px 16px',
          fontSize: '0.75rem',
          minHeight: 34,
        },
        sizeLarge: {
          padding: '8px 20px',
          fontSize: '0.8125rem',
          minHeight: 40,
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 9999,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: alpha('#1e293b', 0.08),
          },
        },
        sizeSmall: {
          padding: 4,
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.small,
          },
        },
        sizeMedium: {
          padding: 6,
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.medium,
          },
        },
        sizeLarge: {
          padding: 8,
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.large,
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#ffffff',
            transition: 'all 0.2s ease',
            '& fieldset': {
              borderColor: '#e2e8f0',
              transition: 'border-color 0.2s ease',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#94a3b8',
              borderWidth: 1,
            },
          },
          '& .MuiInputAdornment-root .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.small,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
        },
        sizeSmall: {
          fontSize: '0.75rem',
        },
        inputSizeSmall: {
          padding: '6px 10px',
        },
      },
    },
    MuiInputAdornment: {
      styleOverrides: {
        root: {
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.small,
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        select: {
          fontSize: '0.75rem',
          padding: '5px 10px',
          paddingRight: '28px !important',
        },
        icon: {
          fontSize: ICON_SIZES.small,
          right: 6,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 16,
        },
        outlined: {
          border: '1px solid #e5e7eb',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        },
        elevation3: {
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        },
        elevation4: {
          boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.625rem',
          height: 20,
          '& .MuiChip-icon': {
            fontSize: ICON_SIZES.tiny,
            marginLeft: 4,
            marginRight: -2,
          },
          '& .MuiChip-deleteIcon': {
            fontSize: ICON_SIZES.tiny,
          },
        },
        sizeSmall: {
          height: 18,
          fontSize: '0.5625rem',
        },
        sizeMedium: {
          height: 24,
          fontSize: '0.6875rem',
        },
        label: {
          paddingLeft: 8,
          paddingRight: 8,
        },
        labelSmall: {
          paddingLeft: 6,
          paddingRight: 6,
        },
        filled: {
          backgroundColor: '#f1f5f9',
          color: '#475569',
          '&:hover': {
            backgroundColor: '#e2e8f0',
          },
        },
        outlined: {
          borderColor: '#e2e8f0',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b',
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '8px 12px',
          borderRadius: 8,
        },
        arrow: {
          color: '#1e293b',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
          marginTop: 8,
        },
        list: {
          padding: '8px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: '0.75rem',
          padding: '6px 10px',
          margin: '1px 0',
          minHeight: 32,
          '& .MuiListItemIcon-root': {
            minWidth: 28,
            '& .MuiSvgIcon-root': {
              fontSize: ICON_SIZES.small,
            },
          },
          '&:hover': {
            backgroundColor: '#f8fafc',
          },
          '&.Mui-selected': {
            backgroundColor: '#f1f5f9',
            '&:hover': {
              backgroundColor: '#e2e8f0',
            },
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.125rem',
          fontWeight: 600,
          padding: '20px 24px 12px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '12px 24px 20px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '12px 24px 20px',
          gap: 8,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.875rem',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#e5e7eb',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#e2e8f0',
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          color: '#1e293b',
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: '#f1f5f9',
        },
        rounded: {
          borderRadius: 12,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontSize: '0.8125rem',
        },
        standardSuccess: {
          backgroundColor: '#ecfdf5',
          color: '#065f46',
        },
        standardError: {
          backgroundColor: '#fef2f2',
          color: '#991b1b',
        },
        standardWarning: {
          backgroundColor: '#fffbeb',
          color: '#92400e',
        },
        standardInfo: {
          backgroundColor: '#eff6ff',
          color: '#1e40af',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40,
        },
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          padding: '8px 16px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          textTransform: 'none',
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
          fontSize: '0.625rem',
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 42,
          height: 26,
          padding: 0,
        },
        switchBase: {
          padding: 0,
          margin: 2,
          transitionDuration: '200ms',
          '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
              backgroundColor: '#1e293b',
              opacity: 1,
              border: 0,
            },
          },
        },
        thumb: {
          boxSizing: 'border-box',
          width: 22,
          height: 22,
        },
        track: {
          borderRadius: 26 / 2,
          backgroundColor: '#e2e8f0',
          opacity: 1,
        },
      },
    },
    MuiCheckbox: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          padding: 4,
          color: '#cbd5e1',
          '&.Mui-checked': {
            color: '#1e293b',
          },
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.medium,
          },
        },
        sizeSmall: {
          padding: 3,
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.small,
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: '#cbd5e1',
          '&.Mui-checked': {
            color: '#1e293b',
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: '#1e293b',
        },
        thumb: {
          '&:hover, &.Mui-focusVisible': {
            boxShadow: `0 0 0 8px ${alpha('#1e293b', 0.16)}`,
          },
        },
        track: {
          height: 4,
          borderRadius: 2,
        },
        rail: {
          height: 4,
          borderRadius: 2,
          backgroundColor: '#e2e8f0',
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: 0,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          padding: '0 16px',
          minHeight: 48,
          '&.Mui-expanded': {
            minHeight: 48,
          },
        },
        content: {
          margin: '12px 0',
          '&.Mui-expanded': {
            margin: '12px 0',
          },
        },
      },
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          padding: '0 16px 16px',
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 28,
          color: '#64748b',
          '& .MuiSvgIcon-root': {
            fontSize: ICON_SIZES.small,
          },
        },
      },
    },
    MuiListItemText: {
      styleOverrides: {
        root: {
          margin: 0,
        },
        primary: {
          fontSize: '0.75rem',
          fontWeight: 500,
          lineHeight: 1.4,
        },
        secondary: {
          fontSize: '0.6875rem',
          lineHeight: 1.3,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '6px 10px',
          minHeight: 36,
          '&:hover': {
            backgroundColor: '#f8fafc',
          },
          '&.Mui-selected': {
            backgroundColor: '#f1f5f9',
            '&:hover': {
              backgroundColor: '#e2e8f0',
            },
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            borderRadius: 12,
          },
        },
      },
    },
  },
});

export default theme;
