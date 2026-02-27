import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import unusedImports from 'eslint-plugin-unused-imports';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.strictTypeChecked,
  eslintPluginUnicorn.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.reference/**',
    'playwright-report/**',
    'src/__generated__/**',
    'public/**',
    'postcss.config.mjs',
    'eslint.config.mjs',
    '**/__generated__.ts',
  ]),
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@next/next/no-img-element': 'off',
      'no-unused-vars': 'off', // using unused-imports plugin instead
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          // Allow unused vars if they are prefixed with `_`
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      // Warn for unexpected console logs
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // Disallows use of '==' instead of '==='
      eqeqeq: 'error',

      // Disallow if and loop blocks without curly braces
      curly: 'error',

      // Prefer const over let if the variable is not later mutated
      'prefer-const': 'error',

      // Allow calling setState synchronously in a useEffect
      'react-hooks/set-state-in-effect': 'off',

      // Disallow variables with the same name as variable in the enclosing scope
      '@typescript-eslint/no-shadow': 'error',

      // Prefer readonly class members
      '@typescript-eslint/prefer-readonly': 'error',

      // Allow non-string values in template expressions
      '@typescript-eslint/restrict-template-expressions': 'off',

      // Consistent array type syntax (prefer T[] over Array<T>)
      '@typescript-eslint/array-type': ['error', { default: 'array' }],

      // Consistent method signature style
      '@typescript-eslint/method-signature-style': ['error', 'property'],

      // Prefer for-of over index-based for loops when not using index
      '@typescript-eslint/prefer-for-of': 'error',

      // Switch exhaustiveness (helps with discriminated unions)
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // No useless empty exports
      '@typescript-eslint/no-useless-empty-export': 'error',

      // Disallow unsafe type assertions
      '@typescript-eslint/no-unsafe-type-assertion': 'error',

      // Prefer type of interface
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // Restrict type assertions
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],

      // These are handled by typescript and eslint is too slow
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',

      // Allow abbreviations
      'unicorn/prevent-abbreviations': 'off',

      // Allow reduceRight
      'unicorn/no-array-reduce': 'off',

      // Allow use of `window`
      'unicorn/prefer-global-this': 'off',

      // Allow null
      'unicorn/no-null': 'off',

      // Allow forEach
      'unicorn/no-array-for-each': 'off',

      // Allow `String#split('')`
      'unicorn/prefer-spread': 'off',

      // Allow nested ternaries
      'unicorn/no-nested-ternary': 'off',

      // Allow "useless" undefined
      'unicorn/no-useless-undefined': 'off',

      // Allow passing children as a prop
      'react/no-children-prop': 'off',

      // Allow any name for catch error
      'unicorn/catch-error-name': 'off',

      // Allow any async function scoping (required for scoped server actions)
      'unicorn/consistent-function-scoping': 'off',
      '@typescript-eslint/require-await': 'off',

      // This messes with zod's catch method
      'unicorn/prefer-top-level-await': 'off',

      // AWS SES requires uppercase 'UTF-8'
      'unicorn/text-encoding-identifier-case': 'off',

      // Allow ternaries in JSX
      'unicorn/prefer-logical-operator-over-ternary': 'off',

      // Allow lowercase hex numbers
      'unicorn/number-literal-case': 'off',
    },
  },
]);

export default eslintConfig;
