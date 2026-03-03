'use client';

import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import Editor, { loader } from '@monaco-editor/react';
import hljs from 'highlight.js';
import { CheckIcon, ChevronsUpDown, Loader2, WandSparkles } from 'lucide-react';
import type { BuiltInParserName, Plugin } from 'prettier';
import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginGraphql from 'prettier/plugins/graphql';
import * as prettierPluginHtml from 'prettier/plugins/html';
import * as prettierPluginMarkdown from 'prettier/plugins/markdown';
import * as prettierPluginCss from 'prettier/plugins/postcss';
import * as prettierPluginTypescript from 'prettier/plugins/typescript';
import * as prettierPluginYaml from 'prettier/plugins/yaml';
import * as prettier from 'prettier/standalone';

import { ThemeContext } from '@/components/context/theme';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  PrettierSettingsModal,
  usePrettierConfig,
  type PrettierConfig,
} from './prettier-settings-modal';

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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
 * Formats code using Prettier with the specified parser and config.
 */
async function formatCode(
  code: string,
  parser: BuiltInParserName,
  config: PrettierConfig,
): Promise<FormatCodeResult> {
  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins: ALL_PLUGINS,
      ...config,
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
  // @ts-expect-error: language may not be in the mapping
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return HljsToSupportedLanguageId[language] ?? 'audo';
}

// #endregion

// #region Subcomponents
// =============================================================================

type LanguageSelectorProps = {
  selectedLanguageId: SupportedLanguageId;
  detectedLanguageId: SupportedLanguageId;
  onSelect: (languageId: SupportedLanguageId) => void;
  className?: string;
};

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguageId,
  detectedLanguageId,
  onSelect,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const selectedLanguage = SupportedLanguages[selectedLanguageId];
  const detectedLanguage = SupportedLanguages[detectedLanguageId];
  const displayLabel =
    selectedLanguageId === 'auto' ?
      detectedLanguageId === 'auto' ?
        'Auto'
      : `Auto (${detectedLanguage.label})`
    : selectedLanguage.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          size='sm'
          className={className}
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
                  className={cn(selectedLanguageId !== id && 'cursor-pointer')}
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
  const [editorStatus, setEditorStatus] = useState<
    'loading' | 'ready' | 'failed'
  >('loading');
  const [editorInstanceKey, setEditorInstanceKey] = useState(0);
  const [isMonacoConfigured, setIsMonacoConfigured] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    void import('monaco-editor')
      .then((monacoRuntime) => {
        if (isCancelled) {
          return;
        }

        loader.config({ monaco: monacoRuntime });
        setIsMonacoConfigured(true);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setEditorStatus('failed');
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editorStatus !== 'loading') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setEditorStatus('failed');
    }, 10_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorStatus, editorInstanceKey]);
  const monacoEditorLanguage =
    selectedLanguageId === 'auto' ?
      detectedLanguageId === 'auto' ?
        undefined
      : SupportedLanguages[detectedLanguageId].monacoLanguage
    : SupportedLanguages[selectedLanguageId].monacoLanguage;

  return (
    <div
      ref={containerRef}
      className={cn(
        'border-input relative overflow-hidden rounded-md border',
        className,
      )}
    >
      {/* Toolbar overlay */}
      <div className='bg-monaco-editor/50 absolute top-0 right-0 z-10 flex w-full justify-end border-b'>
        <LanguageSelector
          selectedLanguageId={selectedLanguageId}
          detectedLanguageId={detectedLanguageId}
          onSelect={onLanguageSelect}
          className='bg-background h-8 justify-between rounded-none rounded-bl-2xl border-t-0 border-r-0 text-xs'
        />
        <PrettierSettingsModal className='bg-background h-8 w-8 rounded-none rounded-tr-md border-t-0 border-r-0 border-l-0' />
      </div>
      <div className='absolute inset-0 pt-8'>
        {editorStatus === 'failed' ?
          <div
            data-testid='editor-load-error'
            className='bg-muted/30 text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-center'
          >
            <p className='max-w-xl text-sm'>
              The code editor failed to load. Check your network or dependency
              setup, then retry.
            </p>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => {
                setEditorStatus('loading');
                setEditorInstanceKey((current) => current + 1);
              }}
            >
              Retry editor
            </Button>
          </div>
        : isMonacoConfigured ?
          <Editor
            key={editorInstanceKey}
            height='100%'
            loading={
              <div className='text-muted-foreground p-4 text-sm'>
                Loading editor...
              </div>
            }
            value={value}
            onMount={() => {
              setEditorStatus('ready');
            }}
            onChange={(val) => {
              onChange(val ?? '');
            }}
            language={monacoEditorLanguage}
            theme={monacoTheme}
            options={{
              minimap: { enabled: true },
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
            beforeMount={(monacoInstance) => {
              // Enable JSX support in the TypeScript compiler
              monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions(
                {
                  jsx: monacoInstance.languages.typescript.JsxEmit.React,
                  jsxFactory: 'React.createElement',
                  reactNamespace: 'React',
                  allowNonTsExtensions: true,
                  allowJs: true,
                  target:
                    monacoInstance.languages.typescript.ScriptTarget.Latest,
                },
              );
              monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions(
                {
                  jsx: monacoInstance.languages.typescript.JsxEmit.React,
                  jsxFactory: 'React.createElement',
                  reactNamespace: 'React',
                  allowNonTsExtensions: true,
                  allowJs: true,
                  target:
                    monacoInstance.languages.typescript.ScriptTarget.Latest,
                },
              );

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
              monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
                {
                  noSemanticValidation: true,
                  noSyntaxValidation: false,
                  diagnosticCodesToIgnore,
                },
              );
              monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
                {
                  noSemanticValidation: true,
                  noSyntaxValidation: false,
                  diagnosticCodesToIgnore,
                },
              );
            }}
          />
        : <div className='text-muted-foreground p-4 text-sm'>
            Loading editor...
          </div>
        }
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
  const prettierConfig = usePrettierConfig();

  const detectedLanguageId = useMemo(() => {
    return detectLanguage(code);
  }, [code]);

  const prettierParser =
    selectedLanguageId === 'auto' ?
      detectedLanguageId === 'auto' ?
        null
      : SupportedLanguages[detectedLanguageId].prettierParser
    : SupportedLanguages[selectedLanguageId].prettierParser;

  const handleFormat = async () => {
    setError(null);
    setIsFormatting(true);

    if (!prettierParser) {
      setError('Selected language does not support formatting.');
      setIsFormatting(false);
      return;
    }

    const result = await formatCode(code, prettierParser, prettierConfig);

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

      {/* Format button and settings */}
      <div className='flex gap-2'>
        <Button
          onClick={() => {
            void handleFormat();
          }}
          disabled={!code.trim() || isFormatting || !prettierParser}
          className='flex-1'
        >
          {isFormatting ?
            <Loader2 className='h-4 w-4 animate-spin' />
          : <WandSparkles className='h-4 w-4' />}
          {isFormatting ? 'Formatting...' : 'Format Code'}
        </Button>
      </div>

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
