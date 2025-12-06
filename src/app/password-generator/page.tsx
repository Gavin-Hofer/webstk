import type { NextPage, Metadata } from 'next';
import { Shield } from 'lucide-react';

import { PasswordGenerator } from './components/password-generator';

// #region Constants
// =============================================================================

export const metadata: Metadata = {
  title: 'Password Generator | WebSTK',
  description: 'A simple client-side random password generator.',
};

// #endregion

// #region Main Component
// =============================================================================

const Page: NextPage = () => {
  return (
    <div className='flex w-full flex-col items-center px-4 py-12 sm:px-6 sm:py-16'>
      <div className='w-full max-w-xl'>
        {/* Header */}
        <div className='mb-8 flex flex-col gap-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md'>
              <Shield className='h-5 w-5' />
            </div>
            <h1 className='text-2xl font-bold'>Password Generator</h1>
          </div>
          <p className='text-muted-foreground text-sm'>
            Generate cryptographically secure random passwords. Everything runs
            locally in your browser—nothing is stored or transmitted.
          </p>
        </div>

        {/* Generator */}
        <div className='border-border bg-card/50 rounded-lg border p-6'>
          <PasswordGenerator />
        </div>
      </div>
    </div>
  );
};

// #endregion

// #region Exports
// =============================================================================

export default Page;

// #endregion
