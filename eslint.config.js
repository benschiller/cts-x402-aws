import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    files: ['src/**/*.ts'], // Apply this configuration to all .ts files in src
    rules: {
      // Add any specific ESLint rules here
      // For example, to disallow implicit any (which caused errors before)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "off", // Often useful in early development
      // You can customize rules as needed
    },
  },
  {
    ignores: ['.eslintrc.js', 'build/', 'node_modules/'], // Files/directories to ignore
  }
);