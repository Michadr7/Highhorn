"""Check whether sampled contact faces are exposed from external directions."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Corrective_Trial.blend'))
rig=bpy.data.objects['Armature'];rows=[]
directions=[]
for i in range(48):
 z=1-2*(i+.5)/48;r=math.sqrt(1-z*z);theta=i*math.pi*(3-math.sqrt(5));directions.append(Vector((r*math.cos(theta),r*math.sin(theta),z)))
for clip in ['idle','walk','run']:
 for fraction in [i/16 for i in range(16)]:
  pose(rig,clip,fraction);surfaces={n:surface(bpy.data.objects[n]) for n in ['char1','Tunic','Pants','Boots','Shoulders']}
  for na,nb in [('Tunic','Shoulders'),('Pants','Boots')]:
   a,fa,ta=surfaces[na];b,fb,tb=surfaces[nb];pairs=ta.overlap(tb);exposed=[]
   for j in set(j for _,j in pairs):
    p=sum((b[i] for i in fb[j]),Vector())/len(fb[j])
    visible=0
    for d in directions:
     start=p+d*3;hits=[]
     for name,(_,_,tree) in surfaces.items():
      q,n,fi,dist=tree.ray_cast(start,-d,3.005)
      if q is not None:hits.append((dist,name,fi))
     if hits:
      dist,name,fi=min(hits)
      if name==nb and abs(dist-3)<.002:visible+=1
    if visible:exposed.append({'face':j,'directions':visible,'center':list(p)})
   rows.append({'clip':clip,'fraction':fraction,'pair':[na,nb],'contacts':len(pairs),'externally_visible_face_centers':exposed})
(OUT/'Contact_Visibility.json').write_text(json.dumps(rows,indent=2))
print('CONTACT VISIBILITY',[(c,n,sum(len(r['externally_visible_face_centers']) for r in rows if r['clip']==c and r['pair'][1]==n)) for c in ['idle','walk','run'] for n in ['Shoulders','Boots']],flush=True)
