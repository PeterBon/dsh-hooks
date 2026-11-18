import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { assertProfileName, detectRunningProfile, isProfileNameValid, listProfiles, profilePatchFile, profilesRoot } from '../src/profile-path.js'
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

describe('detectRunningProfile', () => {
  it('prefers DSH_PROFILE, then DSH_PROFILE_DIR', () => {
    expect(detectRunningProfile([], { DSH_PROFILE: 'desktop' })).toBe('desktop')
    expect(
      detectRunningProfile([], {
        DSH_PROFILE: 'bad name',
        // Native separators: basename() is platform-specific, so build the
        // fixture with join() instead of embedding a Windows path.
        DSH_PROFILE_DIR: join('ignored', '.dsh', 'profiles', 'work'),
      }),
    ).toBe('work')
  })

  it('reads the profile directory the Desktop host passes on argv', () => {
    const argv = [
      'C:\\Program Files\\DeepSeek Harness\\DeepSeek Harness.exe',
      'C:\\...\\dsh-desktop-host\\lib\\index.js',
      'C:\\Users\\peter\\.dsh\\profiles\\desktop',
      'C:\\...\\primary-runtime',
    ]
    expect(detectRunningProfile(argv, {})).toBe('desktop')
    expect(detectRunningProfile(['/usr/local/bin/dsh', '/home/p/.dsh/profiles/team/'], {})).toBe('team')
  })

  it('handles the CLI --profile flag and ignores invalid values', () => {
    expect(detectRunningProfile(['dsh', 'web', '--profile', 'work'], {})).toBe('work')
    expect(detectRunningProfile(['dsh', 'web', '--profile=open-design'], {})).toBe('open-design')
    expect(detectRunningProfile(['dsh', 'web', '--profile', '../evil'], {})).toBe('')
    expect(detectRunningProfile(['dsh', 'web'], {})).toBe('')
  })
})

describe('listProfiles', () => {
  it('lists real profile directories and always includes the running one', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-profiles-'))
    try {
      mkdirSync(join(root, 'desktop'))
      writeFileSync(join(root, 'desktop', 'cordis.yml'), '')
      mkdirSync(join(root, 'web'))
      writeFileSync(join(root, 'web', 'cordis.patch.yml'), '')
      mkdirSync(join(root, 'node_modules')) // not a profile
      mkdirSync(join(root, 'empty')) // no cordis.yml / patch
      mkdirSync(join(root, '.hidden'))
      expect(listProfiles('work', root)).toEqual(['desktop', 'web', 'work'])
      expect(listProfiles('', root)).toEqual(['desktop', 'web'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('degrades to the running profile when the profiles root is missing', () => {
    expect(listProfiles('desktop', join(tmpdir(), 'dsh-profiles-does-not-exist-xyz'))).toEqual(['desktop'])
  })
})
