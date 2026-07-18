import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  treeshake: true,
  // email-reply-parser ships ESM-only; bundling it keeps our CJS build
  // working on every Node >= 18 (require(esm) only landed in 22.12).
  noExternal: ['email-reply-parser'],
});
