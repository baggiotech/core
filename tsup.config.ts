import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "identity/index": "src/identity/index.ts",
    "governance/index": "src/governance/index.ts",
    "persistence/index": "src/persistence/index.ts",
    "security/index": "src/security/index.ts",
    "theme/index": "src/theme/index.ts",
    "forensics/index": "src/forensics/index.ts",
    "testing/index": "src/testing/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
