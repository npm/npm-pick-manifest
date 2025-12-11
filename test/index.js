'use strict'

const { test } = require('node:test')
const assert = require('node:assert')

const pickManifest = require('..')

test('basic carat range selection', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '^1.0.0')
  assert.strictEqual(manifest.version, '1.0.2', 'picked the right manifest using ^')
})

test('basic tilde range selection', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '~1.0.0')
  assert.strictEqual(manifest.version, '1.0.2', 'picked the right manifest using ~')
})

test('basic mathematical range selection', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest1 = pickManifest(metadata, '>=1.0.0 <2')
  assert.strictEqual(manifest1.version, '1.0.2', 'picked the right manifest using mathematical range')
  const manifest2 = pickManifest(metadata, '=1.0.0')
  assert.strictEqual(manifest2.version, '1.0.0', 'picked the right manifest using mathematical range')
})

test('basic version selection', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '1.0.0')
  assert.strictEqual(manifest.version, '1.0.0', 'picked the right manifest using specific version')
})

test('basic tag selection', () => {
  const metadata = {
    'dist-tags': {
      foo: '1.0.1',
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, 'foo')
  assert.strictEqual(manifest.version, '1.0.1', 'picked the right manifest using tag')
})

test('errors if a non-registry spec is provided', () => {
  const metadata = {
    'dist-tags': {
      foo: '1.0.1',
    },
    versions: {
      '1.0.1': { version: '1.0.1' },
    },
  }
  assert.throws(() => {
    pickManifest(metadata, '!?!?!?!')
  }, /Invalid tag name/)
  assert.throws(() => {
    pickManifest(metadata, 'file://foo.tar.gz')
  }, /Only tag, version, and range are supported/)
})

test('skips any invalid version keys', () => {
  // Various third-party registries are prone to having trash as
  // keys. npm simply skips them. Yay robustness.
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      'lol ok': { version: '1.0.1' },
    },
  }
  const manifest = pickManifest(metadata, '^1.0.0')
  assert.strictEqual(manifest.version, '1.0.0', 'avoided bad key')
  assert.throws(() => {
    pickManifest(metadata, '^1.0.1')
  }, (err) => err.code === 'ETARGET', 'no matching specs')
})

test('ETARGET if range does not match anything', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '2.0.0': { version: '2.0.0' },
      '2.0.5': { version: '2.0.5' },
    },
  }
  assert.throws(() => {
    pickManifest(metadata, '^2.1.0')
  }, (err) => err.code === 'ETARGET', 'got correct error on match failure')
})

test('E403 if version is forbidden', () => {
  const metadata = {
    'dist-tags': {
      latest: '2.1.0', // do not default the latest if restricted
    },
    policyRestrictions: {
      versions: {
        '2.1.0': { version: '2.1.0' },
      },
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '2.0.0': { version: '2.0.0' },
      '2.0.5': { version: '2.0.5' },
    },
  }
  assert.strictEqual(pickManifest(metadata, '2').version, '2.0.5')
  assert.strictEqual(pickManifest(metadata, '').version, '2.0.5')
  assert.strictEqual(pickManifest(metadata, '1 || 2').version, '2.0.5')
  assert.throws(() => {
    pickManifest(metadata, '2.1.0')
  }, (err) => err.code === 'E403', 'got correct error on match failure')
})

test('E403 if version is forbidden, provided a minor version', () => {
  const metadata = {
    policyRestrictions: {
      versions: {
        '2.1.0': { version: '2.1.0' },
        '2.1.5': { version: '2.1.5' },
      },
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '2.0.0': { version: '2.0.0' },
      '2.0.5': { version: '2.0.5' },
    },
  }
  assert.throws(() => {
    pickManifest(metadata, '2.1')
  }, (err) => err.code === 'E403', 'got correct error on match failure')
})

test('E403 if version is forbidden, provided a major version', () => {
  const metadata = {
    'dist-tags': {
      latest: '2.0.5',
      // note: this SHOULD not be allowed, but it's possible that
      // a registry proxy may implement policyRestrictions without
      // properly modifying dist-tags when it does so.
      borked: '2.1.5',
    },
    policyRestrictions: {
      versions: {
        '1.0.0': { version: '1.0.0' },
        '2.1.0': { version: '2.1.0' },
        '2.1.5': { version: '2.1.5' },
      },
    },
    versions: {
      '2.0.0': { version: '2.0.0' },
      '2.0.5': { version: '2.0.5' },
    },
  }
  assert.throws(() => {
    pickManifest(metadata, '1')
  }, (err) => err.code === 'E403', 'got correct error on match failure')
  assert.throws(() => {
    pickManifest(metadata, 'borked')
  }, (err) => err.code === 'E403', 'got correct error on policy restricted dist-tag')
})

