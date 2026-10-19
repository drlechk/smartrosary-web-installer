import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const c3 = 'esp32-c3-01';
const s3Targets = [
  'esp32-s3-touch-amoled-1-75',
  'esp32-s3-touch-amoled-1-8-portrait',
  'esp32-s3-touch-amoled-1-8-landscape',
];

function page(payload, failure) {
  const labels = [], requests = [], writes = [];
  let disconnected = false;
  const service = {
    async getCharacteristic(id) {
      if (id === 'b8a7a0e2-1a5d-4c1e-9d93-2c9e2b9e1002') {
        if (failure === 'characteristic') throw new Error('settings unavailable');
        return { async readValue() {
          if (failure === 'read') throw new Error('read failed');
          return new DataView(new TextEncoder().encode(payload).buffer);
        } };
      }
      return { addEventListener() {}, async startNotifications() {} };
    },
  };
  const device = { name: 'Rosary', gatt: {
    connected: true,
    async connect() { return { async getPrimaryService() { return service; } }; },
    disconnect() { disconnected = true; },
  } };
  const scope = vm.createContext({
    TextDecoder, Uint8Array, ArrayBuffer, DataView,
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: () => null },
    navigator: { bluetooth: { async requestDevice() { return device; } } },
    GlobalUI: { setDevice: id => labels.push(id), setStatus() {}, showProgress() {},
      updateProgress() {}, announce() {} },
    t: key => key, helloAndAwaitConsent: async () => true,
    updateBleAudioCardVisibility() {},
    fetch: async path => { requests.push(path); return { ok: true,
      arrayBuffer: async () => Uint8Array.of(1, 2, 3).buffer }; },
    writePaced: async bytes => writes.push(bytes),
    firmwareTransferProfile: () => ({ chunkSize: 508, delayMs: 0, withoutResponse: false }),
    crc32: () => 0,
  });
  scope.window = scope;
  vm.runInContext(html.slice(html.indexOf('      const S3_AMOLED_HARDWARE_IDS ='),
    html.indexOf('      let audioBackend')), scope);
  vm.runInContext(html.slice(html.indexOf('      const SERVICE_UUID '),
    html.indexOf("      document.getElementById('uploadFirmwareBtn')")), scope);
  vm.runInContext(html.slice(html.indexOf('      async function readFirmwareVersion('),
    html.indexOf('      async function startIntentionsBluetooth(')), scope);
  return { scope, labels, requests, writes, disconnected: () => disconnected };
}

test('unknown BLE devices upload C3 firmware, including unavailable settings', async t => {
  for (const [name, payload, failure] of [
    ['empty', ''], ['empty JSON', '{}'], ['whitespace', '  '],
    ['missing ID', '{"fwVersion":"1.44"}'], ['empty ID', '{"hardwareId":""}'],
    ['unrecognized ID', '{"hardwareId":"unknown-board","fwVersion":"1.44"}'],
    ['inherited property name', '{"hardwareId":"__proto__"}'],
    ['malformed', '{broken'], ['null', 'null'],
    ['missing characteristic', '', 'characteristic'], ['read failure', '', 'read'],
  ]) {
    await t.test(name, async () => {
      const app = page(payload, failure);
      await app.scope.startFirmwareBluetooth();
      assert.equal(app.labels.at(-1), c3);
      assert.deepEqual(app.requests, ['firmware/firmware.bin']);
      assert.equal(app.writes.length, 2, 'size header and firmware packet sent');
      assert.equal(app.disconnected(), false);
    });
  }
});

test('recognized targets and truncated S3 settings retain their firmware route and version', async () => {
  const paths = ['firmware/firmware.bin', 'firmware/s3/firmware.bin',
    'firmware/s3-amoled-1-8-portrait/firmware.bin', 'firmware/s3-amoled-1-8-landscape/firmware.bin'];
  for (const [index, id] of [c3, ...s3Targets].entries()) {
    for (const truncated of [false, true]) {
      const payload = `{"hardwareId":"${id}","fwVersion":"1.44"${truncated ? ',' : '}'}`;
      const app = page(payload);
      await app.scope.startFirmwareBluetooth();
      assert.equal(app.labels.at(-1), id);
      assert.deepEqual(app.requests, [paths[index]]);
      assert.equal(vm.runInContext('connectedFirmwareVersion', app.scope), '1.44');
    }
  }
});

test('fallback resets a previous S3 connection and preserves a readable firmware version', async () => {
  const app = page('{"fwVersion":"1.44"}');
  vm.runInContext(`connectedHardwareId = '${s3Targets[0]}'`, app.scope);
  await app.scope.startFirmwareBluetooth();
  assert.equal(app.labels.at(-1), c3);
  assert.deepEqual(app.requests, ['firmware/firmware.bin']);
  assert.equal(vm.runInContext('connectedFirmwareVersion', app.scope), '1.44');
});

test('assuming C3 still rejects S3-only BLE audio before requesting its upload characteristic', async () => {
  const app = page('{}');
  await assert.rejects(vm.runInContext(`connectBLE(SERVICE_UUID, AUDIO_CHAR_UUID, {
    requiredHardwareIds: S3_AMOLED_HARDWARE_IDS,
  })`, app.scope), /errorAudioUnsupported/);
  assert.equal(app.disconnected(), true);
  assert.equal(app.writes.length, 0);
});
