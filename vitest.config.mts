import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Everything under test here is pure logic: no DOM, no components.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
