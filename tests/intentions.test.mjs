import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView });
context.window = context;
for (const file of ['intentions-nvs.js', 'intentions-catalog.js']) {
  vm.runInContext(readFileSync(new URL(file, root), 'utf8'), context);
}
const { IntentionsCatalog: catalogApi, IntentionsNVS: nvs } = context;
const plain = value => JSON.parse(JSON.stringify(value));
const item = (id, entries) => ({ id, label: id, count: entries.length, entries });
const catalog = { items: [
  item('single', [{ title: 'Życie', desc: 'Módlmy się za rodzinę.\nMiłość 🕊️' }]),
  item('package', [{ title: 'January', desc: 'Peace' }, { title: 'February', desc: 'Hope' }]),
] };

test('combines singles and packages once in catalog order and preserves UTF-8', () => {
  const bundle = catalogApi.buildSelection(catalog, ['package', 'single', 'single']);
  assert.equal(bundle.data.length, 20480);
  assert.equal(bundle.filename, 'nvs-intentions-selection.bin');
  assert.deepEqual(plain(nvs.parseIntentions(bundle.data)), plain(bundle.model));
  assert.deepEqual(plain(bundle.model.titles), ['Życie', 'January', 'February']);
  assert.ok(bundle.data.slice(-4096).every(byte => byte === 255), 'reserved page is erased');
});

test('empty selection omits optional intentions', () => {
  assert.equal(catalogApi.buildSelection(catalog, []), null);
});

test('rejects missing, duplicate and malformed catalog entries', () => {
  for (const value of [null, {}, { items: [] }, { items: [catalog.items[0], catalog.items[0]] },
    { items: [item('bad', [{ title: 'x', desc: null }])] },
    { items: [{ ...catalog.items[0], count: 2 }] }]) {
    assert.throws(() => catalogApi.validateCatalog(value), /intentionsCatalogError/);
  }
  assert.throws(() => catalogApi.buildSelection(catalog, ['missing']), /intentionsCatalogError/);
});

test('allows 32 entries, rejects 33 before building a partition', () => {
  const entries = Array.from({ length: 32 }, (_, i) => ({ title: `Title ${i}`, desc: '' }));
  const value = { items: [item('32', entries), catalog.items[0]] };
  assert.equal(catalogApi.buildSelection(value, ['32']).model.numIntentions, 32);
  assert.throws(() => catalogApi.buildSelection(value, ['32', 'single']), /intentionsTooMany/);
});

test('rejects text overflow instead of truncating the NVS image', () => {
  const value = { items: [item('large', [{ title: 'Long', desc: 'ą'.repeat(12000) }])] };
  assert.throws(() => catalogApi.buildSelection(value, ['large']), /intentionsTooLarge/);
});

// Independent bitwise CRC calculation verifies the firmware's NVS wire contract.
function crc(bytes) {
  let result = 0;
  for (const byte of bytes) {
    result ^= byte;
    for (let bit = 0; bit < 8; bit++) result = (result >>> 1) ^ ((result & 1) ? 0xedb88320 : 0);
  }
  return (result ^ 0xffffffff) >>> 0;
}
test('multipage text has valid page, entry and data CRCs', () => {
  const value = { items: [item('pages', [{ title: 'Za pokój', desc: 'Świat 🕊️\n'.repeat(600) }])] };
  const { data, model } = catalogApi.buildSelection(value, ['pages']);
  assert.deepEqual(plain(nvs.parseIntentions(data)), plain(model));
  const view = new DataView(data.buffer);
  for (let page = 0; page < 4; page++) {
    const base = page * 4096;
    assert.equal(view.getUint32(base + 28, true), crc(data.slice(base + 4, base + 28)));
    for (let index = 0; index < 126;) {
      const off = base + 64 + index * 32;
      const entry = data.slice(off, off + 32);
      if (entry.every(byte => byte === 255)) break;
      assert.equal(view.getUint32(off + 4, true), crc([...entry.slice(0, 4), ...entry.slice(8)]));
      if (entry[1] === 0x42) {
        const size = view.getUint16(off + 24, true);
        assert.equal(view.getUint32(off + 28, true), crc(data.slice(off + 32, off + 32 + size)));
      }
      index += entry[2];
    }
  }
});

