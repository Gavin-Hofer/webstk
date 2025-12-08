'use client';

import { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Settings2, RotateCcw } from 'lucide-react';
import { useLocalStorage } from 'usehooks-ts';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// #region Constants
// =============================================================================

const STORAGE_KEY = 'prettier-settings';

// #endregion

// #region Schema
// =============================================================================

/**
 * Zod schema for Prettier configuration options.
 * This schema matches the structure of a `.prettierrc` file.
 */
export const prettierConfigSchema = z.object({
  // Formatting options from doc.printer.Options
  printWidth: z.number().int().min(1).max(1000),
  tabWidth: z.number().int().min(1).max(16),
  useTabs: z.boolean(),

  // Core formatting options from RequiredOptions
  semi: z.boolean(),
  singleQuote: z.boolean(),
  jsxSingleQuote: z.boolean(),
  trailingComma: z.enum(['none', 'es5', 'all']),
  bracketSpacing: z.boolean(),
  bracketSameLine: z.boolean(),
  arrowParens: z.enum(['avoid', 'always']),
  proseWrap: z.enum(['always', 'never', 'preserve']),
  htmlWhitespaceSensitivity: z.enum(['css', 'strict', 'ignore']),
  endOfLine: z.enum(['auto', 'lf', 'crlf', 'cr']),
  quoteProps: z.enum(['as-needed', 'consistent', 'preserve']),
  singleAttributePerLine: z.boolean(),
  embeddedLanguageFormatting: z.enum(['auto', 'off']),

  // Pragma options
  requirePragma: z.boolean(),
  insertPragma: z.boolean(),

  // Vue options
  vueIndentScriptAndStyle: z.boolean(),

  // Object formatting (Prettier 3.5.0+)
  objectWrap: z.enum(['preserve', 'collapse']),

  // Experimental options
  experimentalOperatorPosition: z.enum(['start', 'end']),
  experimentalTernaries: z.boolean(),
});

export type PrettierConfig = z.infer<typeof prettierConfigSchema>;

/**
 * Partial schema that allows missing fields - used for parsing imported configs.
 * Missing fields will be filled with defaults.
 */
const partialPrettierConfigSchema = prettierConfigSchema.partial();

const DEFAULT_CONFIG: PrettierConfig = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  proseWrap: 'preserve',
  htmlWhitespaceSensitivity: 'css',
  endOfLine: 'lf',
  quoteProps: 'as-needed',
  singleAttributePerLine: false,
  embeddedLanguageFormatting: 'auto',
  requirePragma: false,
  insertPragma: false,
  vueIndentScriptAndStyle: false,
  objectWrap: 'preserve',
  experimentalOperatorPosition: 'end',
  experimentalTernaries: true,
};

// #endregion

// #region Subcomponents
// =============================================================================

type FormLabelWithTooltipProps = React.ComponentProps<typeof FormLabel> & {
  title: React.ReactNode;
};

const FormLabelWithTooltip: React.FC<FormLabelWithTooltipProps> = ({
  title,
  children,
  ...props
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <FormLabel {...props}>{children}</FormLabel>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
};

type NumericFieldProps = {
  name: keyof PrettierConfig;
  label: string;
  description: string;
  min?: number;
  max?: number;
};

const NumericField: React.FC<NumericFieldProps> = ({
  name,
  label,
  description,
  min = 1,
  max = 1000,
}) => {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className='grid grid-cols-[1fr_100px] items-center gap-x-4'>
          <div className='space-y-0.5'>
            <FormLabelWithTooltip title={name}>{label}</FormLabelWithTooltip>
            <FormDescription className='text-xs'>{description}</FormDescription>
          </div>
          <FormControl>
            <Input
              type='number'
              min={min}
              max={max}
              step={1}
              className='-mx-2 h-8 font-mono text-sm'
              value={field.value as number}
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          </FormControl>
          <FormMessage className='col-span-2' />
        </FormItem>
      )}
    />
  );
};

type BooleanFieldProps = {
  name: keyof PrettierConfig;
  label: string;
  description: string;
};

