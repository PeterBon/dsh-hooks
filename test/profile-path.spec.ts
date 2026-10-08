import { describe, expect, it } from 'vitest'
import { resolve, sep } from 'node:path'
import { assertProfileName, isProfileNameValid, profilePatchFile, profilesRoot } from '../src/profile-path.js'
import { patchFilePath } from '../src/dry-run.js'
import { patchPath } from '../src/feishu.js'

describe('profile name containment', () => {
  it('accepts ordinary single-segment profile names', () => {
    for (const name of ['web', 'work', 'desktop', 'open-design', 'a.b_c-1']) {
      expect(isProfileNameValid(name)).toBe(true)
      expect(assertProfileName(name)).toBe(name)
      expect(profilePatchFile(name)).toBe(resolve(profilesRoot(), name, 'cordis.patch.yml'))
    }
  })

  it('rejects traversal, separators, dotfiles and overlong names', () => {
    const rejected = [
      '..',
      '.',
      '.hidden',
      '../web',
      '..\\web',
      'web/../../x',
      'a/b',
      'a\\b',
      'C:\\Windows',
      '/etc',
      'web ',
      ' web',
      '',
      'x'.repeat(65),
      'web\u0000',
    ]
    for (const name of rejected) {
      expect(isProfileNameValid(name), name).toBe(false)
      expect(() => assertProfileName(name), name).toThrow()
      expect(() => profilePatchFile(name), name).toThrow()
    }
  })

  it('keeps every derived patch file inside the profiles root', () => {
    const root = resolve(profilesRoot())
    for (const name of ['web', 'work', 'open-design']) {
      expect(profilePatchFile(name).startsWith(root + sep)).toBe(true)
    }
  })

  it('shares the validation with both host-side patch paths', () => {
    // The Feishu setup writes the profile's hooks through patchPath, so it must
    // reject the same names as the routes' default resolver.
    for (const name of ['web', 'work']) {
      expect(patchFilePath(name)).toBe(profilePatchFile(name))
      expect(patchPath(name)).toBe(profilePatchFile(name))
    }
    for (const name of ['../../evil', '..', 'a/b']) {
      expect(() => patchFilePath(name)).toThrow()
      expect(() => patchPath(name)).toThrow()
    }
  })
})
