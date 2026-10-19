import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const scope = vm.createContext({ window: {} });
for (const file of ['version.js', 'changelog.js']) {
  vm.runInContext(readFileSync(new URL(file, root), 'utf8'), scope);
}
const version = scope.window.SMARTROSARY_VERSION;
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));

test('firmware metadata and latest changelog agree on the published release', () => {
  assert.equal(manifest.version, version);
  assert.equal(scope.window.SmartRosaryChangelog[0].version, version);
  assert.match(scope.window.SmartRosaryChangelog[0].releaseCommit, /^[a-f0-9]{7,40}$/);
});

test('every installer firmware image embeds the advertised version and correct chip family', () => {
  assert.equal(manifest.builds.length, 4);
  for (const build of manifest.builds) {
    const part = build.parts.find(part => part.offset === 0x10000);
    assert.ok(part, `${build.name}: firmware part missing`);
    const binary = readFileSync(new URL(part.path, root));
    assert.equal(binary[0], 0xe9, `${build.name}: ESP image header`);
    assert.equal(binary.readUInt16LE(12), build.chipFamily === 'ESP32-C3' ? 5 : 9,
      `${build.name}: image chip family`);
    assert.ok(binary.includes(Buffer.from(`${version.replace(/^v/, '')}\0`)),
      `${build.name}: advertised version must be embedded in the binary`);
  }
});
