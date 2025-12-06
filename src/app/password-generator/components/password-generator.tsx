'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCw,
} from 'lucide-react';

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
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';

// #region Constants
// =============================================================================

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

// #endregion

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

type PasswordFormData = z.infer<typeof formSchema>;

// #endregion

// #region Helper Functions
// =============================================================================

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

// #endregion

// #region Subcomponents
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
          <FormControl>
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
              className='font-mono'
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
}> = ({ form, name, label }) => {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className='flex items-center gap-2 space-y-0'>
          <FormControl>
            <Checkbox
              ref={field.ref}
              name={field.name}
              disabled={field.disabled}
              checked={field.value as boolean}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormLabel className='cursor-pointer text-sm font-normal'>
            {label}
          </FormLabel>
        </FormItem>
      )}
    />
  );
};

type GeneratePasswordButtonProps = {
  form: UseFormReturn<PasswordFormData>;
  animationKey: number;
};

const GeneratePasswordButton: React.FC<GeneratePasswordButtonProps> = ({
  form,
  animationKey,
}) => {
  return (
    <Button
      type='submit'
      className='w-full'
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
      <RefreshCw
        key={animationKey}
        className={cn(
          'h-4 w-4',
          animationKey > 0 && 'animate-[spin-once_500ms_ease-out]',
        )}
      />
      Generate Password
    </Button>
  );
};

const PasswordDisplay: React.FC<{
  password: string;
  notification: Notification;
  setPassword: (password: string) => void;
  animationKey: number;
}> = ({ password, notification, setPassword, animationKey }) => {
  const [showPassword, setShowPassword] = useState<boolean>(false);

  function handleCopyPassword() {
    navigator.clipboard.writeText(password).then(
      () => notification.trigger(),
      (error) => console.error('Failed to copy password:', error),
    );
  }

  return (
    <div className='flex flex-col gap-2'>
      <span className='text-sm font-medium'>Generated Password</span>
      <div className='flex items-center gap-2'>
        <div
          key={animationKey}
          className={cn(
            'bg-background border-input flex min-h-10 flex-1 items-center overflow-hidden rounded-md border',
            animationKey > 0 && 'animate-[border-flash_600ms_ease-out]',
          )}
        >
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='off'
            placeholder='Click generate to create a password'
            className='placeholder:text-muted-foreground w-full flex-1 bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:font-sans'
          />
        </div>
        <Button
          type='button'
          variant='outline'
          size='icon'
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ?
            <EyeOffIcon className='h-4 w-4' />
          : <EyeIcon className='h-4 w-4' />}
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          disabled={password.length === 0 || !navigator.clipboard}
          onClick={handleCopyPassword}
          aria-label='Copy password'
        >
          <CopyIcon className='h-4 w-4' />
        </Button>
      </div>
    </div>
  );
};

// #endregion

// #region Main Component
// =============================================================================

export const PasswordGenerator: React.FC = () => {
  const copyNotification = useNotification();
  const [password, setPassword] = useState<string>('');
  const [animationKey, setAnimationKey] = useState(0);

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

  const onSubmit = (values: PasswordFormData) => {
    const newPassword = generateRandomPassword(values.length, values);
    setPassword(newPassword);
    setAnimationKey((prev) => prev + 1);

    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(newPassword).then(
      () => copyNotification.trigger(),
      (error) => console.error('Failed to copy password:', error),
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className='flex flex-col gap-6'
      >
        {/* Length input */}
        <NumericInputField
          form={form}
          name='length'
          label='Password Length'
          description='Number of characters (1-65536)'
        />

        {/* Character options */}
        <div className='flex flex-col gap-3'>
          <span className='text-sm font-medium'>Character Types</span>
          <div className='grid grid-cols-2 gap-3 sm:flex sm:flex-wrap'>
            <CheckboxField
              form={form}
              name='includeLowercase'
              label='Lowercase'
            />
            <CheckboxField
              form={form}
              name='includeUppercase'
              label='Uppercase'
            />
            <CheckboxField form={form} name='includeNumbers' label='Numbers' />
            <CheckboxField form={form} name='includeSymbols' label='Symbols' />
          </div>
        </div>
        <GeneratePasswordButton form={form} animationKey={animationKey} />

        {/* Output section */}
        <div className='border-border border-t pt-6'>
          <Popover open={copyNotification.show}>
            <PopoverAnchor>
              <PasswordDisplay
                password={password}
                notification={copyNotification}
                setPassword={setPassword}
                animationKey={animationKey}
              />
            </PopoverAnchor>
            <PopoverContent
              className={cn(
                'bg-background/60 w-fit rounded-md border-none p-0 shadow-none',
                'transition-opacity duration-500 ease-out',
                copyNotification.transparent && 'opacity-0',
              )}
            >
              <div className='bg-primary/10 text-primary inline-flex w-full items-center gap-2 rounded-md border px-4 py-2 text-sm shadow-md outline-hidden'>
                <CheckIcon className='h-4 w-4' />
                Password copied to clipboard
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </form>
    </Form>
  );
};

// #endregion
