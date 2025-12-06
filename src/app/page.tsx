import Link from 'next/link';
import type { NextPage, Metadata } from 'next';
import { KeyRound, ImageIcon, ArrowRight, Github } from 'lucide-react';

import { cn } from '@/lib/utils';

// #region Constants
// =============================================================================

export const metadata: Metadata = {
  title: 'WebSTK',
  description: 'A collection of free client-side web tools.',
};

// #endregion

// #region Subcomponents
// =============================================================================

const ToolCard: React.FC<{
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ href, icon, title, description }) => {
  return (
    <Link
      href={href}
      className={cn(
        'group border-border bg-card/50 relative flex flex-col gap-3 rounded-lg border p-6',
        'transition-all duration-300',
        'hover:border-primary/50 hover:bg-card hover:shadow-primary/5 hover:shadow-lg',
        'dark:hover:shadow-primary/10',
      )}
    >
      <div className='flex items-center justify-between'>
        <div className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md'>
          {icon}
        </div>
        <ArrowRight className='text-muted-foreground group-hover:text-primary h-5 w-5 transition-transform duration-300 group-hover:translate-x-1' />
      </div>
      <div className='flex flex-col gap-1'>
        <h3 className='font-semibold'>{title}</h3>
        <p className='text-muted-foreground text-sm'>{description}</p>
      </div>
    </Link>
  );
};

// #endregion

// #region Main Component
// =============================================================================

const Page: NextPage = () => {
  return (
    <div className='flex w-full flex-col items-center px-4 py-12 sm:px-6 sm:py-16'>
      {/* Hero Section */}
      <section className='flex w-full max-w-4xl flex-col items-center gap-6 text-center'>
        <h1 className='text-4xl font-bold tracking-tight sm:text-5xl'>
          Web Simple Toolkit
        </h1>
        <p className='text-muted-foreground max-w-2xl text-lg'>
          A collection of free, client-side utilities. All processing happens in
          your browser—nothing is sent to any server.
        </p>
      </section>

      {/* Tools Section */}
      <section className='mt-16 w-full max-w-4xl'>
        <h2 className='text-muted-foreground mb-6 text-sm font-medium tracking-wider uppercase'>
          Available Tools
        </h2>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <ToolCard
            href='/password-generator'
            icon={<KeyRound className='h-6 w-6' />}
            title='Password Generator'
            description='Generate secure random passwords with customizable length and character sets.'
          />
          <ToolCard
            href='/image-converter'
            icon={<ImageIcon className='h-6 w-6' />}
            title='Image Converter'
            description='Convert images between formats like PNG, JPEG, and WebP directly in your browser.'
          />
        </div>
      </section>

      {/* Footer info */}
      <section className='border-border mt-16 w-full max-w-4xl border-t pt-8'>
        <div className='text-muted-foreground flex flex-col items-center gap-4 text-center text-sm'>
          <p>
            Open source and free to use. Suggestions and contributions welcome.
          </p>
          <a
            href='https://github.com/Gavin-Hofer/webstk/issues'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:text-primary/80 inline-flex items-center gap-2 transition-colors'
          >
            <Github className='h-4 w-4' />
            Open an issue on GitHub
          </a>
        </div>
      </section>
    </div>
  );
};

// #endregion

// #region Exports
// =============================================================================

export default Page;

// #endregion
