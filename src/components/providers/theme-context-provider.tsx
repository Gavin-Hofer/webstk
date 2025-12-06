'use client';

import { createContext, useState, useMemo } from 'react';

// #region Types
// =============================================================================

export type Theme = 'light' | 'dark';

// #endregion

// #region Context
// =============================================================================

export type ThemeContext = {
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
};
export const ThemeContext = createContext<ThemeContext | undefined>(undefined);

// #endregion

// #region Main Component
// =============================================================================

export type ThemeContextProviderProps = React.PropsWithChildren<{
  storedTheme?: Theme;
}>;

export const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({
  storedTheme,
  children,
}) => {
  const [theme, setTheme] = useState(storedTheme ?? 'light');
  const contextValue = useMemo(() => {
    return { theme, setTheme } satisfies ThemeContext;
  }, [theme]);
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// #endregion
