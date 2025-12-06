'use client';

import { FileUpIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export const AddImageFilesInput: React.FC<{
  onChange?: (files: FileList) => void;
}> = ({ onChange }) => {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    if (onChange && event.target.files) {
      onChange(event.target.files);
    }
    event.target.value = '';
  };

  return (
    <label
      className={cn(
        buttonVariants({ variant: 'default', size: 'lg' }),
        'w-full cursor-pointer sm:w-auto',
      )}
    >
      <FileUpIcon className='h-5 w-5' />
      Add images
      <input
        type='file'
        accept='image/*'
        className='hidden'
        onChange={handleChange}
        multiple
      />
    </label>
  );
};
