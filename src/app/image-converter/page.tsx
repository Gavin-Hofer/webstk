'use client';

import type { NextPage } from 'next';
import { useState, useEffect } from 'react';

import convertImage from './utils/convert-image';
import { ImageFormats, type ImageFormat } from './utils/image-formats';

const Page: NextPage = () => {
  const [file, setFile] = useState<File | null>(null);

  const [previews, setPreviews] = useState<
    { format: ImageFormat; file: File }[]
  >([]);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      alert('No file');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Invalid file type');
      return;
    }
    if (file.type.endsWith('heic')) {
      
    }
    ImageFormats.forEach((format) => {
      convertImage(file, { format, width: 64, height: 64 }).then((file) => {
        setPreviews((curr) => [...curr, { format, file }]);
      });
    });
  };

  return (
    <div className='m-4 flex w-full flex-col gap-4'>
      <h1 className='text-2xl font-bold'>Image Converter</h1>
      <input type='file' accept='image/*' onChange={handleInputChange} />

      <div className='flex flex-row flex-wrap gap-8'>
        {previews.map(({ format, file }) => {
          const objectUrl = URL.createObjectURL(file);
          return (
            <a key={format} href={objectUrl} download={file.name}>
              <h3 className='text-xl font-semibold'>{format}</h3>
              <p className='text-lg'>Actual: {file.type}</p>
              <img src={URL.createObjectURL(file)} />
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default Page;
