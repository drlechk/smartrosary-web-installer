import { readFileSync, writeFileSync } from "node:fs";

const versionSource = readFileSync(new URL("../version.js", import.meta.url), "utf8");
const match = versionSource.match(/SMARTROSARY_VERSION\s*=\s*"([^"]+)"/);

if (!match) {
  throw new Error("Could not find SMARTROSARY_VERSION in version.js");
}

const version = match[1];
const manifestPath = new URL("../manifest.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

manifest.version = version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Updated manifest.json version to ${version}`);
