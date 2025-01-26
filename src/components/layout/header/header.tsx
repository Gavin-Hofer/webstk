import Link from 'next/link';
import { GithubIcon } from '@/components/icons/github-icon';

export const Header: React.FC = () => {
  return (
    <header className='sticky top-0 z-10 h-10 w-full bg-white shadow-md'>
      <nav className='flex h-full w-full justify-between gap-6 px-4'>
        <div className='flex h-full items-center gap-4'>
          <Link className='text-lg tracking-widest' href='/'>
            QuickToolKit
          </Link>
        </div>
        <div className='flex h-full items-center gap-4'>
          <a
            href={process.env.NEXT_PUBLIC_GITHUB_REPO_URL ?? ''}
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