const BooleanField: React.FC<BooleanFieldProps> = ({
  name,
  label,
  description,
}) => {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className='flex items-start gap-3 space-y-0'>
          <FormControl>
            <Checkbox
              checked={field.value as boolean}
              onCheckedChange={field.onChange}
              className='mt-1 ml-1'
            />
          </FormControl>
          <div className='space-y-0.5'>
            <FormLabelWithTooltip
              title={name}
              className='cursor-pointer font-normal'
            >
              {label}
            </FormLabelWithTooltip>
            <FormDescription className='text-xs'>{description}</FormDescription>
          </div>
        </FormItem>
      )}
    />
  );
};

type SelectFieldProps = {
  name: keyof PrettierConfig;
  label: string;
  description: string;
  options: { value: string; label: string }[];
};

const SelectField: React.FC<SelectFieldProps> = ({
  name,
  label,
  description,
  options,
}) => {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem className='grid grid-cols-[1fr_140px] items-center gap-x-4'>
          <div className='space-y-0.5'>
            <FormLabelWithTooltip title={name}>{label}</FormLabelWithTooltip>
            <FormDescription className='text-xs'>{description}</FormDescription>
          </div>
          <Select value={field.value as string} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className='-mx-2 h-8 text-sm'>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage className='col-span-2' />
        </FormItem>
      )}
    />
  );
};

// #endregion

// #region Main Component
// =============================================================================

export type PrettierSettingsModalProps = React.PropsWithChildren<{
  className?: string;
}>;

/**
 * Modal dialog for configuring Prettier settings.
 *
 * Settings are persisted to local storage and can be imported from a
 * `.prettierrc` JSON file or pasted directly. Changes are saved immediately
 * when valid. Use the `usePrettierConfig` hook to access the current config.
 */
