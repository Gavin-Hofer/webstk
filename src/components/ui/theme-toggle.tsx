'use client';

import { useContext } from 'react';
import { Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ThemeContext } from '@/components/providers/theme-context-provider';

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
        'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full',
        'text-foreground/70 hover:text-foreground',
        'hover:bg-muted transition-colors duration-500 ease-out',
        'focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
        className,
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' && <Moon size={20} />}
      {theme === 'dark' && <Sun size={20} />}
    </button>
  );
};
