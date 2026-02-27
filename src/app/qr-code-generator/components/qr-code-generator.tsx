'use client';

import { useEffect, useMemo, useState } from 'react';

import { parseAsString, useQueryState } from 'nuqs';
import { QRCodeSVG } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const urlQueryParser = parseAsString
  .withDefault('')
  .withOptions({ history: 'replace', shallow: true });

const isValidUrl = (value: string): boolean => {
  if (value.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const QrCodeGenerator: React.FC = () => {
  const [queryUrl, setQueryUrl] = useQueryState('url', urlQueryParser);
  const [inputUrl, setInputUrl] = useState<string>(queryUrl);
  const [generatedUrl, setGeneratedUrl] = useState<string>(queryUrl);

  useEffect(() => {
    setInputUrl(queryUrl);
    setGeneratedUrl(queryUrl);
  }, [queryUrl]);

  const trimmedInput = useMemo(() => inputUrl.trim(), [inputUrl]);
  const canGenerate = isValidUrl(trimmedInput);
  const hasChanged = trimmedInput !== generatedUrl;

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    setGeneratedUrl(trimmedInput);
    await setQueryUrl(trimmedInput);
  };

  const handleReset = async () => {
    setInputUrl('');
    setGeneratedUrl('');
    await setQueryUrl(null);
  };

  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'>
      <form
        className='flex flex-col gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          void handleGenerate();
        }}
      >
        <div className='flex flex-col gap-2'>
          <label htmlFor='qr-url' className='text-sm font-medium'>
            URL
          </label>
          <Input
            id='qr-url'
            type='url'
            inputMode='url'
            autoComplete='off'
            placeholder='https://example.com'
            value={inputUrl}
            onChange={(event) => {
              setInputUrl(event.target.value);
            }}
          />
          <p className='text-muted-foreground text-xs'>
            Use a full URL with http:// or https://
          </p>
        </div>

        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button
            type='submit'
            disabled={!canGenerate || !hasChanged}
            className='flex-1'
          >
            Generate QR Code
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={inputUrl.length === 0 && generatedUrl.length === 0}
            onClick={() => {
              void handleReset();
            }}
          >
            Reset
          </Button>
        </div>
      </form>

      <section className='flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed p-4'>
        <div className='bg-background flex h-64 w-64 items-center justify-center rounded-lg p-4 shadow-sm'>
          {generatedUrl.length > 0 ?
            <QRCodeSVG
              value={generatedUrl}
              size={224}
              level='M'
              marginSize={5}
              className='h-56 w-56'
            />
          : <p className='text-muted-foreground text-center text-sm'>
              Enter a valid URL, then click generate.
            </p>
          }
        </div>
      </section>
    </div>
  );
};
