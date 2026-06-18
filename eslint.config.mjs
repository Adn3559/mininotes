import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
];

export default eslintConfig;