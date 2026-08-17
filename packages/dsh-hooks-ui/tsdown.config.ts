import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  outDir: 'lib',
  format: ['esm'],
  // Note: dts bundling inlines dependency declarations (including volatile
  // pnpm-store path comments). The CI lib-sync check therefore compares only
  // the .js artifacts of this package.
  dts: true,
  outExtension: () => ({ js: '.js' }),
  sourcemap: false,
  clean: true,
  // React comes from the shell's own React 18 (peerDependency) — never
  // bundle a second copy into client.js.
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  css: {
    inject: true,
    modules: { scopeBehaviour: 'local' },
  },
})
