module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  plugins: ['jest'],
  extends: ['airbnb-base', 'plugin:jest/recommended'],
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    // Ignore end of file in windows
    // 'linebreak-style': 0,
    // ignore console
    'no-console': 0,
  },
};
