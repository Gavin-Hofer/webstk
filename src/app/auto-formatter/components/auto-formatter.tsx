'use client';

import { useState, useContext, useRef, useEffect, useMemo } from 'react';
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
import hljs from 'highlight.js';
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
  monacoLanguage: string | null;
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
    label: 'Auto',
    prettierParser: null,
    monacoLanguage: null,
  },
  json: {
    label: 'JSON',
    prettierParser: 'json',
    monacoLanguage: 'json',
  },
  javascript: {
    label: 'JavaScript',
    prettierParser: 'babel',
    monacoLanguage: 'javascript',
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

const HljsToSupportedLanguageId = {
  auto: 'auto',
  json: 'json',
  javascript: 'javascript',
  typescript: 'typescript',
  xml: 'html',
  css: 'css',
  scss: 'css',
  markdown: 'markdown',
  yaml: 'yaml',
  graphql: 'graphql',
} as const satisfies Record<string, SupportedLanguageId>;

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

function detectLanguage(code: string): SupportedLanguageId {
  // First check if the code is valid JSON to prevent it from being
  // misinterpreted as something else.
  try {
    JSON.parse(code);
    return 'json';
  } catch {
    // Not valid JSON.
  }
  const languageSubset = Array.from(Object.keys(HljsToSupportedLanguageId));
  const result = hljs.highlightAuto(code, languageSubset);
  const language = result.language ?? 'auto';
  // @ts-expect-error
  return HljsToSupportedLanguageId[language] ?? 'audo';
}

// #endregion

// #region Subcomponents
// =============================================================================

type LanguageSelectorProps = {
  selectedLanguageId: SupportedLanguageId;
  detectedLanguageId: SupportedLanguageId;
  onSelect: (languageId: SupportedLanguageId) => void;
};

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguageId,
  detectedLanguageId,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);

  const selectedLanguage = SupportedLanguages[selectedLanguageId];
  const detectedLanguage = SupportedLanguages[detectedLanguageId];
  const displayLabel =
    selectedLanguageId !== 'auto' ? selectedLanguage.label
    : detectedLanguageId !== 'auto' ? `Auto (${detectedLanguage.label})`
    : 'Select Language';

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
                      selectedLanguageId === id ? 'opacity-100' : 'opacity-0',
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
  selectedLanguageId: SupportedLanguageId;
  detectedLanguageId: SupportedLanguageId;
  onLanguageSelect: (languageId: SupportedLanguageId) => void;
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  className,
  selectedLanguageId,
  detectedLanguageId,
  onLanguageSelect,
}) => {
  const themeContext = useContext(ThemeContext);
  const monacoTheme = themeContext?.theme === 'dark' ? 'vs-dark' : 'light';
  const containerRef = useRef<HTMLDivElement>(null);
  const monacoEditorLanguage =
    selectedLanguageId !== 'auto' ?
      SupportedLanguages[selectedLanguageId].monacoLanguage
    : detectedLanguageId !== 'auto' ?
      SupportedLanguages[detectedLanguageId].monacoLanguage
    : undefined;

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
          selectedLanguageId={selectedLanguageId}
          detectedLanguageId={detectedLanguageId}
          onSelect={onLanguageSelect}
        />
      </div>
      <div className='absolute inset-0'>
        <Editor
          height='100%'
          value={value}
          onChange={(val) => onChange(val ?? '')}
          language={monacoEditorLanguage}
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
          beforeMount={(monaco) => {
            // Enable JSX support in the TypeScript compiler
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
              jsx: monaco.languages.typescript.JsxEmit.React,
              jsxFactory: 'React.createElement',
              reactNamespace: 'React',
              allowNonTsExtensions: true,
              allowJs: true,
              target: monaco.languages.typescript.ScriptTarget.Latest,
            });
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
              jsx: monaco.languages.typescript.JsxEmit.React,
              jsxFactory: 'React.createElement',
              reactNamespace: 'React',
              allowNonTsExtensions: true,
              allowJs: true,
              target: monaco.languages.typescript.ScriptTarget.Latest,
            });

            // Disable semantic validation, keep syntax errors
            // Ignore 80xx codes (TypeScript-only feature errors when in JS mode)
            const diagnosticCodesToIgnore = [
              8006, // 'import type' can only be used in TypeScript files
              8008, // 'type aliases' can only be used in TypeScript files
              8010, // 'export type' can only be used in TypeScript files
              8011, // Property access modifiers can only be used in TypeScript files
              8016, // Type annotation can only be used in TypeScript files
              8017, // 'interface' can only be used in TypeScript files
            ];
            monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
              {
                noSemanticValidation: true,
                noSyntaxValidation: false,
                diagnosticCodesToIgnore,
              },
            );
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
              {
                noSemanticValidation: true,
                noSyntaxValidation: false,
                diagnosticCodesToIgnore,
              },
            );
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
  const [selectedLanguageId, setSelectedLanguageId] = useState<
    SupportedLanguageId | 'auto'
  >('auto');
  const [isFormatting, setIsFormatting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedLanguageId = useMemo(() => {
    return detectLanguage(code);
  }, [code]);

  const prettierParser =
    selectedLanguageId !== 'auto' ?
      SupportedLanguages[selectedLanguageId].prettierParser
    : detectedLanguageId !== 'auto' ?
      SupportedLanguages[detectedLanguageId].prettierParser
    : null;

  const handleFormat = async () => {
    setError(null);
    setIsFormatting(true);

    if (!prettierParser) {
      setError('Selected language does not support formatting.');
      setIsFormatting(false);
      return;
    }

    const result = await formatCode(code, prettierParser);

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
        selectedLanguageId={selectedLanguageId}
        detectedLanguageId={detectedLanguageId}
        onLanguageSelect={setSelectedLanguageId}
        className='min-h-0 flex-1'
      />

      {/* Format button */}
      <Button
        onClick={handleFormat}
        disabled={!code.trim() || isFormatting || !prettierParser}
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
