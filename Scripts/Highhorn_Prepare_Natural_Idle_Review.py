import json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'NaturalIdle_v4';GALLERY=ROOT/'Exports/AssetSweep/2026-11-01/TestGallery'
assets=json.loads((BASE/'Corrections_v3/Roster_Test.json').read_text())
for a in assets:
 if a.get('reference'):continue
 p=OUT/a['id']/'preview.glb';assert p.exists(),p;a['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=4';a['revision']=4
 data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);a['triangles']=sum(doc['accessors'][prim['indices']]['count']//3 for mesh in doc['meshes'] for prim in mesh['primitives'])
 for v in a['variants']:
  p=OUT/a['id']/'preview.glb' if v['id']=='original' else OUT/a['id']/'Appearance'/v['id']/'preview.glb';assert p.exists(),p;v['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=4'
 a['notes']='Natural idle test: lower arms, inward palms, gentle finger curl and subtle torso sway. Existing cuffs and skin textures retained.'
 if a['minLevel']>1:a['notes']+=' Proposed level '+str(a['minLevel'])+' unlock.'
(OUT/'Roster_Test.json').write_text(json.dumps(assets,indent=2)+'\n');(GALLERY/'assets.json').write_text(json.dumps(assets,indent=2)+'\n');print('Prepared natural idle review')
