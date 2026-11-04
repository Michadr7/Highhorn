import json,struct,sys
from pathlib import Path
R=Path(__file__).resolve().parent.parent;O=R/'Exports/MedievalRoster/2026-11-01/VillagerNeck_v9';G=R/'Exports/AssetSweep/2026-11-01/TestGallery';a=json.loads((O/'assets_before.json').read_text());ids=sys.argv[1:] or ['man']
for x in a:
 if x['id'] not in ids:continue
 for v in x['variants']:
  p=O/x['id']/'preview.glb' if v['id']=='original' else O/x['id']/'Appearance'/v['id']/'preview.glb';assert p.exists(),p;v['url']='/'+p.relative_to(R).as_posix()+'?revision=9'
 x['url']=x['variants'][0]['url'];x['revision']=9;p=O/x['id']/'preview.glb';d=p.read_bytes();j=json.loads(d[20:20+struct.unpack_from('<I',d,12)[0]]);x['triangles']=sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives']);x['notes']='Native face/neck restoration test. Source facial surfaces and UVs retained; collar refitted. Review all angles before approval.'
(O/'Roster_Test.json').write_text(json.dumps(a,indent=2));(G/'assets.json').write_text(json.dumps(a,indent=2))
