import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts', 'src/**/*.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: false,
  external: ['openclaw/plugin-sdk', 'node-fetch'],
  noExternal: [],
});
