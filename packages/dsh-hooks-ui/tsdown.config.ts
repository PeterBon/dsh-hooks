import { defineConfig } from 'tsdown'

const id = 'dsh-hooks-ui'

/**
 * Two build faces (dsh-web-ui shared-preset pattern):
 * - the node half: lib/index.js (minimal no-op host plugin)
 * - the browser half: lib/client.js as a closure-factory artifact for the
 *   GUI's __ModuleLoader__ — the bundle registers itself via
 *   window.__ModuleLoader__.load({ id, factory }) and resolves externals
 *   (react & co) through the injected require, backed by the shell's frozen
 *   platform module table.
 */
const lib = {
  name: id,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'] as const,
  platform: 'node' as const,
  dts: true,
  clean: false,
  fixedExtension: false,
  external: ['@deepseek-ai/cordis'],
}

const client = {
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
}

export default defineConfig([lib, client])
