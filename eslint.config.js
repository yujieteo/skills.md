import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "eslint.config.js"] },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Power of 10 rule 7: check every return value; discard one only with an explicit `void`.
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }], // an underscore marks a parameter an interface requires
      "@typescript-eslint/restrict-plus-operands": ["error", { allowNumberAndString: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/consistent-type-definitions": "off", // style only: type and interface declare the same shape here
      "@typescript-eslint/strict-boolean-expressions": "off", // style only: the code tests strings and arrays for emptiness on purpose
      "@typescript-eslint/no-confusing-void-expression": "off", // style only: arrow shorthand that returns void is readable
    },
  },
);
