import json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'Neck_v5';GALLERY=ROOT/'Exports/AssetSweep/2026-11-01/TestGallery'
assets=json.loads((BASE/'NaturalIdle_v4/Roster_Test.json').read_text())
for a in assets:
 if a['id'] not in ['businessman','man','elderly-man','elderly-woman']:continue
 p=OUT/a['id']/'preview.glb';assert p.exists(),p;a['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=5';a['revision']=5
 data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);a['triangles']=sum(doc['accessors'][prim['indices']]['count']//3 for mesh in doc['meshes'] for prim in mesh['primitives'])
 for v in a['variants']:
  p=OUT/a['id']/'preview.glb' if v['id']=='original' else OUT/a['id']/'Appearance'/v['id']/'preview.glb';assert p.exists(),p;v['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=5'
 a['notes']='Neck repair test: collar remnants removed and missing neck surface rebuilt. Natural idle, cuffs and numbered skin-tone choices retained.'
(OUT/'Roster_Test.json').write_text(json.dumps(assets,indent=2)+'\n');(GALLERY/'assets.json').write_text(json.dumps(assets,indent=2)+'\n');print('Prepared the four reported neck repairs; other characters unchanged')
