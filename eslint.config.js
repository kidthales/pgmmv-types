const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({ recommendedConfig: {} });

const tsOverride = {
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off'
  }
};

module.exports = [
  ...compat.config({
    extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    ignorePatterns: [],
    overrides: [
      {
        files: ['./**/*.ts'],
        parserOptions: { project: `${__dirname}/tsconfig.json` },
        ...tsOverride
      }
    ]
  })
];
