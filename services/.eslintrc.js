module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  parserOptions:  {
    ecmaVersion:  2018,     // Allows for the parsing of modern ECMAScript features
    sourceType:  'module',  // Allows for the use of imports
  },
  rules:  {
    '@typescript-eslint/semi': ['error'],
    'semi': 'off',
    quotes: ['warn', 'single'],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/indent': ['warn', 2],
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/camelcase': 'off'
  },
}
