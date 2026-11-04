"""Publish isolated roster candidates into the existing local review gallery."""
import json, shutil, struct
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'Exports/MedievalRoster/2026-11-01'
GALLERY=ROOT/'Exports/AssetSweep/2026-11-01/TestGallery'
backup=OUT/'Gallery_Before'
if not backup.exists():
 backup.mkdir(parents=True)
 for name in ['assets.json','viewer.js','index.html']: shutil.copy2(GALLERY/name,backup/name)
assets=json.loads((backup/'assets.json').read_text(encoding='utf-8-sig'))
names={'man':('Villager',1,'male'),'businessman':('Townsman',1,'male'),'woman':('Townswoman',1,'female'),'elderly-man':('Village Elder (Male)',1,'male'),'elderly-woman':('Village Elder (Female)',1,'female'),'viking':('Viking',10,'male'),'armored-knight':('Armored Knight',15,'male'),'elf':('Elven Ranger',15,'male'),'wizard':('Wizard',20,'male'),'witch':('Witch',20,'female'),'king':('Winter King',30,'male'),'queen':('Desert Queen',30,'female')}
def url(p): return '/'+p.relative_to(ROOT).as_posix()
def inspect(p):
 data=p.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);tri=0
 for mesh in doc['meshes']:
  for prim in mesh['primitives']: tri+=doc['accessors'][prim['indices']]['count']//3
 return tri
for a in assets:
 key=a['id']
 if key in names:
  a['name'],a['minLevel'],a['gender']=names[key]
  p=OUT/key/'preview.glb';a['url']=url(p);a['triangles']=inspect(p)
  a['notes']=('Medieval clothing fitting test. Original face, native skeleton and walk/run retained.' if a['minLevel']==1 else 'Original outfit and appearance retained. Proposed level '+str(a['minLevel'])+' unlock; balance pending.')
 else:
  a['minLevel']=1;a['gender']='female' if 'female' in key else 'male'
 a['variants']=[{'id':'original','name':'Original appearance','url':a['url']}]
 if a['minLevel']==1:
  for variant,label in [('warm-medium','Warm medium skin'),('deep-warm','Warm brown skin')]:
   p=OUT/key/'Appearance'/variant/'preview.glb'
   if p.exists(): a['variants'].append({'id':variant,'name':label,'url':url(p)})
 a['appearancePolicy']='starter-variants' if a['minLevel']==1 else 'fixed-unlock'
(GALLERY/'assets.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf-8')
(OUT/'Roster_Test.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf-8')
p=GALLERY/'index.html';s=(backup/'index.html').read_text(encoding='utf-8-sig')
s=s.replace('<p id="notes"', '<label for="appearance">Appearance</label><select id="appearance"></select><p id="notes"')
s=s.replace('Source characters for review. Compare with the approved Commoners, then inspect the supplied animations.','Medieval roster tests: compare clothing, relaxed idle, skin presets and proposed unlocks.')
s=s.replace('A bind pose is not a natural idle. New sources have not been optimized or approved for the game.','Idle is the normal preview. Bind pose is for inspection. These staged exports are awaiting fit approval and game optimization.')
s=s.replace('href="../README.md"','href="/Exports/MedievalRoster/2026-11-01/README.md"')
p.write_text(s,encoding='utf-8')
p=GALLERY/'viewer.js';s=(backup/'viewer.js').read_text(encoding='utf-8-sig')
s=s.replace('async function load(id){const asset=assets.find(a=>a.id===id);',"async function load(id,variant='original'){const base=assets.find(a=>a.id===id);const choice=base?.variants.find(v=>v.id===variant)||base?.variants[0];const asset=base?{...base,url:choice.url,appearance:choice.id}:null;")
s=s.replace("const generation=++token;", "$('#asset').value=id;$('#appearance').replaceChildren(...asset.variants.map(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name;return o;}));$('#appearance').value=asset.appearance;$('#appearance').disabled=asset.variants.length===1;const generation=++token;")
s=s.replace("fit();setClip('bind');", "fit();setClip(current.clips.idle?'idle':'bind');")
s=s.replace("'Original source; production fit pending'", "'Staged roster test · proposed level '+asset.minLevel")
s=s.replace("$('#asset').onchange=e=>load(e.target.value);", "$('#asset').onchange=e=>load(e.target.value);$('#appearance').onchange=e=>load(current.id,e.target.value);")
s=s.replace('id:current?.id,ready:', 'id:current?.id,appearance:current?.appearance,ready:')
s=s.replace('reference:!!a.reference}', 'reference:!!a.reference,variants:a.variants,minLevel:a.minLevel}')
s=s.replace("$('#asset').value='viking';return load('viking');", "$('#asset').value='man';return load('man');")
p.write_text(s,encoding='utf-8')
print('Prepared',len(assets),'roster candidates; hair fitting prototypes excluded pending correction.')
