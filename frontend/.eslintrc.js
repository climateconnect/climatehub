module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:import/recommended",
    "next/core-web-vitals",
  ],
  ignorePatterns: ["devlink/"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["react", "import"],
  rules: {
    "prefer-const": "error",
    "react/prop-types": "off",
    "react/self-closing-comp": "error",
    "react/prefer-stateless-function": "error",
    "react/react-in-jsx-scope": "off", // Not needed in Next.js 13
    "@next/next/no-img-element": "off",
    "react-hooks/exhaustive-deps": "off",
    "no-unused-vars": [
      "error",
      {
        vars: "all",
        args: "after-used",
        ignoreRestSiblings: true,
        argsIgnorePattern: "^_",
      },
    ],
    "import/no-unresolved": [
      "error",
      {
        // Only check for completely missing packages, not type-only imports
        caseSensitive: true,
        caseSensitiveStrict: false,
      },
    ],
    "import/named": "off", // Disable named import checking - can cause false positives with TypeScript
    "import/namespace": "off", // Disable namespace checking - not needed for our use case
    // @mui/styles was removed (#2290); do not reintroduce it.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@mui/styles",
            message: "@mui/styles is deprecated. Use styled() or sx from @mui/material/styles.",
          },
        ],
        patterns: [
          {
            group: ["@mui/styles/*"],
            message: "@mui/styles is deprecated. Use styled() or sx from @mui/material/styles.",
          },
        ],
      },
    ],
  },
  settings: {
    react: {
      version: "detect",
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./tsconfig.json",
      },
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
  },
};
