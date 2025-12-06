import Link from 'next/link';
import { Roboto_Mono } from 'next/font/google';

import { GithubIcon } from '@/components/icons/github-icon';
import { cn } from '@/lib/utils';

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
});

export const Header: React.FC = () => {
  return (
    <header className='sticky top-0 z-10 h-10 w-full bg-white shadow-md'>
      <nav className='flex h-full w-full justify-between gap-6 px-4'>
        <div className='flex h-full items-center gap-4'>
          <Link
            className={cn(
              'text-lg tracking-widest',
              robotoMono.variable,
              robotoMono.className,
            )}
            href='/'
          >
            WEBSTK
          </Link>
        </div>
        <div className='flex h-full items-center gap-4'>
          <a
            href='https://github.com/Gavin-Hofer/webstk'
            target='_blank'
            rel='noopener noreferrer'
          >
            <GithubIcon size={24} />
          </a>
        </div>
      </nav>
    </header>
  );
};
