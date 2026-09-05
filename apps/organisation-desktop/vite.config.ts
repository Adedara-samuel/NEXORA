import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev server port and strict port binding so the
// desktop shell can point at a predictable URL.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      // @nexora/validation's "main" points at its tsc-compiled CommonJS
      // dist/ (core-api needs real CJS to `require()` at runtime) — but
      // that dist uses TypeScript's `__exportStar` helper for every
      // `export * from "./x"`, which does a dynamic, reflection-based
      // re-export at runtime. Rollup's production build can't statically
      // see through that (unlike webpack/Next.js, which resolves CJS
      // interop at runtime), so it reports named exports as missing.
      // Pointing Vite straight at the TypeScript source sidesteps CJS
      // interop entirely — esbuild transpiles it as real ESM, the same way
      // @nexora/ui and @nexora/api-client already work (both are
      // source-consumed, with no dist build at all).
      "@nexora/validation": fileURLToPath(new URL("../../packages/validation/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    outDir: "dist",
  },
});
