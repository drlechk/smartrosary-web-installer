import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const assets = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('audio/manifest.json', assets)));
const html = readFileSync(new URL('index.html', root), 'utf8');
const helper = readFileSync(new URL('audio-catalog.js', root), 'utf8');
const context = vm.createContext({}); context.window = context;
vm.runInContext(helper, context);
const api = context.AudioCatalog;

test('both sets publish all eight languages, speakers and correct binary hashes', () => {
  assert.equal(manifest.items.length, 32);
  assert.equal(new Set(manifest.items.map(item => item.id)).size, 32);
  for (const backend of ['chatterbox', 'omnivoice']) {
    for (const language of ['pl', 'en', 'de', 'es', 'fr', 'it', 'pt', 'la']) {
      const items = manifest.items.filter(item => item.backend === backend && item.language === language);
      assert.deepEqual(items.map(item => item.speakerId).sort(), ['florian', 'seraphina']);
      for (const item of items) {
        assert.equal(item.path, `audio/${backend}/${language}-${item.speakerId}/audio-rosary.bin`);
        const path = new URL(item.path, assets);
        assert.equal(statSync(path).size, 0x134000);
        assert.equal(item.size, 0x134000);
        assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), item.sha256);
      }
    }
  }
});

test('set changes preserve language and speaker and never fall back across sets', () => {
  const omni = api.select(manifest.items, 'omnivoice', 'pl-florian', 'en');
  assert.equal(omni.id, 'pl-florian-omnivoice');
  assert.equal(api.select(manifest.items, 'chatterbox', omni.id, 'en').id, 'pl-florian');
  assert.equal(api.select(manifest.items, 'omnivoice', '', 'en').id, 'en-seraphina-omnivoice');
  assert.equal(api.select(manifest.items.filter(item => item.backend === 'chatterbox'), 'omnivoice', 'pl-florian', 'pl'), null);
  assert.equal(api.backendOf({ id: 'pl-seraphina' }), 'chatterbox');
});

class Element extends EventTarget {
  constructor(value = '') { super(); this.value = value; this.options = []; }
  set innerHTML(value) { this.options = []; this.value = ''; }
  appendChild(option) { this.options.push(option); }
}

