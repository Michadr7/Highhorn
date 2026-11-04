import json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'Corrections_v2';GALLERY=ROOT/'Exports/AssetSweep/2026-11-01/TestGallery'
assets=json.loads((BASE/'Roster_Test.json').read_text())
def triangles(p):
 data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);return sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
for a in assets:
 path=OUT/a['id']/'preview.glb'
 if not path.exists():continue
 a['url']='/'+path.relative_to(ROOT).as_posix()+'?revision=2';a['triangles']=triangles(path);a['revision']=2
 for v in a['variants']:
  p=path if v['id']=='original' else OUT/a['id']/'Appearance'/v['id']/'preview.glb'
  assert p.exists(),p;v['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=2'
 a['notes']='Fit revision 2: relaxed fingers and wrists, fitted boots, original hair restored. Skin presets retained.' if a['minLevel']==1 else 'Hand-pose revision 2; original face/outfit retained. Proposed level '+str(a['minLevel'])+' unlock.'
 if a['id'].startswith('elderly-'):a['notes']+=' Head proportions adjusted. Source reading glasses remain; accessories still need review.'
(OUT/'Roster_Test.json').write_text(json.dumps(assets,indent=2)+'\n');(GALLERY/'assets.json').write_text(json.dumps(assets,indent=2)+'\n')
print('Prepared corrected review roster')
