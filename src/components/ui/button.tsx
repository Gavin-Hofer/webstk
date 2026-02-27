import * as React from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium',
    'transition-all duration-300 ease-out cursor-pointer',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    'disabled:cursor-default disabled:pointer-events-none disabled:opacity-50',
    'data-[disabled=true]:cursor-default data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary/10 text-primary border border-primary/50',
          'hover:bg-primary/15 hover:border-primary/70',
          'active:bg-primary/10 active:border-primary/50',
        ),
        destructive: cn(
          'bg-destructive/15 text-destructive border border-destructive/60',
          'hover:bg-destructive/25 hover:border-destructive/80',
        ),
        outline: cn(
          'border border-input bg-transparent shadow-sm',
          'hover:bg-secondary hover:text-secondary-foreground',
        ),
        secondary: cn(
          'bg-secondary text-secondary-foreground shadow-sm',
          'hover:bg-secondary/80',
        ),
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = {
  asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        type='button'
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
