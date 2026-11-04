"""Inventory disposable files and verify an archive before any separate deletion.

This script never deletes files. Output paths are fixed to this project workspace.
The companion removal step consumes Manifest.json and verifies resolved paths.
"""
from pathlib import Path
import hashlib
import json
import os
import zipfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'Exports/ReleaseCleanup/2026-11-04'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / 'Manifest.json'
    if manifest_path.exists():
        raise RuntimeError('Existing cleanup manifest retained; inspect it before another run.')
    folders, backups = [], []
    for base, dirs, files in os.walk(ROOT):
        parent = Path(base)
        dirs[:] = [d for d in dirs if d != '.git' and not (parent / d).is_symlink()]
        if parent == OUT:
            dirs.clear()
            continue
        for name in list(dirs):
            path = parent / name
            rel = path.relative_to(ROOT)
            profile = rel.parts[0] == 'Exports' and (name == 'ChromeProfile' or name.startswith('.browser'))
            cache = rel.parts[0] == 'Scripts' and name == '__pycache__'
            if profile or cache:
                folders.append(path)
                dirs.remove(name)
        for name in files:
            path = parent / name
            if path.suffix == '.blend1' and path.relative_to(ROOT).parts[0] == 'Exports':
                if not path.with_suffix('.blend').is_file():
                    raise RuntimeError(f'No matching Blender file: {path}')
                backups.append(path)
    targets = []
    for path in sorted(folders):
        children = [p for p in path.rglob('*') if p.is_file()]
        if any(p.is_symlink() for p in path.rglob('*')):
            raise RuntimeError(f'Linked cleanup folder rejected: {path}')
        targets.append({'path': path.relative_to(ROOT).as_posix(), 'kind': 'directory',
                        'bytes': sum(p.stat().st_size for p in children), 'files': len(children)})
    backup_entries = []
    for path in sorted(backups):
        entry = {'path': path.relative_to(ROOT).as_posix(), 'kind': 'blender-backup',
                 'bytes': path.stat().st_size, 'sha256': digest(path)}
        backup_entries.append(entry)
    targets.extend(backup_entries)

    # Metadata for every file not targeted; hash all live game and runtime files.
    kept = []
    for base, dirs, files in os.walk(ROOT):
        parent = Path(base)
        dirs[:] = [d for d in dirs if d != '.git' and parent / d not in folders and parent / d != OUT]
        for name in files:
            path = parent / name
            if path in backups:
                continue
            stat = path.stat()
            rel = path.relative_to(ROOT).as_posix()
            entry = {'path': rel, 'bytes': stat.st_size, 'mtime_ns': stat.st_mtime_ns}
            if rel.split('/')[0] in ('assets', 'css', 'js', 'worker') or rel.startswith('Models/Heroes/') or '/' not in rel:
                entry['sha256'] = digest(path)
            kept.append(entry)
    write_json(OUT / 'Kept_Before.json', kept)
    archive = OUT / 'Blender_Backups.zip'
    print(f'Archiving {len(backups)} Blender backups; {sum(x["bytes"] for x in backup_entries):,} bytes', flush=True)
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1, allowZip64=True) as z:
        for i, entry in enumerate(backup_entries, 1):
            z.write(ROOT / entry['path'], entry['path'])
            if i % 10 == 0:
                print(f'Archived {i}/{len(backups)}', flush=True)
    with zipfile.ZipFile(archive) as z:
        if len(z.infolist()) != len(backup_entries):
            raise RuntimeError('Archive entry count mismatch')
        for entry in backup_entries:
            with z.open(entry['path']) as stream:
                actual = hashlib.file_digest(stream, 'sha256').hexdigest()
            if actual != entry['sha256']:
                raise RuntimeError(f'Archive hash mismatch: {entry["path"]}')
    manifest = {'root': str(ROOT), 'date': '2026-11-04', 'archive': archive.relative_to(ROOT).as_posix(),
                'archiveBytes': archive.stat().st_size, 'archiveSha256': digest(archive),
                'archiveVerified': True, 'targets': targets,
                'targetBytes': sum(x['bytes'] for x in targets),
                'note': 'No deletion performed by preparation. Standalone logs, .blend files, sources and reports retained.'}
    write_json(manifest_path, manifest)
    print(json.dumps({k: v for k, v in manifest.items() if k != 'targets'}, indent=2), flush=True)


if __name__ == '__main__':
    main()
