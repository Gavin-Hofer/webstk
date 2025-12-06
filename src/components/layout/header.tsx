import Link from 'next/link';
import { Roboto_Mono } from 'next/font/google';

import { GithubIcon } from '@/components/icons/github-icon';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ui/theme-toggle';

// #region Constants
// =============================================================================

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
});

// #endregion

// #region Main Component
// =============================================================================

/**
 * Site header with navigation and theme controls.
 */
export const Header: React.FC = () => {
  return (
    <header className='bg-card/80 border-border/50 sticky top-0 z-10 h-14 w-full border-b backdrop-blur-md'>
      <nav className='mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6'>
        <Link
          className={cn(
            'group flex items-center gap-2 text-lg font-medium tracking-[0.3em] transition-colors duration-300',
            'text-foreground hover:text-primary',
            robotoMono.variable,
            robotoMono.className,
          )}
          href='/'
        >
          <span className='bg-primary inline-block h-2 w-2 rounded-full transition-shadow duration-300 group-hover:shadow-[0_0_8px_var(--glow)]' />
          WEBSTK
        </Link>
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <a
            href='https://github.com/Gavin-Hofer/webstk'
            target='_blank'
            rel='noopener noreferrer'
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-300',
              'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
            aria-label='View source on GitHub'
          >
            <GithubIcon size={20} />
          </a>
        </div>
      </nav>
    </header>
  );
};

// #endregion
