import json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'Corrections_v3';GALLERY=ROOT/'Exports/AssetSweep/2026-11-01/TestGallery'
assets=json.loads((BASE/'Corrections_v2/Roster_Test.json').read_text())
for a in assets:
 if a['minLevel']==1:
  for number,v in enumerate(a['variants'],1):v['name']='Skin tone '+str(number);v['gameDisplayName']=v['name']
 p=OUT/a['id']/'preview.glb'
 if p.exists():
  a['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=3';a['revision']=3
  data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);a['triangles']=sum(doc['accessors'][prim['indices']]['count']//3 for mesh in doc['meshes'] for prim in mesh['primitives'])
  for v in a['variants']:
   p=OUT/a['id']/'preview.glb' if v['id']=='original' else OUT/a['id']/'Appearance'/v['id']/'preview.glb'
   assert p.exists(),p;v['url']='/'+p.relative_to(ROOT).as_posix()+'?revision=3'
  a['notes']='Wrist revision 3: forearm roll and fitted cuff. Skin textures unchanged.' if a['minLevel']==1 else 'Wrist revision 3. Original outfit retained; proposed level '+str(a['minLevel'])+' unlock.'
(OUT/'Roster_Test.json').write_text(json.dumps(assets,indent=2)+'\n');(GALLERY/'assets.json').write_text(json.dumps(assets,indent=2)+'\n')
print('Prepared wrist review and numbered skin labels; stable IDs retained')
