import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { ReactQueryClientProvider } from '@/components/context/react-query';
import { Header } from '@/components/layout/header';
import { BodyWithTheme } from '@/components/layout/body';
import { ParallaxBackgroundGrid } from '@/components/layout/paralax-background-grid';
import { cn } from '@/lib/utils';
import { ThemeContextProvider, ThemeScript } from '@/components/context/theme';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Loader } from '@/components/ui/loader';

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

const RootLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <ThemeScript />
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
      <ThemeContextProvider>
        <BodyWithTheme
          className={cn(
            geistSans.variable,
            geistMono.variable,
            'relative h-full min-h-screen w-full antialiased',
          )}
        >
          <ParallaxBackgroundGrid className='min-h-screen opacity-50' />
          <Header className='h-14' />
          <main className='flex h-full min-h-[calc(100vh-3.5rem)] w-full items-center justify-center'>
            <ReactQueryClientProvider>
              <Suspense fallback={<Loader className='size-20 stroke-[0.5]' />}>
                {children}
              </Suspense>
            </ReactQueryClientProvider>
            <Analytics />
            <SpeedInsights />
          </main>
        </BodyWithTheme>
      </ThemeContextProvider>
    </html>
  );
};

export default RootLayout;
