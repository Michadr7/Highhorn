import json,struct
from pathlib import Path
R=Path(__file__).resolve().parent.parent;O=R/'Exports/MedievalRoster/2026-11-01/Garment_v6';G=R/'Exports/AssetSweep/2026-11-01/TestGallery'
a=json.loads((O/'assets_before.json').read_text())
for x in a:
 if x['id'] not in ['businessman','woman','elderly-woman','man','elderly-man']:continue
 for v in x['variants']:
  p=O/x['id']/'preview.glb' if v['id']=='original' else O/x['id']/'Appearance'/v['id']/'preview.glb'
  assert p.exists(),p
  v['url']='/'+p.relative_to(R).as_posix()+'?revision=6'
 x['url']=x['variants'][0]['url'];x['revision']=6
 p=O/x['id']/'preview.glb';d=p.read_bytes();doc=json.loads(d[20:20+struct.unpack_from('<I',d,12)[0]]);x['triangles']=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
 x['notes']='Garment repair test: waist weights corrected.' if x['id']=='woman' else 'Garment repair test: inner collar lining fitted to the measured hood opening. Natural idle and skin tones retained.'
(O/'Roster_Test.json').write_text(json.dumps(a,indent=2));(G/'assets.json').write_text(json.dumps(a,indent=2))
