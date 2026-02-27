import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.reference/**'],
  },
  {
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
