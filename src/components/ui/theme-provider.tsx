import * as React from 'react';
import { defaultTheme } from '../../lib/terminal-themes/default.js';

export type BorderStyle = 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';

export interface ColorTokens {
  primary: string; primaryForeground: string;
  secondary: string; secondaryForeground: string;
  accent: string; accentForeground: string;
  success: string; successForeground: string;
  warning: string; warningForeground: string;
  error: string; errorForeground: string;
  info: string; infoForeground: string;
  background: string; foreground: string;
  muted: string; mutedForeground: string;
  border: string; focusRing: string;
  selection: string; selectionForeground: string;
}

export interface SpacingTokens { 0: number; 1: number; 2: number; 3: number; 4: number; 6: number; 8: number; }
export interface TypographyTokens { bold: boolean; sm: string; base: string; lg: string; xl: string; }
export interface BorderTokens { style: BorderStyle; color: string; focusColor: string; }
export interface Theme { name: string; colors: ColorTokens; spacing: SpacingTokens; typography: TypographyTokens; border: BorderTokens; }

const ThemeContext = React.createContext<{ setTheme: (t: Theme) => void; theme: Theme }>({
  setTheme: () => {},
  theme: defaultTheme,
});

export const ThemeProvider = ({ children, theme = defaultTheme }: { children: React.ReactNode; theme?: Theme }) => {
  const [currentTheme, setCurrentTheme] = React.useState(theme);
  React.useEffect(() => { setCurrentTheme(theme); }, [theme]);

  return React.createElement(ThemeContext.Provider, {
    value: React.useMemo(() => ({ setTheme: setCurrentTheme, theme: currentTheme }), [currentTheme]),
  }, children);
};

export const useTheme = (): Theme => React.useContext(ThemeContext).theme;
export const useThemeUpdater = () => React.useContext(ThemeContext).setTheme;
export const createTheme = (overrides: Partial<Theme> & { name: string }): Theme => ({
  ...defaultTheme, ...overrides,
  border: { ...defaultTheme.border, ...overrides.border },
  colors: { ...defaultTheme.colors, ...overrides.colors },
  spacing: { ...defaultTheme.spacing, ...overrides.spacing },
  typography: { ...defaultTheme.typography, ...overrides.typography },
});
