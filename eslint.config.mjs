import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", ".claude/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The service worker runs outside the bundle, in its own global scope.
    files: ["public/sw.js"],
    languageOptions: {
      globals: { self: "readonly", caches: "readonly", fetch: "readonly", Response: "readonly" },
    },
  },
];

export default config;
