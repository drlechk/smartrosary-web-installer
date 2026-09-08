import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const site = new URL('dist/', root);
const json = file => JSON.parse(readFileSync(new URL(file, site), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));

test('published content provenance matches all three pinned submodules', () => {
  const sources = json('content-sources.json');
  assert.deepEqual(Object.keys(sources).sort(), ['smartrosary-audio', 'smartrosary-intentions', 'smartrosary-language']);
  for (const [name, source] of Object.entries(sources)) {
    const pin = execFileSync('git', ['ls-files', '--stage', '--', `sources/${name}`], { cwd: root, encoding: 'utf8' }).trim().split(/\s+/);
    assert.equal(pin[0], '160000');
    assert.equal(source.commit, pin[1]);
    assert.equal(source.url, `https://github.com/drlechk/${name}.git`);
  }
  for (const name of ['sources', '.git', '.gitmodules', '.github', 'scripts', 'tests', 'README.md']) {
    assert.equal(existsSync(new URL(name, site)), false, `${name} must not be published`);
  }
});

test('every language binary retains all source text and passes NVS CRC validation', () => {
  const scope = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView });
  scope.window = scope;
  const fixtures = [];
  scope.registerNvsEditorFixture = fixture => fixtures.push(fixture);
  vm.runInContext(readFileSync(new URL('scripts/vendor/language-nvs.js', root), 'utf8'), scope);
  const source = new URL('sources/smartrosary-language/fixtures/', root);
  for (const file of readdirSync(source).filter(file => file.endsWith('.js'))) {
    vm.runInContext(readFileSync(new URL(file, source), 'utf8'), scope);
  }
  assert.equal(fixtures.length, 8);
  for (const fixture of fixtures) {
    const bytes = readFileSync(new URL(`lang/nvs-lang-${fixture.code}.bin`, site));
    scope.NvsEditorLib.validateNvsBinaryCrcs(bytes);
    const parsed = scope.NvsEditorLib.parseNvsBinary(bytes);
    assert.equal(bytes.length, 20480);
    assert.equal(parsed.language, fixture.code);
    assert.equal(parsed.version, fixture.state.version);
    const actual = new Map(parsed.entries.map(entry => [`${entry.namespace}/${entry.key}`, entry.value]));
    for (const entry of fixture.state.entries) {
      assert.equal(actual.get(`${entry.namespace}/${entry.key}`), entry.value);
    }
  }
});

test('local intentions catalog and every downloadable package agree with pinned definitions', () => {
  const scope = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView });
  scope.window = scope;
  for (const file of ['intentions-nvs.js', 'intentions-catalog.js']) {
    vm.runInContext(readFileSync(new URL(file, site), 'utf8'), scope);
  }
  assert.equal(scope.IntentionsCatalog.url, 'intentions/intentions-data.json');
  const catalog = json(scope.IntentionsCatalog.url);
  scope.IntentionsCatalog.validateCatalog(catalog);
  const manifest = json('intentions/manifest.json');
  assert.equal(manifest.items.length, catalog.items.length);
  for (const item of catalog.items) {
    const source = JSON.parse(readFileSync(new URL(`sources/smartrosary-intentions/${item.source}`, root), 'utf8'));
    const entry = manifest.items.find(entry => entry.id === item.id);
    const bytes = readFileSync(new URL(entry.path, site));
    assert.equal(bytes.length, entry.size);
    assert.equal(bytes.length, 20480);
    assert.equal(entry.count, item.count);
    const parsed = scope.IntentionsNVS.parseIntentions(bytes);
    assert.equal(parsed.numIntentions, item.count);
    assert.deepEqual(plain(parsed.titles), item.entries.map(entry => entry.title));
    assert.deepEqual(plain(parsed.descs), item.entries.map(entry => entry.desc));
    assert.deepEqual(plain(parsed.titles), item.type === 'package' ? source.titles : [source.title]);
    assert.deepEqual(plain(parsed.descs), item.type === 'package' ? source.descs : [source.desc || source.description || '']);
  }
});

test('failed rebuild keeps the previously complete deployment intact', () => {
  const digest = () => createHash('sha256').update(readFileSync(new URL('content-sources.json', site)))
    .update(readFileSync(new URL('audio/manifest.json', site))).digest('hex');
  const before = digest();
  const result = spawnSync(process.execPath, ['scripts/build-site.mjs'], {
    cwd: fileURLToPath(root), env: { ...process.env, PYTHON: '/nonexistent-smartrosary-python' }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nonexistent-smartrosary-python.*ENOENT/);
  assert.equal(digest(), before);
  assert.equal(readdirSync(root).some(name => name.startsWith('.site-build-')), false);
});
