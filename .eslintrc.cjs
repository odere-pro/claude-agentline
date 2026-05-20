/* eslint-env node */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: ["dist", "node_modules", "tests/golden"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
    "no-console": "off",
  },
  overrides: [
    {
      // Test files: block focused/skipped tests from landing on main.
      // `.only` would silently disable the rest of the suite in CI;
      // `.skip` masks a regression instead of fixing or deleting it.
      files: ["**/*.test.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[object.name='it'][property.name='only']",
            message: "it.only would silently disable the rest of the suite in CI. Remove before commit.",
          },
          {
            selector: "MemberExpression[object.name='describe'][property.name='only']",
            message: "describe.only would silently disable other suites in CI. Remove before commit.",
          },
          {
            selector: "MemberExpression[object.name='it'][property.name='skip']",
            message: "it.skip leaves dead-but-syntactically-valid tests. Use it.todo, or delete the test if it's no longer relevant.",
          },
          {
            selector: "MemberExpression[object.name='describe'][property.name='skip']",
            message: "describe.skip leaves dead-but-syntactically-valid suites. Use describe.todo, or delete the suite if it's no longer relevant.",
          },
        ],
      },
    },
    {
      // Non-test source: the shared test-helpers may only be imported
      // from *.test.ts. Importing them into a shipped module would
      // pull test scaffolding into the published bundle and break the
      // cold-start budget on the render path.
      files: ["src/**/*.ts"],
      excludedFiles: ["**/*.test.ts", "src/test-helpers/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/test-helpers/*", "**/test-helpers"],
                message: "src/test-helpers/ is for *.test.ts files only. Shipped code must not import test scaffolding.",
              },
            ],
          },
        ],
      },
    },
  ],
};
