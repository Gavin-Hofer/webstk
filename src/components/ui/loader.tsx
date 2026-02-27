import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type LoaderProps = React.ComponentProps<typeof Loader2>;

export const Loader: React.FC<LoaderProps> = ({ className, ...props }) => {
  return (
    <Loader2
      className={cn(
        'text-accent shadow-secondary animate-spin stroke-1 drop-shadow-[0_0_6px_currentColor]',
        className,
      )}
      {...props}
    />
  );
};
