"""Prepare a local public-file snapshot using the exact .assetsignore policy.

Uses Git's ignore engine; never stages, commits, pushes or deploys anything.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent
VERSION = '0.27.0'
OUT = ROOT / 'Exports/Release' / VERSION
GIT = shutil.which('git') or r'C:\Users\Michael\AppData\Local\GitHubDesktop\app-3.6.10\resources\app\git\cmd\git.exe'


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def main():
    policy = OUT / 'PolicyCheck'
    public = OUT / 'Public'
    policy.mkdir(parents=True, exist_ok=True)
    (policy / '.gitignore').write_bytes((ROOT / '.assetsignore').read_bytes())
    paths = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d != '.git']
        for name in files:
            paths.append((Path(base) / name).relative_to(ROOT).as_posix())
    checks = ['.git/config', '.env', 'Exports/private.blend', 'Models/Heroes/MaleCommoner/Toon_v1/source.blend']
    inputs = paths + checks
    result = subprocess.run([GIT, '--git-dir=' + str(ROOT / '.git'), '--work-tree=' + str(policy),
                             '-c', 'core.excludesFile=NUL', 'check-ignore', '--no-index', '-v', '-z', '--stdin'],
                            input=('\0'.join(inputs) + '\0').encode(), capture_output=True, cwd=policy)
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr.decode())
    fields = result.stdout.decode().split('\0')
    excluded = {fields[i + 3]: not fields[i + 2].startswith('!') for i in range(0, len(fields) - 1, 4)}
    assert all(excluded.get(p, False) for p in checks)
    selected = sorted(p for p in paths if not excluded.get(p, False))
    expected = {'index.html', 'favicon.svg', '_headers'}
    expected.update(p.relative_to(ROOT).as_posix() for directory in ['css', 'js', 'assets']
                    for p in (ROOT / directory).rglob('*') if p.is_file())
    expected.update(f'Models/Heroes/{gender}/Toon_v1/{name}'
                    for gender in ['MaleCommoner', 'FemaleCommoner'] for name in ['hero.glb', 'board.glb', 'portrait.png'])
    assert set(selected) == expected, (set(selected) - expected, expected - set(selected))
    assert 'worker/index.js' not in selected and 'wrangler.jsonc' not in selected
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert html.count('Version ' + VERSION) == 2
    assert '0.26.8' not in html
    assert "const RULESET = '0.20.0';" in (ROOT / 'js/engine.js').read_text(encoding='utf-8')
    entries = []
    for rel in selected:
        source = ROOT / rel
        target = public / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        digest = sha(source)
        assert sha(target) == digest
        assert source.stat().st_size < 25 * 1024 * 1024, rel
        entries.append({'path': rel, 'bytes': source.stat().st_size, 'sha256': digest})
    # A rerun cannot silently leave stale public files in its snapshot.
    assert {p.relative_to(public).as_posix() for p in public.rglob('*') if p.is_file()} == expected
    manifest = {'version': VERSION, 'ruleset': '0.20.0', 'files': entries,
                'publicBytes': sum(e['bytes'] for e in entries),
                'assetsIgnoreSha256': sha(ROOT / '.assetsignore'), 'gitIgnoreSha256': sha(ROOT / '.gitignore'),
                'workerSha256': sha(ROOT / 'worker/index.js'), 'wranglerSha256': sha(ROOT / 'wrangler.jsonc'),
                'policyPassed': True, 'scope': 'Local file-selection snapshot, not a Wrangler upload or deployment.'}
    (OUT / 'Manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'version': VERSION, 'publicFiles': len(entries), 'publicBytes': manifest['publicBytes'],
                      'policyPassed': True}, indent=2))


if __name__ == '__main__':
    main()
