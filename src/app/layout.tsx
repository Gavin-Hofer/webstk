import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ReactQueryClientProvider } from '@/components/context/react-query';
import { ThemeContextProvider, ThemeScript } from '@/components/context/theme';
import { BodyWithTheme } from '@/components/layout/body';
import { Header } from '@/components/layout/header';
import { ParallaxBackgroundGrid } from '@/components/layout/paralax-background-grid';
import { Loader } from '@/components/ui/loader';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import './globals.css';

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
            <NuqsAdapter>
              <ReactQueryClientProvider>
                <Toaster />
                <TooltipProvider>
                  <Suspense
                    fallback={<Loader className='size-20 stroke-[0.5]' />}
                  >
                    {children}
                  </Suspense>
                </TooltipProvider>
              </ReactQueryClientProvider>
            </NuqsAdapter>
            <Analytics />
            <SpeedInsights />
          </main>
        </BodyWithTheme>
      </ThemeContextProvider>
    </html>
  );
};

export default RootLayout;
