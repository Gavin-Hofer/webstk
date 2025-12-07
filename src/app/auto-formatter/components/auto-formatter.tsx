'use client';

import { useState, useEffect, useMemo } from 'react';
import hljs from 'highlight.js';
import type { BuiltInParserName, Plugin } from 'prettier';
import * as prettier from 'prettier/standalone';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginHtml from 'prettier/plugins/html';
import * as prettierPluginCss from 'prettier/plugins/postcss';
import * as prettierPluginMarkdown from 'prettier/plugins/markdown';
import * as prettierPluginTypescript from 'prettier/plugins/typescript';
import * as prettierPluginYaml from 'prettier/plugins/yaml';
import * as prettierPluginGraphql from 'prettier/plugins/graphql';
import { CheckIcon, WandSparkles, ChevronsUpDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

// #region Types
// =============================================================================

type SupportedLanguage = {
  label: string;
  prettierParser: BuiltInParserName | null;
  hljsLanguages: readonly string[];
};

// #endregion

// #region Constants
// =============================================================================

// Note: estree plugin has incomplete type definitions in Prettier, requiring this cast
const ALL_PLUGINS: Plugin[] = [
  prettierPluginBabel,
  prettierPluginEstree as Plugin,
  prettierPluginHtml,
  prettierPluginCss,
  prettierPluginMarkdown,
  prettierPluginTypescript,
  prettierPluginYaml,
  prettierPluginGraphql,
];

// #endregion

// #region Lookup Tables
// =============================================================================

const SupportedLanguages = {
  auto: {
    label: 'Auto-detect',
    prettierParser: null,
    hljsLanguages: [],
  },
  javascript: {
    label: 'JavaScript',
    prettierParser: 'babel',
    hljsLanguages: ['javascript', 'js'],
  },
  typescript: {
    label: 'TypeScript',
    prettierParser: 'typescript',
    hljsLanguages: ['typescript', 'ts'],
  },
  jsx: {
    label: 'JSX',
    prettierParser: 'babel',
    hljsLanguages: ['jsx'],
  },
  tsx: {
    label: 'TSX',
    prettierParser: 'typescript',
    hljsLanguages: ['tsx'],
  },
  json: {
    label: 'JSON',
    prettierParser: 'json',
    hljsLanguages: ['json'],
  },
  html: {
    label: 'HTML',
    prettierParser: 'html',
    hljsLanguages: ['html', 'xml'],
  },
  css: {
    label: 'CSS',
    prettierParser: 'css',
    hljsLanguages: ['css'],
  },
  markdown: {
    label: 'Markdown',
    prettierParser: 'markdown',
    hljsLanguages: ['markdown', 'md'],
  },
  yaml: {
    label: 'YAML',
    prettierParser: 'yaml',
    hljsLanguages: ['yaml', 'yml'],
  },
  graphql: {
    label: 'GraphQL',
    prettierParser: 'graphql',
    hljsLanguages: ['graphql'],
  },
} as const satisfies Record<string, SupportedLanguage>;

type SupportedLanguageId = keyof typeof SupportedLanguages;

const SupportedLanguagesEntries = Array.from(
  Object.entries(SupportedLanguages),
) as [SupportedLanguageId, SupportedLanguage][];

const HljsToSupportedLanguage = new Map<string, SupportedLanguage>(
  Object.entries(SupportedLanguages).flatMap(([id, lang]) => {
    return lang.hljsLanguages.map(
      (name) => [name, lang] as [string, SupportedLanguage],
    );
  }),
);

// #endregion

// #region Helper Functions
// =============================================================================

/**
 * Detects the programming language of the given code using highlight.js.
 */
function detectLanguage(code: string): SupportedLanguage | null {
  if (!code.trim()) {
    return null;
  }

  const result = hljs.highlightAuto(code);
  const detectedLang = result.language;

  if (!detectedLang) {
    return null;
  }

  return HljsToSupportedLanguage.get(detectedLang) ?? null;
}

type FormatCodeResult =
  | { success: true; formatted: string }
  | { success: false; error: string };

/**
 * Formats code using Prettier with the specified parser.
 */
async function formatCode(
  code: string,
  parser: BuiltInParserName,
): Promise<FormatCodeResult> {
  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins: ALL_PLUGINS,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'all',
      printWidth: 80,
    });
    return { success: true, formatted };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// #endregion

