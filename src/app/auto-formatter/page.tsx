import type { Metadata, NextPage } from 'next';

import { AutoFormatter } from './components/auto-formatter';

export const metadata: Metadata = {
  title: 'Auto Formatter | WebSTK',
  description:
    'Auto-detect and format code in various programming languages using Prettier.',
};

const Page: NextPage = () => {
  return (
    <div className='flex min-h-[calc(100vh-4rem)] w-full flex-col items-center px-4 py-6 sm:px-10 sm:py-8'>
      <div className='flex w-full max-w-8xl flex-1 flex-col'>
        <AutoFormatter />
      </div>
    </div>
  );
};

export default Page;
