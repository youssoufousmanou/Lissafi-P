import { DefaultTheme } from '@react-navigation/native';

export const colors = {
  primary: '#0f766e',
  primaryDark: '#115e59',
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
};

export const spacing = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const theme = {
  colors,
  spacing,
  navigation: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  },
};