// #region Subcomponents
// =============================================================================

type LanguageSelectorProps = {
  value: SupportedLanguageId;
  detectedLanguage: SupportedLanguage | null;
  onSelect: (languageId: SupportedLanguageId) => void;
};

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  detectedLanguage,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);

  const selectedLanguage = SupportedLanguages[value];
  const displayLabel =
    value === 'auto' && detectedLanguage ?
      `Auto-detect (${detectedLanguage.label})`
    : (selectedLanguage?.label ?? 'Select language');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between sm:w-[240px]'
        >
          {displayLabel}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-full p-0 sm:w-[240px]'>
        <Command>
          <CommandInput placeholder='Search language...' />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {SupportedLanguagesEntries.map(([id, language]) => (
                <CommandItem
                  key={id}
                  value={id}
                  onSelect={() => {
                    onSelect(id);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {language.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

type CodeTextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
};

const CodeTextArea: React.FC<CodeTextAreaProps> = ({
  value,
  onChange,
  placeholder,
  readOnly = false,
  className,
}) => {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      spellCheck={false}
      className={cn(
        'bg-background border-input placeholder:text-muted-foreground text:md min-h-10 w-full rounded-md border px-3 py-2 font-mono sm:text-sm',
        'focus:border-ring focus:ring-ring focus:ring-1 focus:outline-none',
        readOnly && 'bg-muted/50',
        className,
      )}
    />
  );
};

// #endregion

// #region Main Component
// =============================================================================

export const AutoFormatter: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [selectedLanguageId, setSelectedLanguageId] =
    useState<SupportedLanguageId>('auto');
  const [isFormatting, setIsFormatting] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const detectedLanguage = useMemo(() => {
    return detectLanguage(code);
  }, [code]);

  const handleFormat = async () => {
    setError(null);
    setIsFormatting(true);

    const languageToUse =
      selectedLanguageId === 'auto' ? detectedLanguage : (
        SupportedLanguages[selectedLanguageId]
      );

    if (!languageToUse?.prettierParser) {
      setError('Could not detect language. Please select a language manually.');
      setIsFormatting(false);
      return;
    }

    const result = await formatCode(code, languageToUse.prettierParser);

    if (result.success) {
      setCode(result.formatted);
    } else {
      setError(result.error);
    }

    setIsFormatting(false);
  };

  return (
    <div className='flex flex-1 flex-col gap-6'>
      {/* Language selector */}
      <div className='flex flex-col gap-2'>
        <label className='text-sm font-medium'>Language</label>
        <LanguageSelector
          value={selectedLanguageId}
          detectedLanguage={detectedLanguage}
          onSelect={setSelectedLanguageId}
        />
      </div>

      {/* Input */}
      <div className='flex min-h-0 flex-1 flex-col gap-2'>
        <label className='text-sm font-medium'>Input Code</label>
        <CodeTextArea
          value={code}
          onChange={setCode}
          placeholder='Paste your code here...'
          className='flex-1'
        />
      </div>

      {/* Format button */}
      <Button
        onClick={handleFormat}
        disabled={!code.trim() || isFormatting}
        className='w-full'
      >
        {isFormatting ?
          <Loader2 className='h-4 w-4 animate-spin' />
        : <WandSparkles className='h-4 w-4' />}
        {isFormatting ? 'Formatting...' : 'Format Code'}
      </Button>

      {/* Error message */}
      {error && (
        <div className='bg-destructive/10 text-destructive border-destructive/20 rounded-md border px-4 py-3 text-sm'>
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
};

// #endregion
