import Link from 'next/link';
import type { NextPage, Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WebSTK',
  description: 'A collection of common simple tools.',
};

const Page: NextPage = () => {
  return (
    <div className='m-4 flex w-full max-w-4xl flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <h1 className='text-3xl'>Web Simple Toolkit</h1>
        <p className='text-lg text-gray-700'>
          I made this site for myself so I could always have quick access to
          some tools I frequently need.
        </p>
        <p className='text-lg text-gray-700'>
          If you have any suggestions or feedback, please let me know by{' '}
          <a
            href='https://github.com/Gavin-Hofer/webstk/issues'
            target='_blank'
            className='text-blue-500 hover:underline'
          >
            opening an issue on GitHub
          </a>
          .
        </p>
      </div>

      <h2 className='text-2xl'>Tools</h2>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3'>
        <Link
          href='/password-generator'
          className='flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 transition-colors duration-500 ease-out hover:bg-gray-100'
        >
          Password Generator
        </Link>
        <Link
          href='/image-converter'
          className='flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 transition-colors duration-500 ease-out hover:bg-gray-100'
        >
          Image Converter
        </Link>
      </div>
    </div>
  );
};

export default Page;
