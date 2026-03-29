import globals from 'globals'
import vuePlugin from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tseslint from 'typescript-eslint'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import importPlugin from 'eslint-plugin-import'

const vueRecommendedConfig = vuePlugin.configs['flat/recommended']
const vueRecommendedItems = Array.isArray(vueRecommendedConfig)
  ? vueRecommendedConfig
  : [vueRecommendedConfig]

export default [
  {
    ignores: [
      'node_modules',
      'vendor',
      'storage',
      'bootstrap/cache',
      'public/build',
      'public/hot',
      'public/**/*.js',
      'resources/views/**/*',
      'resources/css/**/*',
      'dist',
      'eslint.config.js',
    ],
  },

  ...vueRecommendedItems,

  {
    files: ['resources/js/**/*.{js,ts,vue,d.ts}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,

        // Vue <script setup> macros
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',

        // если используешь Ziggy (route()), раскомментируй:
        // route: 'readonly',
      },

      // Для .vue нужен vue-eslint-parser, а TS/JS внутри — typescript-eslint parser
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd(),
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      // Рекомендованные правила от @typescript-eslint
      ...tsPlugin.configs.recommended.rules,

      // Твои персональные правила (как в React-конфиге)
      '@typescript-eslint/no-empty-object-type': 'off',

      'prefer-const': 'warn',

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',

      'import/no-unresolved': 'error',

      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          ts: 'never',
          vue: 'never',
        },
      ],
    },
  },

  // Чтобы линтить конфиги/скрипты в корне (если они есть) без Vue-парсера
  {
    files: ['vite.config.{ts,js,mjs,cjs}', 'config/**/*.{ts,js,mjs,cjs}', 'scripts/**/*.{ts,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.node.json',
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.node.json',
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      '@typescript-eslint/no-empty-object-type': 'off',

      'prefer-const': 'warn',

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',

      'import/no-unresolved': 'error',

      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          ts: 'never',
        },
      ],
    },
  },
]
