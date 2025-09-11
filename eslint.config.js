import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import svelte from 'eslint-plugin-svelte';
import svelteConfig from './svelte.config.js';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.prettier,
  eslintPluginPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  globalIgnores([
    'node_modules/**',
    'build/**',
    '.svelte-kit/**',
    '**/*.generated.ts',
    'static/**',
  ]),
  {
    files: ['src/**/*.svelte', 'src/**/*.svelte.js', 'src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'], // Add support for additional file extensions, such as .svelte
        parser: tseslint.parser,
        // We recommend importing and specifying svelte.config.js.
        // By doing so, some rules in eslint-plugin-svelte will automatically read the configuration and adjust their behavior accordingly.
        // While certain Svelte settings may be statically loaded from svelte.config.js even if you don’t specify it,
        // explicitly specifying it ensures better compatibility and functionality.
        svelteConfig,
      },
    },
  },
  {
    rules: {
      // Override or add rule settings here, such as:
      // 'svelte/rule-name': 'error'
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
