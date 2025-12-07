'use client';

import { useState, useContext, useRef } from 'react';
import Editor from '@monaco-editor/react';
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
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ThemeContext } from '@/components/context/theme';

// #region Types
// =============================================================================

type SupportedLanguage = {
  label: string;
  prettierParser: BuiltInParserName | null;
  /** Monaco Editor language identifier */
  monacoLanguage: string;
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
  json: {
    label: 'JSON',
    prettierParser: 'json',
    monacoLanguage: 'json',
  },
  jsx: {
    label: 'JSX',
    prettierParser: 'babel',
    monacoLanguage: 'javascript',
  },
  javascript: {
    label: 'JavaScript',
    prettierParser: 'babel',
    monacoLanguage: 'javascript',
  },
  tsx: {
    label: 'TSX',
    prettierParser: 'typescript',
    monacoLanguage: 'typescript',
  },
  typescript: {
    label: 'TypeScript',
    prettierParser: 'typescript',
    monacoLanguage: 'typescript',
  },
  html: {
    label: 'HTML',
    prettierParser: 'html',
    monacoLanguage: 'html',
  },
  css: {
    label: 'CSS',
    prettierParser: 'css',
    monacoLanguage: 'css',
  },
  markdown: {
    label: 'Markdown',
    prettierParser: 'markdown',
    monacoLanguage: 'markdown',
  },
  yaml: {
    label: 'YAML',
    prettierParser: 'yaml',
    monacoLanguage: 'yaml',
  },
  graphql: {
    label: 'GraphQL',
    prettierParser: 'graphql',
    monacoLanguage: 'graphql',
  },
} as const satisfies Record<string, SupportedLanguage>;

type SupportedLanguageId = keyof typeof SupportedLanguages;

const SupportedLanguagesEntries = Array.from(
  Object.entries(SupportedLanguages),
) as [SupportedLanguageId, SupportedLanguage][];

// #endregion

// #region Helper Functions
// =============================================================================

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
  onSelect: (languageId: SupportedLanguageId) => void;
};

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);

  const selectedLanguage = SupportedLanguages[value];
  const displayLabel = selectedLanguage?.label ?? 'Select language';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          size='sm'
          className='bg-background h-7 justify-between rounded-none rounded-bl-2xl text-xs'
        >
          {displayLabel}
          <ChevronsUpDown className='ml-1 h-3 w-3 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[180px] p-0' align='end'>
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

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Monaco Editor language identifier */
  language: string;
  selectedLanguageId: SupportedLanguageId;
  onLanguageSelect: (languageId: SupportedLanguageId) => void;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  className,
  language,
  selectedLanguageId,
  onLanguageSelect,
}) => {
  const themeContext = useContext(ThemeContext);
  const monacoTheme = themeContext?.theme === 'dark' ? 'vs-dark' : 'light';
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={cn(
        'border-input relative overflow-hidden rounded-md border',
        className,
      )}
    >
      {/* Language selector overlay */}
      <div className='absolute top-0 right-0 z-10'>
        <LanguageSelector
          value={selectedLanguageId}
          onSelect={onLanguageSelect}
        />
      </div>
      <div className='absolute inset-0'>
        <Editor
          height='100%'
          value={value}
          onChange={(val) => onChange(val ?? '')}
          language={language}
          theme={monacoTheme}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};

// #endregion

// #region Main Component
// =============================================================================

export const AutoFormatter: React.FC = () => {
  const [code, setCode] = useState<string>('');
  const [selectedLanguageId, setSelectedLanguageId] =
    useState<SupportedLanguageId>('javascript');
  const [isFormatting, setIsFormatting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLanguage = SupportedLanguages[selectedLanguageId];

  const handleFormat = async () => {
    setError(null);
    setIsFormatting(true);

    if (!selectedLanguage.prettierParser) {
      setError('Selected language does not support formatting.');
      setIsFormatting(false);
      return;
    }

    const result = await formatCode(code, selectedLanguage.prettierParser);

    if (result.success) {
      setCode(result.formatted);
    } else {
      setError(result.error);
    }

    setIsFormatting(false);
  };

  return (
    <div className='flex flex-1 flex-col gap-6'>
      {/* Editor with integrated language selector */}
      <CodeEditor
        value={code}
        onChange={setCode}
        language={selectedLanguage.monacoLanguage}
        selectedLanguageId={selectedLanguageId}
        onLanguageSelect={setSelectedLanguageId}
        className='min-h-0 flex-1'
      />

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
