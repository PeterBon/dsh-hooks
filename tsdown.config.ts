import { defineConfig } from 'tsdown'

const id = 'dsh-hooks'

/**
 * The browser half of the dual-face plugin: lib/client.js as a
 * closure-factory artifact for the GUI's __ModuleLoader__ — the bundle
 * registers itself via window.__ModuleLoader__.load({ id, factory }) and
 * resolves externals (react & co) through the injected require, backed by
 * the shell's frozen platform module table. The node half (lib/*.js) is
 * emitted by tsc; tsdown only builds the client face.
 */
export default defineConfig({
  name: `${id}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs' as const,
  platform: 'browser' as const,
  dts: false,
  sourcemap: false,
  clean: false,
  // Externals must live in the shell's frozen platform module table
  // (react, react/jsx-runtime, react-dom/client are seed entries).
  external: ['react', 'react/jsx-runtime', 'react-dom/client'],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
