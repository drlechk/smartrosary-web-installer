"""Build all configured voices with the pinned audio repository's packager."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    sys.path.insert(0, str(source))
    from audio_layout import voice_directory
    from littlefs import LittleFS
    from littlefs.context import UserContext

    config = json.loads((source / 'basic-prayer-texts.json').read_text())
    version = json.loads((source / 'audio-package.json').read_text())['version']
    names = {'de': 'Deutsch', 'en': 'English', 'es': 'Español', 'fr': 'Français',
             'it': 'Italiano', 'la': 'Latina', 'pl': 'Polski', 'pt': 'Português'}
    items = []
    for voice_id, voice in sorted(config['voices'].items()):
        backend = voice.get('backend', 'chatterbox')
        directory = voice_directory(voice_id, backend)
        relative = Path('audio') / directory / 'audio-rosary.bin'
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, str(source / 'build_audiofs.py'), voice_id,
                        '--root', str(source), '--output', str(target)], check=True)
        payload = target.read_bytes()
        if len(payload) != 0x134000:
            raise ValueError(f'{voice_id}: invalid audio partition size')
        fs = LittleFS(context=UserContext(buffer=bytearray(payload)),
                      block_size=4096, block_count=308)
        expected = {clip.name for clip in (source / directory).glob('*.mp3')}
        if not expected or set(fs.listdir('/')) != expected | {'audio-manifest.json'}:
            raise ValueError(f'{voice_id}: packaged clip list differs from source')
        with fs.open('/audio-manifest.json', 'r') as stream:
            metadata = json.load(stream)
        if metadata['id'] != voice_id or metadata['backend'] != backend or metadata['package_version'] != version:
            raise ValueError(f'{voice_id}: incorrect embedded metadata')
        fs.unmount()
        language = voice['texts']
        speaker = voice.get('speaker_id', directory.name.split('-', 1)[1])
        label = f"{names.get(language, language)} - {speaker.title()} · {'OmniVoice' if backend == 'omnivoice' else 'Chatterbox'}"
        items.append(dict(id=voice_id, backend=backend, speakerId=speaker, language=language,
                          voice=voice['voice'], label=label, version=version, path=relative.as_posix(),
                          size=len(payload), sha256=hashlib.sha256(payload).hexdigest()))
    if not items:
        raise ValueError('No audio voices configured')
    manifest = dict(format='smartrosary-audio-manifest-v1', version=version,
                    partition='audio-rosary', hardwareId='esp32-s3-touch-amoled-1-75', items=items)
    (output / 'audio/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Built and verified {len(items)} audio packages')


if __name__ == '__main__':
    main()
