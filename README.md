# SmartRosary Web Installer

[Visit installer website](https://drlechk.github.io/smartrosary-web-installer/)


## Intentions selection

Both USB and Bluetooth offer checkboxes for multiple packages and single
intentions from `intentions/intentions-data.json`, generated from the pinned
`smartrosary-intentions` submodule during the installer build. The picker and
downloadable packages use the same content revision. A failed catalog request offers Retry.
USB can still install firmware without optional intentions.

Selected items are combined in catalog order, preserving each package's entry
order and text, into one 20,480-byte NVS V2 intentions partition. A package checkbox
includes all its entries. Nothing is selected by default. Both pickers are
collapsed on page load; click or tap the summary to expand or collapse the
checkboxes. The summary keeps the selection count or validation message visible
when collapsed. Selections are preserved when the picker is closed. The UI blocks
selections exceeding 32 entries or partition capacity.
Overlapping packages preserve their entries; only repeated item IDs are deduplicated.

USB includes the generated image at the selected hardware's intentions offset.
Current BLE firmware receives the same combined model through intention-entry
record writes, preserving installed intentions and checking available slots first.
Legacy BLE firmware receives the combined NVS image only after the existing
full-partition overwrite warning is accepted.

`intentions-nvs.js` retains the installer parser and adapts the encoder from
`smartrosary-intentions-editor/nvs.js`, adding a strict partition-capacity guard.
Published `intentions/*.bin` files and their manifest remain available for existing
consumers; the picker reads the generated local JSON catalog.

Build the site first using the commands below, then run regression checks with:

```sh
node --test tests/*.test.mjs
```

Serve `dist/` over HTTP on localhost for manual UI checks. Verify selecting
and clearing multiple items in each picker, changing USB hardware, retrying a
failed catalog load, and uploading through USB/current BLE/legacy BLE on hardware.

## Audio sets

USB and Bluetooth audio pickers offer **Chatterbox** and **OmniVoice**. Switching
sets preserves the language and speaker when available and synchronizes both
pickers. USB regenerates its install manifest on either picker's selection change.
Audio is included only for S3 AMOLED targets; BLE still requires recognized S3
hardware and its audio-upload characteristic.

Packages live under `audio/chatterbox/<language>-<speaker>/audio-rosary.bin` and
`audio/omnivoice/<language>-<speaker>/audio-rosary.bin`. Each backend has 16
packages (eight languages, two speakers), each containing 42 clips. All binaries
are `0x134000` bytes for the existing S3 partition at `0xD3F000`.

`audio/manifest.json` retains the v1 format and original Chatterbox IDs. OmniVoice
IDs append `-omnivoice`; entries also carry `backend`, `speakerId`, and `sha256`.
Mobile consumers can continue using item IDs and paths. The old flat binary URLs
have moved; deploy the updated manifest and backend folders together.

The site build runs `build_audiofs.py` from the pinned `smartrosary-audio`
submodule for every configured voice and writes the audio manifest automatically. OmniVoice
generation and preview clips now default to the same 32 kbit/s mono 24 kHz
encoding as device packages. Matching source files are packaged unchanged;
older or custom inputs are normalized in temporary copies. Keep package
versions aligned with that repository's `audio-package.json`.

## Build from content submodules

The installer pins three independent repositories under `sources/`:

- `smartrosary-language`: canonical language fixtures.
- `smartrosary-intentions`: single intentions, packages, and catalog generator.
- `smartrosary-audio`: existing Chatterbox/OmniVoice MP3s and LittleFS packager.

Generated `audio/`, `lang/`, and `intentions/` assets are no longer tracked in
this repository. The build writes them to `dist/`, preserving their published
URLs and manifest formats for the installer and mobile app. Firmware and
wallpaper artifacts retain their existing publication workflow. TTS services
are not needed to package the committed MP3s.

Install Node.js 20+, Python 3.12, and ffmpeg (including ffprobe). On macOS,
`brew install ffmpeg` supplies the audio tools. Then, from this repository:

```sh
git submodule update --init
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-build.txt
PYTHON=.venv/bin/python node scripts/build-site.mjs
node --test tests/*.test.mjs
python3 -m http.server 8080 --directory dist
```

Only the three direct submodules are required; the audio repository's nested
language submodule is not needed for packaging existing MP3s. The build requires
clean submodule checkouts matching the pins staged in the installer index. It
validates language CRCs and all text, intention package round trips, audio image
sizes and embedded file lists/metadata, and publishes the exact source commits
in `content-sources.json`. Tests also verify every audio manifest checksum and
preservation of the previous complete site after a failed build.

The language codec is vendored for build use from the language editor; its
source commit and license are recorded in [scripts/vendor/README.md](scripts/vendor/README.md).
The intentions builder uses the installer's existing NVS codec. Source
checkouts and build tooling are excluded from the deployed site.

### Publish a content update

First commit and push the intended changes in the source repository. Then
update only the relevant installer submodule (audio shown here):

```sh
git submodule update --remote sources/smartrosary-audio
git diff --submodule=log
git add sources/smartrosary-audio
PYTHON=.venv/bin/python node scripts/build-site.mjs
node --test tests/*.test.mjs
```

Commit and push the reviewed installer pin update to deploy. Use the language
or intentions submodule path for those content updates. CI checks out the
recorded commits, builds all content, runs the tests, and deploys `dist/`.
Source repository pushes alone do not update the installer. Reverting a pin
and rebuilding restores that content revision; there is no manual binary copy
or generated binary commit step.
