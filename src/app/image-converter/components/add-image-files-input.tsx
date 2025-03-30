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
        buttonVariants({ variant: 'default' }),
        'h-12 w-full cursor-pointer px-8 text-lg sm:w-fit [&_svg]:size-6',
      )}
    >
      <FileUpIcon />
      Add image files
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