export const PrettierSettingsModal: React.FC<PrettierSettingsModalProps> = ({
  children,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [storedConfig, setStoredConfig] = useLocalStorage<PrettierConfig>(
    STORAGE_KEY,
    DEFAULT_CONFIG,
  );

  const form = useForm<PrettierConfig>({
    resolver: zodResolver(prettierConfigSchema),
    defaultValues: storedConfig,
  });

  // Auto-save valid changes to storage
  useEffect(() => {
    const subscription = form.watch((values) => {
      const result = prettierConfigSchema.safeParse(values);
      if (result.success) {
        setStoredConfig(result.data);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, setStoredConfig]);

  const handleReset = useCallback(() => {
    form.reset(DEFAULT_CONFIG);
    setImportError(null);
  }, [form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='icon'
          className={cn('h-8 w-8', className)}
        >
          {children ?? (
            <>
              <Settings2 className='h-4 w-4' />
              <span className='sr-only'>Prettier Settings</span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Prettier Settings</DialogTitle>
          <DialogDescription>
            Configure formatting options. Changes are saved automatically and
            used for all code formatting.
          </DialogDescription>
          ∂
        </DialogHeader>

        {/* Import error */}
        {importError && (
          <div className='bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-3 py-2 text-sm'>
            {importError}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={() => setOpen(false)}>
            <Accordion type='multiple' defaultValue={[]} className='w-full'>
              {/* Layout section */}
              <AccordionItem value='layout'>
                <AccordionTrigger>Layout</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <NumericField
                    name='printWidth'
                    label='Print Width'
                    description='Line length the printer will wrap on'
                    max={1000}
                  />
                  <NumericField
                    name='tabWidth'
                    label='Tab Width'
                    description='Spaces per indentation level'
                    max={16}
                  />
                  <BooleanField
                    name='useTabs'
                    label='Use Tabs'
                    description='Indent with tabs instead of spaces'
                  />
                </AccordionContent>
              </AccordionItem>

              {/* JavaScript/TypeScript section */}
              <AccordionItem value='javascript'>
                <AccordionTrigger>JavaScript / TypeScript</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <BooleanField
                    name='semi'
                    label='Semicolons'
                    description='Print semicolons at the ends of statements'
                  />
                  <BooleanField
                    name='singleQuote'
                    label='Single Quotes'
                    description='Use single quotes instead of double quotes'
                  />
                  <BooleanField
                    name='jsxSingleQuote'
                    label='JSX Single Quotes'
                    description='Use single quotes in JSX'
                  />
                  <SelectField
                    name='trailingComma'
                    label='Trailing Commas'
                    description='Print trailing commas wherever possible'
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'es5', label: 'ES5' },
                      { value: 'all', label: 'All' },
                    ]}
                  />
                  <BooleanField
                    name='bracketSpacing'
                    label='Bracket Spacing'
                    description='Print spaces between brackets in object literals'
                  />
                  <SelectField
                    name='arrowParens'
                    label='Arrow Parentheses'
                    description='Parentheses around single arrow function parameter'
                    options={[
                      { value: 'always', label: 'Always' },
                      { value: 'avoid', label: 'Avoid' },
                    ]}
                  />
                  <SelectField
                    name='quoteProps'
                    label='Quote Props'
                    description='When to quote object properties'
                    options={[
                      { value: 'as-needed', label: 'As Needed' },
                      { value: 'consistent', label: 'Consistent' },
                      { value: 'preserve', label: 'Preserve' },
                    ]}
                  />
                  <SelectField
                    name='objectWrap'
                    label='Object Wrap'
                    description='How to wrap object literals'
                    options={[
                      { value: 'preserve', label: 'Preserve' },
                      { value: 'collapse', label: 'Collapse' },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* HTML/JSX section */}
              <AccordionItem value='html-jsx'>
                <AccordionTrigger>HTML / JSX</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <BooleanField
                    name='bracketSameLine'
                    label='Bracket Same Line'
                    description='Put > of multi-line elements at end of last line'
                  />
                  <BooleanField
                    name='singleAttributePerLine'
                    label='Single Attribute Per Line'
                    description='Enforce single attribute per line in HTML/JSX'
                  />
                  <SelectField
                    name='htmlWhitespaceSensitivity'
                    label='HTML Whitespace'
                    description='How to handle whitespace in HTML'
                    options={[
                      { value: 'css', label: 'CSS' },
                      { value: 'strict', label: 'Strict' },
                      { value: 'ignore', label: 'Ignore' },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Markdown section */}
              <AccordionItem value='markdown'>
                <AccordionTrigger>Markdown</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <SelectField
                    name='proseWrap'
                    label='Prose Wrap'
                    description='How to wrap markdown text'
                    options={[
                      { value: 'preserve', label: 'Preserve' },
                      { value: 'always', label: 'Always' },
                      { value: 'never', label: 'Never' },
                    ]}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Vue section */}
              <AccordionItem value='vue'>
                <AccordionTrigger>Vue</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <BooleanField
                    name='vueIndentScriptAndStyle'
                    label='Indent Script and Style'
                    description='Indent contents of script and style tags in Vue files'
                  />
                </AccordionContent>
              </AccordionItem>

              {/* General section */}
              <AccordionItem value='general'>
                <AccordionTrigger>General</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <SelectField
                    name='endOfLine'
                    label='End of Line'
                    description='Line ending style'
                    options={[
                      { value: 'lf', label: 'LF (Unix)' },
                      { value: 'crlf', label: 'CRLF (Windows)' },
                      { value: 'cr', label: 'CR' },
                      { value: 'auto', label: 'Auto' },
                    ]}
                  />
                  <SelectField
                    name='embeddedLanguageFormatting'
                    label='Embedded Formatting'
                    description='Format embedded code in template strings'
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: 'off', label: 'Off' },
                    ]}
                  />
                  <BooleanField
                    name='requirePragma'
                    label='Require Pragma'
                    description='Only format files containing @format pragma'
                  />
                  <BooleanField
                    name='insertPragma'
                    label='Insert Pragma'
                    description='Add @format pragma to formatted files'
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Experimental section */}
              <AccordionItem value='experimental'>
                <AccordionTrigger>Experimental</AccordionTrigger>
                <AccordionContent className='space-y-4'>
                  <SelectField
                    name='experimentalOperatorPosition'
                    label='Operator Position'
                    description='Position of operators when breaking lines'
                    options={[
                      { value: 'end', label: 'End of line' },
                      { value: 'start', label: 'Start of line' },
                    ]}
                  />
                  <BooleanField
                    name='experimentalTernaries'
                    label='Experimental Ternaries'
                    description='Use new ternary formatting style'
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className='flex justify-end gap-2 pt-4'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleReset}
              >
                <RotateCcw className='mr-2 h-4 w-4' />
                Restore Defaults
              </Button>
              <Button type='button' size='sm' onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// #endregion

// #region Hooks
// =============================================================================

/**
 * Hook to access the current Prettier configuration from local storage.
 *
 * @returns The current Prettier configuration.
 */
export function usePrettierConfig(): PrettierConfig {
  const [config] = useLocalStorage<PrettierConfig>(STORAGE_KEY, DEFAULT_CONFIG);
  return config;
}

// #endregion
