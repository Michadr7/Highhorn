"""Safely unpack approved archives and inventory actual geometry/material/license files."""
import json,zipfile,collections,hashlib
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';PACKS=ROOT/'Models/AssetSweepSources/2026-11-01/AppearancePacks'
reports=[]
for pack in ['hair01','bodyparts05','skins01','skins02']:
 source=PACKS/(pack+'_cc0.zip');dest=PACKS/'Extracted'/pack;dest.mkdir(parents=True,exist_ok=True);counts=collections.Counter();assets={}
 with zipfile.ZipFile(source) as archive:
  assert archive.testzip() is None
  for info in archive.infolist():
   name=PurePosixPath(info.filename);assert not name.is_absolute() and '..' not in name.parts and ':' not in info.filename
   target=(dest/Path(*name.parts)).resolve();assert target.is_relative_to(dest.resolve())
   if info.is_dir():target.mkdir(parents=True,exist_ok=True);continue
   target.parent.mkdir(parents=True,exist_ok=True)
   if not target.exists():
    with archive.open(info) as incoming,target.open('wb') as output:
     while block:=incoming.read(1024*1024):output.write(block)
   counts[target.suffix.lower()]+=1
   key='/'.join(name.parts[:2]);entry=assets.setdefault(key,{'id':name.parts[1] if len(name.parts)>1 else name.parts[0],'files':[],'license_lines':[]})
   entry['files'].append(str(target.relative_to(ROOT)))
   if target.suffix in ['.mhmat','.mhclo','.txt']:
    for line in target.read_text(encoding='utf-8-sig',errors='replace').splitlines():
     if any(word in line.lower() for word in ['license','copyright','author']):entry['license_lines'].append(line.strip())
  entries=[a for a in assets.values() if any(Path(f).suffix in ['.obj','.mhmat'] for f in a['files'])]
  report={'id':pack,'archive_bytes':source.stat().st_size,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'archive_crc_passed':True,'file_types':dict(counts),'asset_count':len(entries),'assets':entries}
  reports.append(report);print(json.dumps({k:v for k,v in report.items() if k!='assets'}),flush=True)
(OUT/'Appearance_Inventory.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