test('if `defaultTag` matches a given range, use it', () => {
  const metadata = {
    'dist-tags': {
      foo: '1.0.1',
      latest: '1.0.0',
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  assert.strictEqual(
    pickManifest(metadata, '^1.0.0', { defaultTag: 'foo' }).version,
    '1.0.1',
    'picked the version for foo'
  )
  assert.strictEqual(
    pickManifest(metadata, '^2.0.0', { defaultTag: 'foo' }).version,
    '2.0.0',
    'no match, no foo'
  )
  assert.strictEqual(
    pickManifest(metadata, '^1.0.0').version,
    '1.0.0',
    'default to `latest`'
  )
})

test('* ranges use `defaultTag` if no versions match', () => {
  const metadata = {
    'dist-tags': {
      latest: '1.0.0-pre.0',
      beta: '2.0.0-beta.0',
    },
    versions: {
      '1.0.0-pre.0': { version: '1.0.0-pre.0' },
      '1.0.0-pre.1': { version: '1.0.0-pre.1' },
      '2.0.0-beta.0': { version: '2.0.0-beta.0' },
      '2.0.0-beta.1': { version: '2.0.0-beta.1' },
    },
  }
  assert.strictEqual(
    pickManifest(metadata, '*', { defaultTag: 'beta' }).version,
    '2.0.0-beta.0',
    'used defaultTag for all-prerelease splat.'
  )
  assert.strictEqual(
    pickManifest(metadata, '*').version,
    '1.0.0-pre.0',
    'defaulted to `latest` when wanted is *'
  )
  assert.strictEqual(
    pickManifest(metadata, '', { defaultTag: 'beta' }).version,
    '2.0.0-beta.0',
    'used defaultTag for all-prerelease ""'
  )
  assert.strictEqual(
    pickManifest(metadata, '').version,
    '1.0.0-pre.0',
    'defaulted to `latest` when wanted is ""'
  )
})

test('errors if metadata has no versions', () => {
  assert.throws(() => {
    pickManifest({ versions: {} }, '^1.0.0')
  }, (err) => err.code === 'ENOVERSIONS')
  assert.throws(() => {
    pickManifest({}, '^1.0.0')
  }, (err) => err.code === 'ENOVERSIONS')
})

test('errors if metadata has no versions or restricted versions', () => {
  assert.throws(() => {
    pickManifest({ versions: {}, policyRestrictions: { versions: {} } }, '^1.0.0')
  }, (err) => err.code === 'ENOVERSIONS')
  assert.throws(() => {
    pickManifest({}, '^1.0.0')
  }, (err) => err.code === 'ENOVERSIONS')
})

test('matches even if requested version has spaces', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '  1.0.0 ')
  assert.strictEqual(manifest.version, '1.0.0', 'picked the right manifest even though `wanted` had spaced')
})

test('matches even if requested version has garbage', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '== 1.0.0 || foo')
  assert.strictEqual(manifest.version, '1.0.0', 'picked the right manifest even though `wanted` had garbage')
})

test('matches skip deprecated versions', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.1.0': { version: '1.1.0', deprecated: 'yes' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '^1.0.0')
  assert.strictEqual(manifest.version, '1.0.1', 'picked the right manifest')
})

test('matches deprecated versions if we have to', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.1.0': { version: '1.1.0', deprecated: 'yes' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '^1.1.0')
  assert.strictEqual(manifest.version, '1.1.0', 'picked the right manifest')
})

