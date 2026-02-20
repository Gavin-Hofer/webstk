import type { Metadata, NextPage } from 'next';
import { QrCode } from 'lucide-react';

import { QrCodeGenerator } from './components/qr-code-generator';

export const metadata: Metadata = {
  title: 'QR Code Generator | WebSTK',
  description: 'Generate QR codes from URLs directly in your browser.',
};

const Page: NextPage = () => {
  return (
    <div className='flex w-full flex-col items-center px-4 py-12 sm:px-6 sm:py-16'>
      <div className='w-full max-w-4xl'>
        <div className='mb-8 flex flex-col gap-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-md'>
              <QrCode className='h-5 w-5' />
            </div>
            <h1 className='text-2xl font-bold'>QR Code Generator</h1>
          </div>
          <p className='text-muted-foreground text-sm'>
            Enter a URL and generate a QR code instantly.
          </p>
        </div>

        <div className='border-border bg-card/50 rounded-lg border p-4 sm:p-6'>
          <QrCodeGenerator />
        </div>
      </div>
    </div>
  );
};

export default Page;
