import type { NextPage, Metadata } from 'next';
import { Code2 } from 'lucide-react';

import { AutoFormatter } from './components/auto-formatter';

export const metadata: Metadata = {
  title: 'Auto Formatter | WebSTK',
  description:
    'Auto-detect and format code in various programming languages using Prettier.',
};

const Page: NextPage = () => {
  return (
    <div className='flex min-h-[calc(100vh-4rem)] w-full flex-col items-center px-4 py-6 sm:px-6 sm:py-8'>
      <div className='flex w-full max-w-7xl flex-1 flex-col'>
        {/* Header */}
        <div className='mb-8 flex flex-col gap-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md'>
              <Code2 className='h-5 w-5' />
            </div>
            <h1 className='text-2xl font-bold'>Auto Formatter</h1>
          </div>
          <p className='text-muted-foreground text-sm'>
            Paste your code below and it will be automatically formatted using
            Prettier. The programming language is auto-detected, or you can
            select it manually.
          </p>
        </div>

        {/* Formatter */}
        <div className='border-border bg-card/50 flex min-h-[max(calc(100vh-16rem),16rem)] flex-col overflow-hidden rounded-lg border p-6'>
          <AutoFormatter />
        </div>
      </div>
    </div>
  );
};

export default Page;