async function page() {
  const ids = ['audioFileSelect', 'audioLanguage', 'audioBackendBle', 'audioBackendUsb',
    'audioVersionHint', 'audioUsbVersionHint', 'firmwareHardware', 'language', 'intentions', 'usbInstallActivate'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  for (const id of ['audioBackendBle', 'audioBackendUsb']) {
    elements[id].options = ['chatterbox', 'omnivoice'].map(value => ({ value }));
  }
  elements.language.value = 'pl';
  elements.firmwareHardware.value = 'esp32-s3-touch-amoled-1-75';
  const button = {}, blobs = new Map(); let serial = 0;
  class TestURL extends URL {
    static createObjectURL(blob) { const id = `blob:test-${serial++}`; blobs.set(id, blob); return id; }
    static revokeObjectURL(id) { blobs.delete(id); }
  }
  const document = Object.assign(new EventTarget(), {
    baseURI: 'https://installer.test/',
    getElementById: id => elements[id],
    createElement: () => new Element(),
    querySelector: selector => selector === 'esp-web-install-button' ? button : null,
  });
  const scope = vm.createContext({ document, URL: TestURL, Blob, Event, console: { log() {} },
    currentLang: 'pl', audioBackend: 'chatterbox', audioManifest: manifest,
    getTranslation: () => ({ audioVersionHint: 'v{version} {label}' }), i18n: { en: {} },
    customElements: { whenDefined: () => Promise.resolve() },
    FW_VERSION: 'test', selectedIntentionsBundle: () => null,
    loadAudioManifest: async () => manifest, loadIntentionsCatalog: async () => null,
  });
  scope.window = scope;
  vm.runInContext(helper, scope);
  const start = html.indexOf('      function audioItems()');
  const end = html.indexOf('      async function loadIntentionsCatalog()', start);
  vm.runInContext(html.slice(start, end), scope);
  const targetsStart = html.indexOf('      const FIRMWARE_TARGETS =');
  const targetsEnd = html.indexOf('      let audioBackend', targetsStart);
  vm.runInContext(html.slice(targetsStart, targetsEnd), scope);
  scope.populateAudioSelectors();
  const usbEnd = html.indexOf('    <!-- Bluetooth uploader');
  const usbStart = html.lastIndexOf('      (() => {', usbEnd);
  vm.runInContext(html.slice(usbStart, html.lastIndexOf('    </script>', usbEnd)), scope);
  await new Promise(resolve => setImmediate(resolve));
  return { scope, elements, button, blobs, readManifest: async () => JSON.parse(await blobs.get(button.manifest).text()) };
}

test('actual page synchronizes both pickers and rebuilds S3 USB image on a BLE set change', async () => {
  const { scope, elements, readManifest } = await page();
  assert.equal(elements.audioLanguage.value, 'pl-seraphina');
  elements.audioFileSelect.value = 'de-florian';
  scope.syncAudioSelects('audioFileSelect');
  elements.audioBackendBle.value = 'omnivoice';
  scope.changeAudioBackend('audioBackendBle');
  assert.equal(elements.audioBackendUsb.value, 'omnivoice');
  assert.equal(elements.audioLanguage.value, 'de-florian-omnivoice');
  assert.ok(elements.audioLanguage.options.every(option => option.value.endsWith('-omnivoice')));
  let data = await readManifest();
  assert.equal(data.builds[0].parts.find(part => part.offset === 0xD3F000).path,
    'https://installer.test/audio/omnivoice/de-florian/audio-rosary.bin');
  elements.audioBackendUsb.value = 'chatterbox';
  scope.changeAudioBackend('audioBackendUsb');
  assert.equal(elements.audioFileSelect.value, 'de-florian');
  data = await readManifest();
  assert.equal(data.builds[0].parts.find(part => part.offset === 0xD3F000).path,
    'https://installer.test/audio/chatterbox/de-florian/audio-rosary.bin');
});

test('actual USB manifest excludes audio for C3 and includes selected set for every S3 target', async () => {
  const { elements, readManifest } = await page();
  for (const id of ['esp32-c3-01', 'esp32-s3-touch-amoled-1-75', 'esp32-s3-touch-amoled-1-8-portrait', 'esp32-s3-touch-amoled-1-8-landscape']) {
    elements.firmwareHardware.value = id;
    elements.firmwareHardware.dispatchEvent(new Event('change'));
    const data = await readManifest();
    assert.equal(data.builds[0].parts.some(part => part.offset === 0xD3F000), id !== 'esp32-c3-01');
  }
});

test('BLE uploads the selected backend image and retains recognized-S3 checks', async () => {
  const { scope, elements } = await page();
  const calls = [];
  Object.assign(scope, {
    SERVICE_UUID: 'service', AUDIO_CHAR_UUID: 'audio', S3_AMOLED_HARDWARE_IDS: new Set(['s3']),
    Uint8Array, t: key => key, alert: message => assert.fail(message),
    fetch: async path => { calls.push(['fetch', path]); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; },
    connectBLE: async (...args) => { calls.push(['connect', ...args]); },
    sendNVS: async (...args) => { calls.push(['send', ...args]); },
  });
  vm.runInContext(html.slice(html.indexOf('      async function startAudioBluetooth('),
    html.indexOf('      function crc32(')), scope);
  for (const backend of ['omnivoice', 'chatterbox']) {
    elements.audioBackendBle.value = backend;
    scope.changeAudioBackend('audioBackendBle');
    calls.length = 0;
    await scope.startAudioBluetooth();
    assert.equal(calls[0][1], `audio/${backend}/pl-seraphina/audio-rosary.bin`);
    assert.equal(calls[1][2], 'audio');
    assert.equal(calls[1][3].requiredHardwareIds, scope.S3_AMOLED_HARDWARE_IDS);
    assert.equal(calls[2][2], 'audio-rosary.bin');
  }
  scope.connectBLE = async () => { throw new Error('unsupported board'); };
  calls.length = 0;
  await assert.rejects(scope.startAudioBluetooth(), /unsupported board/);
  assert.ok(!calls.some(call => call[0] === 'send'));
});