test('will use deprecated version if no other suitable match', () => {
  const metadata = {
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.1.0': { version: '1.1.0', deprecated: 'yes' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '^1.1.0')
  assert.strictEqual(manifest.version, '1.1.0', 'picked the right manifest')
})

test('accepts opts.before option to do date-based cutoffs', () => {
  const metadata = {
    'dist-tags': {
      latest: '3.0.0',
    },
    time: {
      modified: '2018-01-03T00:00:00.000Z',
      created: '2018-01-01T00:00:00.000Z',
      '1.0.0': '2018-01-01T00:00:00.000Z',
      '2.0.0': '2018-01-02T00:00:00.000Z',
      '2.0.1': '2018-01-03T00:00:00.000Z',
      '2.0.2': '2018-01-03T00:00:00.123Z',
      '3.0.0': '2018-01-04T00:00:00.000Z',
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '2.0.0': { version: '2.0.0' },
      '2.0.1': { version: '2.0.1' },
      '3.0.0': { version: '3.0.0' },
    },
  }

  let manifest = pickManifest(metadata, '*', {
    before: '2018-01-02',
  })
  assert.strictEqual(manifest.version, '2.0.0', 'filtered out 3.0.0 because of dates')

  manifest = pickManifest(metadata, 'latest', {
    before: '2018-01-02',
  })
  assert.strictEqual(
    manifest.version,
    '2.0.0',
    'tag specs pick highest before dist-tag but within the range in question'
  )

  manifest = pickManifest(metadata, '*', {
    before: Date.parse('2018-01-03T00:00:00.000Z'),
  })
  assert.strictEqual(manifest.version, '2.0.1', 'numeric timestamp supported with ms accuracy')

  manifest = pickManifest(metadata, '*', {
    before: new Date('2018-01-03T00:00:00.000Z'),
  })
  assert.strictEqual(manifest.version, '2.0.1', 'date obj supported with ms accuracy')

  assert.throws(() => pickManifest(metadata, '3.0.0', {
    before: '2018-01-02',
  }), (err) => err.code === 'ETARGET', 'version filtered out by date')

  assert.throws(() => pickManifest(metadata, '', {
    before: '1918-01-02',
  }), (err) => err.code === 'ENOVERSIONS', 'all version filtered out by date')

  manifest = pickManifest(metadata, '^2', {
    before: '2018-01-02',
  })
  assert.strictEqual(manifest.version, '2.0.0', 'non-tag ranges filtered')

  assert.throws(() => {
    pickManifest(metadata, '^3', {
      before: '2018-01-02',
    })
  }, /with a date before/, 'range for out-of-range spec fails even if defaultTag avail')
})

test('prefers versions that satisfy the engines requirement', () => {
  const pack = {
    'dist-tags': {
      latest: '1.5.0', // do not default latest if engine mismatch
    },
    versions: {
      '1.0.0': { version: '1.0.0', engines: { node: '>=4' } },
      '1.1.0': { version: '1.1.0', engines: { node: '>=6' } },
      '1.2.0': { version: '1.2.0', engines: { node: '>=8' } },
      '1.3.0': { version: '1.3.0', engines: { node: '>=10' } },
      '1.4.0': { version: '1.4.0', engines: { node: '>=12' } },
      '1.5.0': { version: '1.5.0', engines: { node: '>=14' } },
      // not tagged as latest, won't be chosen by default
      '1.5.1': { version: '1.5.0', engines: { node: '>=14' } },
    },
  }

  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '14.0.0' }).version, '1.5.0')
  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '12.0.0' }).version, '1.4.0')
  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '10.0.0' }).version, '1.3.0')
  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '8.0.0' }).version, '1.2.0')
  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '6.0.0' }).version, '1.1.0')
  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '4.0.0' }).version, '1.0.0')
  assert.strictEqual(pickManifest(pack, '1.x', { nodeVersion: '1.2.3' }).version, '1.5.0',
    'if no engine-match exists, just use whatever')
})

test('support selecting staged versions if allowed by options', () => {
  const pack = {
    'dist-tags': {
      latest: '1.0.0',
      // note: this SHOULD not be allowed, but it's possible that
      // a registry proxy may implement stagedVersions without
      // properly modifying dist-tags when it does so.
      borked: '2.0.0',
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
    },
    stagedVersions: {
      versions: {
        '2.0.0': { version: '2.0.0' },
      },
    },
    time: {
      '1.0.0': '2018-01-03T00:00:00.000Z',
    },
  }

  assert.strictEqual(pickManifest(pack, '1||2').version, '1.0.0')
  assert.strictEqual(pickManifest(pack, '1||2', { includeStaged: true }).version, '1.0.0')
  assert.strictEqual(pickManifest(pack, '2', { includeStaged: true }).version, '2.0.0')
  assert.strictEqual(pickManifest(pack, '2', {
    includeStaged: true,
    before: '2018-01-01',
  }).version, '2.0.0', 'version without time entry not subject to before filtering')
  assert.throws(() => pickManifest(pack, '2'), (err) => err.code === 'ETARGET')
  assert.throws(() => pickManifest(pack, 'borked'), (err) => err.code === 'ETARGET')
})