const html = readFileSync(new URL('index.html', root), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
test('all inline installer scripts parse', () => {
  for (const script of inlineScripts) new vm.Script(script);
});

function element(value = '') {
  return { value, disabled: false, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
}
test('USB manifest uses one generated NVS image, correct hardware offset and revokes stale URLs', async () => {
  const elements = { firmwareHardware: element('c3'), language: element('pl'), intentions: element(),
    audioLanguage: element(), usbInstallActivate: element() };
  const button = {};
  const blobs = new Map();
  const revoked = [];
  let sequence = 0;
  let selection = catalogApi.buildSelection(catalog, ['single', 'package']);
  const target = (offset) => ({ label: 'Rosary', chipFamily: 'ESP32', languageOffset: 0x9000,
    intentionsOffset: offset, audioOffset: null, parts: [{ path: 'firmware.bin', offset: 0x10000 }] });
  class TestURL extends URL {}
  TestURL.createObjectURL = blob => { const url = `blob:https://example.com/${++sequence}`; blobs.set(url, blob); return url; };
  TestURL.revokeObjectURL = url => { revoked.push(url); blobs.delete(url); };
  const sandbox = vm.createContext({ Blob, URL: TestURL, console: { log() {} },
    customElements: { whenDefined: () => Promise.resolve() },
    document: { baseURI: 'https://example.com/installer/', querySelector: () => button,
      addEventListener() {},
      getElementById: id => elements[id] },
    FIRMWARE_TARGETS: { c3: target(0x2f0000), s3: target(0x7f0000) }, FW_VERSION: 'test',
    selectedIntentionsBundle: () => { if (selection instanceof Error) throw selection; return selection; },
    selectedAudioItem: () => null, loadAudioManifest: async () => null,
    loadIntentionsCatalog: async () => null, updateIntentionsSummaries() {} });
  vm.runInContext(inlineScripts.find(script => script.includes('function absoluteParts')), sandbox);
  await new Promise(resolve => setImmediate(resolve));
  const manifest = await blobs.get(button.manifest).text().then(JSON.parse);
  const part = manifest.builds[0].parts.find(part => part.offset === 0x2f0000);
  assert.equal(manifest.builds[0].parts.filter(part => part.path.startsWith('blob:')).length, 1);
  assert.deepEqual(new Uint8Array(await blobs.get(part.path).arrayBuffer()), selection.data);
  assert.equal(manifest.builds[0].parts[0].path, 'https://example.com/installer/firmware.bin');
  const oldManifest = button.manifest;
  elements.firmwareHardware.value = 's3';
  elements.firmwareHardware.listeners.change();
  assert.ok(revoked.includes(part.path));
  assert.ok(revoked.includes(oldManifest));
  const s3 = JSON.parse(await blobs.get(button.manifest).text());
  assert.ok(s3.builds[0].parts.some(part => part.offset === 0x7f0000));
  selection = new Error('intentionsTooLarge');
  elements.intentions.listeners.change();
  assert.equal(button.manifest, '');
  assert.equal(elements.usbInstallActivate.disabled, true);
  selection = null;
  elements.intentions.listeners.change();
  assert.equal(elements.usbInstallActivate.disabled, false);
  const empty = JSON.parse(await blobs.get(button.manifest).text());
  assert.ok(empty.builds[0].parts.every(part => !part.path.startsWith('blob:')));
});

test('BLE shares the combined bundle and requires consent for legacy image replacement', async () => {
  const source = html.slice(html.indexOf('      async function startIntentionsBluetooth('),
    html.indexOf('      async function startLanguageBluetooth('));
  const bundle = catalogApi.buildSelection(catalog, ['single', 'package']);
  let fallback = false, consent = false;
  const calls = [];
  const sandbox = vm.createContext({ loadIntentionsCatalog: async () => catalog,
    selectedIntentionsBundle: () => bundle, SERVICE_UUID: 'service', INFO_INTENT_ENTRY_UUID: 'record',
    INTENTS_CHAR_UUID: 'legacy', t: key => key, window: { confirm: () => consent },
    connectBLE: async () => ({ usedFallback: fallback, service: 'connected' }),
    sendNVS: async (...args) => calls.push(['nvs', ...args]),
    sendIntentionsModel: async (...args) => calls.push(['records', ...args]) });
  vm.runInContext(source, sandbox);
  await sandbox.startIntentionsBluetooth();
  assert.equal(calls[0][0], 'records');
  assert.deepEqual(plain(calls[0][1]), plain(bundle.model));
  fallback = true;
  await sandbox.startIntentionsBluetooth();
  assert.equal(calls.length, 1);
  consent = true;
  await sandbox.startIntentionsBluetooth();
  assert.equal(calls[1][0], 'nvs');
  assert.deepEqual(calls[1][1], bundle.data);
  assert.equal(calls[1][2], bundle.filename);
});
