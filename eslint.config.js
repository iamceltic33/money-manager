const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  {
    ignores: ['.expo/**', 'dist/**', 'supabase/.temp/**'],
  },
  expoConfig,
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration FunctionDeclaration, FunctionExpression FunctionDeclaration, ArrowFunctionExpression FunctionDeclaration',
          message: 'Внутри функций объявляйте обработчики через const и стрелочную функцию.',
        },
      ],
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
