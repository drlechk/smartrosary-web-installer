import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceNames = ['smartrosary-language', 'smartrosary-intentions', 'smartrosary-audio'];
const sources = Object.fromEntries(sourceNames.map(name => [name, path.join(root, 'sources', name)]));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
const plain = value => JSON.parse(JSON.stringify(value));

// Check the index so a deliberately staged pin update can be tested before committing.
const provenance = {};
for (const name of sourceNames) {
  const relative = `sources/${name}`;
  if (!fs.existsSync(path.join(sources[name], '.git'))) {
    throw new Error(`Missing ${relative}. Run git submodule update --init.`);
  }
  const pin = git('ls-files', '--stage', '--', relative).split(/\s+/);
  const head = git('-C', sources[name], 'rev-parse', 'HEAD');
  if (pin[0] !== '160000' || pin[1] !== head) {
    throw new Error(`${relative}: stage the intended submodule pin with git add ${relative}.`);
  }
  if (git('-C', sources[name], 'status', '--porcelain', '--untracked-files=normal')) {
    throw new Error(`${relative}: build requires a clean source checkout.`);
  }
  provenance[name] = { commit: head, url: git('config', '-f', '.gitmodules', '--get', `submodule.${relative}.url`) };
}

const temporary = fs.mkdtempSync(path.join(root, '.site-build-'));
const site = path.join(temporary, 'site');
fs.mkdirSync(site);
try {
  // Publish only runtime assets; never include source checkouts or Git metadata.
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && /\.(html|js|svg)$/.test(entry.name)) {
      fs.copyFileSync(path.join(root, entry.name), path.join(site, entry.name));
    }
  }
  for (const name of ['firmware', 'wallpaper', 'i18n', 'vendor']) {
    fs.cpSync(path.join(root, name), path.join(site, name), {
      recursive: true, filter: file => !path.basename(file).startsWith('.'),
    });
  }
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(site, 'LICENSE'));
  const firmwareManifest = readJson(path.join(root, 'manifest.json'));
  const version = fs.readFileSync(path.join(root, 'version.js'), 'utf8')
    .match(/SMARTROSARY_VERSION\s*=\s*"([^"]+)"/);
  if (!version) throw new Error('Missing SMARTROSARY_VERSION');
  firmwareManifest.version = version[1];
  writeJson(path.join(site, 'manifest.json'), firmwareManifest);

  const languageContext = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView });
  languageContext.window = languageContext;
  const fixtures = [];
  languageContext.registerNvsEditorFixture = fixture => fixtures.push(fixture);
  vm.runInContext(fs.readFileSync(path.join(root, 'scripts/vendor/language-nvs.js'), 'utf8'), languageContext);
  for (const file of fs.readdirSync(path.join(sources['smartrosary-language'], 'fixtures')).filter(file => file.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(sources['smartrosary-language'], 'fixtures', file), 'utf8'), languageContext);
  }
  assert.ok(fixtures.length, 'No language fixtures');
  fs.mkdirSync(path.join(site, 'lang'));
  const languages = new Set();
  const lib = languageContext.NvsEditorLib;
  for (const fixture of fixtures) {
    assert.match(fixture.code, /^[a-z]{2,3}$/);
    assert.ok(!languages.has(fixture.code), `Duplicate language ${fixture.code}`);
    languages.add(fixture.code);
    const state = lib.withLanguageMetadata(fixture.state);
    const bytes = lib.encodeNvsBinary(state);
    assert.equal(bytes.length, 20480);
    lib.validateNvsBinaryCrcs(bytes);
    const parsed = lib.parseNvsBinary(bytes);
    assert.equal(parsed.language, fixture.code);
    assert.equal(parsed.version, String(fixture.state.version || '1.0'));
    const entries = value => plain(value.entries).map(({ namespace, key, value }) => [namespace, key, value])
      .sort((a, b) => `${a[0]}/${a[1]}`.localeCompare(`${b[0]}/${b[1]}`));
    assert.deepEqual(entries(parsed), entries(state));
    fs.writeFileSync(path.join(site, 'lang', `nvs-lang-${fixture.code}.bin`), bytes);
  }

  // Run the canonical catalog generator on a scratch copy, leaving the pin clean.
  const intentionsScratch = path.join(temporary, 'intentions-source');
  for (const name of ['scripts', 'intentions', 'packages']) {
    fs.cpSync(path.join(sources['smartrosary-intentions'], name), path.join(intentionsScratch, name), { recursive: true });
  }
  run(process.execPath, [path.join(intentionsScratch, 'scripts/build-pages-data.mjs')]);
  const catalog = readJson(path.join(intentionsScratch, 'intentions-data.json'));
  const intentionsContext = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView });
  intentionsContext.window = intentionsContext;
  for (const name of ['intentions-nvs.js', 'intentions-catalog.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), intentionsContext);
  }
  intentionsContext.IntentionsCatalog.validateCatalog(catalog);
  fs.mkdirSync(path.join(site, 'intentions'));
  fs.copyFileSync(path.join(intentionsScratch, 'intentions-data.json'), path.join(site, 'intentions/intentions-data.json'));
  const filenames = new Set();
  const items = catalog.items.map(item => {
    assert.match(item.filename, /^nvs-intentions-[a-z0-9-]+\.bin$/);
    assert.ok(!filenames.has(item.filename), `Duplicate intentions filename ${item.filename}`);
    filenames.add(item.filename);
    assert.match(item.source, /^(intentions|packages)\/[a-z0-9-]+\.json$/);
    const source = readJson(path.join(intentionsScratch, item.source));
    assert.equal(source.partitionSize || 20480, 20480);
    assert.equal(source.nvsVersion || 2, 2);
    const model = {
      numIntentions: item.count,
      iS: item.type === 'package' ? source.iS || '' : item.entries[0].title,
      titles: item.entries.map(entry => entry.title),
      descs: item.entries.map(entry => entry.desc),
    };
    if (item.type === 'package') {
      assert.equal(source.numIntentions, item.count);
      assert.deepEqual(source.titles, model.titles);
      assert.deepEqual(source.descs, model.descs);
    }
    const bytes = intentionsContext.IntentionsNVS.buildIntentionsBin(model);
    assert.equal(bytes.length, 20480);
    assert.deepEqual(plain(intentionsContext.IntentionsNVS.parseIntentions(bytes)), model);
    fs.writeFileSync(path.join(site, 'intentions', item.filename), bytes);
    return { id: item.id, label: item.label, type: item.type, path: `intentions/${item.filename}`,
      filename: item.filename, count: item.count, size: bytes.length };
  });
  writeJson(path.join(site, 'intentions/manifest.json'), {
    format: 'smartrosary-intentions-manifest-v1', version: '1.0', items,
  });

  run(process.env.PYTHON || 'python3', [path.join(root, 'scripts/build-audio.py'),
    '--source', sources['smartrosary-audio'], '--output', site]);
  writeJson(path.join(site, 'content-sources.json'), provenance);
  fs.writeFileSync(path.join(site, '.nojekyll'), '');
  // Keep the previous complete site available if any content build fails.
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
  fs.renameSync(site, path.join(root, 'dist'));
  console.log(`Built dist: ${languages.size} languages, ${items.length} intention packages, and audio from pinned sources.`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
