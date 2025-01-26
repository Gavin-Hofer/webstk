import type { NextPage } from 'next';

import { PasswordGenerator } from './components/password-generator';

const Page: NextPage = () => {
  return (
    <div className='m-4 flex w-full max-w-2xl flex-col gap-4'>
      <h1 className='text-2xl font-bold'>Simple Password Generator</h1>
      <p className='text-sm text-gray-500'>
        This is a simple, client-side random password generator. Your password
        is generated on the client side and is not sent to the server. We will
        not store your password or any other information.
      </p>
      <PasswordGenerator />
    </div>
  );
};

export default Page;
