'use client';

import { useContext } from 'react';
import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ThemeContext } from '@/components/providers/theme-context-provider';

// #region Main Component
// =============================================================================

export const ThemeToggle: React.FC<{ className?: string }> = ({
  className,
}) => {
  const themeContext = useContext(ThemeContext);
  if (!themeContext) {
    return null;
  }
  const { theme, setTheme } = themeContext;

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md',
        'text-muted-foreground transition-colors duration-300',
        'hover:bg-secondary hover:text-foreground',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        className,
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' && <Moon size={18} />}
      {theme === 'dark' && <Sun size={18} />}
    </button>
  );
};

// #endregion
