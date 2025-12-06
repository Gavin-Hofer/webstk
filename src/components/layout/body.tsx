'use client';

import { cn } from '@/lib/utils';

export type BodyProps = React.HTMLAttributes<HTMLBodyElement>;

/**
 * Body component wrapper. Theme class is applied to html element by blocking script.
 */
export const BodyWithTheme: React.FC<BodyProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <body className={cn(className)} {...props}>
      {children}
    </body>
  );
};
