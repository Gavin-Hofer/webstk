'use client';

import { createContext, useState, useMemo, useEffect, useContext } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

// #region Types
// =============================================================================

export type Theme = 'light' | 'dark';

// #endregion

// #region Helper functions
// =============================================================================

/**
 * Gets the initial theme from localStorage or system preference.
 * Must match the logic in the blocking script in layout.tsx.
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ?
        'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

// #endregion

// #region Context
// =============================================================================

export type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

// #endregion

// #region Components
// =============================================================================

/**
 * Inline blocking script that applies the theme class before the first paint.
 * Must use dangerouslySetInnerHTML to ensure synchronous execution.
 */
export const ThemeScript: React.FC = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function() {
          try {
            var theme = localStorage.getItem('theme');
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            }
          } catch (e) {}
        })();`,
      }}
    />
  );
};

/**
 * Toggle button for switching between light and dark themes.
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({
  className,
}) => {
  const themeContext = useContext(ThemeContext);

  if (!themeContext) {
    return null;
  }
  const { theme, setTheme } = themeContext;

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full',
        'text-foreground transition-colors duration-300',
        'hover:bg-secondary',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      suppressHydrationWarning
    >
      <Moon
        size={18}
        className={cn(theme !== 'light' && 'hidden')}
        suppressHydrationWarning
      />
      <Sun
        size={18}
        className={cn(theme !== 'dark' && 'hidden')}
        suppressHydrationWarning
      />
    </button>
  );
};

// #endregion

// #region Context Provider
// =============================================================================

/**
 * Provides theme context and persists the user's theme preference to localStorage.
 */
export const ThemeContextProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (error) {
      console.error('Error setting theme in localStorage:', error);
    }
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Sync class on mount in case hydration state differs from blocking script
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  const contextValue = useMemo(
    () => ({ theme, setTheme }) satisfies ThemeContextValue,
    [theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// #endregion
