import nextPlugin from "eslint-config-next";

const eslintConfig = [
  ...nextPlugin,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "coverage/**",
      ".agents/**",
      "demo-video/**",
    ],
  },
];

export default eslintConfig;
