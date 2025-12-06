import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics';

import { ReactQueryClientProvider } from '@/components/providers/react-query-client-provider';
import { Header } from '@/components/layout/header/header';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'WebSTK',
  description: 'A collection of common simple tools.',
};

// #region RootLayout
// =============================================================================

const RootLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <html lang='en'>
      <head>
        <link
          rel='apple-touch-icon'
          sizes='180x180'
          href='/apple-touch-icon.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='32x32'
          href='/favicon-32x32.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='16x16'
          href='/favicon-16x16.png'
        />
        <link rel='icon' href='/favicon.ico' />
        <link rel='manifest' href='/site.webmanifest' />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header />
        <main className='flex w-full items-center justify-center'>
          <ReactQueryClientProvider>{children}</ReactQueryClientProvider>
          <Analytics />
        </main>
      </body>
    </html>
  );
};

// #region Exports
// =============================================================================

export default RootLayout;