test('support excluding avoided version ranges', () => {
  const metadata = {
    name: 'vulny',
    'dist-tags': {
      latest: '1.0.3',
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '1.0.3': { version: '1.0.3' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '^1.0.0', {
    avoid: '>=1.0.3',
  })
  assert.strictEqual(manifest.version, '1.0.2', 'picked the right manifest using ^')
  const cannotAvoid = pickManifest(metadata, '^1.0.0', {
    avoid: '1.x',
  })
  assert.deepStrictEqual(cannotAvoid, {
    version: '1.0.3',
    _shouldAvoid: true,
  }, 'could not avoid within SemVer range')
})

test('support excluding avoided version ranges strictly', () => {
  const metadata = {
    name: 'vulny',
    'dist-tags': {
      latest: '1.0.3',
    },
    versions: {
      '1.0.0': { version: '1.0.0' },
      '1.0.1': { version: '1.0.1' },
      '1.0.2': { version: '1.0.2' },
      '1.0.3': { version: '1.0.3' },
      '2.0.0': { version: '2.0.0' },
    },
  }
  const manifest = pickManifest(metadata, '^1.0.2', {
    avoid: '1.x >1.0.2',
    avoidStrict: true,
  })
  assert.ok(manifest.version === '1.0.2', 'picked the right manifest using ^')

  const breakRange = pickManifest(metadata, '1.0.2', {
    avoid: '1.x <1.0.3',
    avoidStrict: true,
  })
  assert.ok(breakRange.version === '1.0.3' &&
    breakRange._outsideDependencyRange === true &&
    breakRange._isSemVerMajor === false, 'broke dep range, but not SemVer major')

  const majorBreak = pickManifest(metadata, '1.0.2', {
    avoid: '1.x',
    avoidStrict: true,
  })
  assert.ok(majorBreak.version === '2.0.0' &&
    majorBreak._outsideDependencyRange === true &&
    majorBreak._isSemVerMajor === true, 'broke dep range with SemVer-major change')

  assert.throws(() => pickManifest(metadata, '^1.0.0', {
    avoid: '<3.0.0',
    avoidStrict: true,
  }), (err) => {
    return err.code === 'ETARGET' &&
      err.message === 'No avoidable versions for vulny' &&
      err.avoid === '<3.0.0'
  })
})

test('normalize package bins', () => {
  const bin = './bin/foobar.js'

  const name = 'foobar'
  const metadata = {
    name,
    versions: {
      '1.0.0': { bin, name, version: '1.0.0' },
      '1.0.1': { bin, name, version: '1.0.1' },
      '1.0.2': { bin, name, version: '1.0.2' },
      '2.0.0': { bin, name, version: '2.0.0' },
    },
  }

  const nameScoped = '@scope/foobar'
  const metadataScoped = {
    nameScoped,
    versions: {
      '1.0.0': { bin, name: nameScoped, version: '1.0.0' },
      '1.0.1': { bin, name: nameScoped, version: '1.0.1' },
      '1.0.2': { bin, name: nameScoped, version: '1.0.2' },
      '2.0.0': { bin, name: nameScoped, version: '2.0.0' },
    },
  }

  const manifest = pickManifest(metadata, '^1.0.0')
  assert.deepStrictEqual(manifest, {
    name,
    version: '1.0.2',
    bin: {
      foobar: 'bin/foobar.js',
    },
  }, 'normalized the package bin, unscoped')

  const manifestScoped = pickManifest(metadataScoped, '^1.0.0')
  assert.deepStrictEqual(manifestScoped, {
    name: nameScoped,
    version: '1.0.2',
    bin: {
      foobar: 'bin/foobar.js',
    },
  }, 'normalized the package bin, scoped')
})

test('no matching version', () => {
  const metadata = {
    name: 'package',
  }
  const expectedVersion = '1.1.1'

  assert.throws(() => {
    pickManifest(metadata, expectedVersion)
  }, /No matching version found/)
})
