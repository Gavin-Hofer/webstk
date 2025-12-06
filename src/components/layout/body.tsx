'use client';

import { useContext } from 'react';

import { cn } from '@/lib/utils';
import { ThemeContext } from '../providers/theme-context-provider';

// #region Types
// =============================================================================

export type BodyProps = React.HTMLAttributes<HTMLBodyElement>;

// #endregion

// #region Main Component
// =============================================================================

export const BodyWithTheme: React.FC<BodyProps> = ({
  children,
  className,
  ...props
}) => {
  const themeContext = useContext(ThemeContext);
  const darkMode = themeContext?.theme === 'dark';
  return (
    <body className={cn(darkMode && 'dark', className)} {...props}>
      {children}
    </body>
  );
};

// #endregion
