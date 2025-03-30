'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { useNotification, type Notification } from '@/hooks/use-notification';

// #region Form Schema
// =============================================================================

const formSchema = z.object({
  length: z.coerce
    .number()
    .min(1, {
      message: 'Password length must be at least 1.',
    })
    .max(65536, {
      message: 'Password length must be at most 65536.',
    }),
  includeLowercase: z.boolean(),
  includeUppercase: z.boolean(),
  includeNumbers: z.boolean(),
  includeSymbols: z.boolean(),
});

// #region Component
// =============================================================================

export const PasswordGenerator: React.FC = () => {
  const copyNotification = useNotification();
  const [password, setPassword] = useState<string>('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      length: 16,
      includeLowercase: true,
      includeUppercase: true,
      includeNumbers: true,
      includeSymbols: true,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const password = generateRandomPassword(values.length, values);
    setPassword(password);
    navigator.clipboard.writeText(password);
    copyNotification.trigger();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-8'
      >
        <div className='flex flex-col gap-4'>
          <NumericInputField
            form={form}
            name='length'
            label='Password Length'
            description='The number of characters in the password.'
          />
          <div className='flex flex-row flex-wrap gap-4'>
            <CheckboxField
              form={form}
              name='includeLowercase'
              label='Include Lowercase'
            />
            <CheckboxField
              form={form}
              name='includeUppercase'
              label='Include Uppercase'
            />
            <CheckboxField
              form={form}
              name='includeNumbers'
              label='Include Numbers'
            />
            <CheckboxField
              form={form}
              name='includeSymbols'
              label='Include Symbols'
            />
          </div>
        </div>
        <div className='flex justify-end'>
          <Button
            type='submit'
            disabled={
              !form.formState.isValid ||
              !(
                form.getValues('includeLowercase') ||
                form.getValues('includeUppercase') ||
                form.getValues('includeNumbers') ||
                form.getValues('includeSymbols')
              )
            }
          >
            Generate Password
          </Button>
        </div>
      </form>
      <div className='flex flex-col gap-2'>
        <PasswordDisplay
          password={password}
          notification={copyNotification}
          setPassword={setPassword}
        />
        <PasswordCopiedNotification notification={copyNotification} />
      </div>
    </Form>
  );
};

// #region Form Fields
// =============================================================================

const NumericInputField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
  name: keyof z.infer<typeof formSchema>;
  label: string;
  description?: string;
}> = ({ form, name, label, description }) => {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl className='flex items-center justify-center'>
            <Input
              type='number'
              min={1}
              max={65536}
              step={1}
              ref={field.ref}
              name={field.name}
              disabled={field.disabled}
              value={field.value as number}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

const CheckboxField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
  name: keyof z.infer<typeof formSchema>;
  label: string;
  description?: string;
}> = ({ form, name, label, description }) => {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className='flex items-end gap-2'>
            <FormControl className='flex items-center justify-center'>
              <Checkbox
                ref={field.ref}
                name={field.name}
                disabled={field.disabled}
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormLabel className='cursor-pointer'>{label}</FormLabel>
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

// #region Subcomponents
// =============================================================================

const PasswordDisplay: React.FC<{
  password: string;
  notification: Notification;
  setPassword: (password: string) => void;
}> = ({ password, notification, setPassword }) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  function handleCopyPassword() {
    navigator.clipboard.writeText(password);
    notification.trigger();
  }

  return (
    <div className='flex flex-col gap-2'>
      <FormLabel className='text-lg'>Generated Password</FormLabel>
      <div className='flex min-h-10 w-full cursor-text select-none rounded-md border border-input bg-background text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:text-sm'>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete='off'
          className='w-full cursor-text select-text overflow-x-auto text-nowrap rounded-md border-none px-3 py-2 focus:outline-hidden focus:ring-0 focus-visible:outline-hidden focus-visible:ring-0'
        />
        {/* show/hide and copy button */}
        <div className='flex items-center justify-evenly gap-2 rounded-r-md border-l px-2'>
          <button
            type='button'
            className='flex items-center justify-evenly gap-2 rounded-md border border-input bg-transparent px-2 py-1 transition-colors duration-500 ease-out hover:bg-secondary disabled:opacity-50 md:w-20'
            onPointerDown={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ?
              <EyeOffIcon className='h-4 w-4' />
            : <EyeIcon className='h-4 w-4' />}
            <span>{showPassword ? 'Hide' : 'Show'}</span>
          </button>
          <button
            type='button'
            disabled={password.length === 0}
            className='flex items-center justify-evenly gap-2 rounded-md border border-input bg-transparent px-2 py-1 transition-colors duration-500 ease-out hover:bg-secondary disabled:opacity-50 md:w-20'
            onPointerDown={handleCopyPassword}
          >
            <CopyIcon className='h-4 w-4' />
            <span>Copy</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const PasswordCopiedNotification: React.FC<{ notification: Notification }> = ({
  notification,
}) => {
  if (!notification.show) return null;
  return (
    <div className='flex w-full items-center justify-center'>
      <div
        className={cn(
          'flex items-center justify-evenly gap-2 rounded-lg border border-green-800 bg-green-50 px-4 py-2',
          'transition-opacity duration-500 ease-out',
          notification.transparent && 'opacity-0',
        )}
      >
        <CheckIcon className='h-4 w-4' />
        <p>Password copied to clipboard!</p>
      </div>
    </div>
  );
};

// #region Utilities
// =============================================================================

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * Generates a random password based on the given options.
 *
 * @param length - The length of the password to generate.
 * @param options - The options for the password generation.
 * @returns The generated password.
 */
function generateRandomPassword(
  length: number,
  options: {
    includeLowercase: boolean;
    includeUppercase: boolean;
    includeNumbers: boolean;
    includeSymbols: boolean;
  },
): string {
  if (!window.crypto) {
    throw new Error('Crypto API not available.');
  }
  const charSet = [
    options.includeLowercase ? LOWERCASE : '',
    options.includeUppercase ? UPPERCASE : '',
    options.includeNumbers ? NUMBERS : '',
    options.includeSymbols ? SYMBOLS : '',
  ].join('');
  if (charSet.length === 0) {
    throw new Error('No character set selected.');
  }

  const indices = Array.from(
    window.crypto.getRandomValues(new Uint8Array(length)),
  );
  const password = indices
    .map((index) => charSet[index % charSet.length])
    .join('');

  return password;
}
