"""Locate V4 contacts in rest/posed space before fitting V5."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
from Highhorn_Fit_Toon_v4 import surface,pose,world_coords
out=ROOT/'Exports/StyleStudy/2026-11-03/Toon_v5'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(out/'Corrective_Trial.blend'))
rig=bpy.data.objects['Armature'];rows=[]
for clip,f in [('idle',0),('run',0),('run',.125),('run',.375),('run',.875)]:
 pose(rig,clip,f)
 for na,nb in [('Tunic','Shoulders'),('Pants','Boots')]:
  a,fa,ta=surface(bpy.data.objects[na]);b,fb,tb=surface(bpy.data.objects[nb]);pairs=ta.overlap(tb)
  ob=bpy.data.objects[nb];rest=world_coords(ob);ar=world_coords(bpy.data.objects[na]);bins={}
  for j in set(j for _,j in pairs):
   p=np.mean([rest[i] for i in fb[j]],axis=0)
   key=str(tuple(round(float(x)/.04)*.04 for x in p));row=bins.setdefault(key,{'faces':0,'weights':{}});row['faces']+=1
   for vi in fb[j]:
    for g in ob.data.vertices[vi].groups:
     n=ob.vertex_groups[g.group].name;row['weights'][n]=row['weights'].get(n,0)+g.weight/len(fb[j])
  for row in bins.values():row['weights']={n:round(w/row['faces'],3) for n,w in row['weights'].items() if w/row['faces']>.005}
  examples=[]
  for i,j in pairs[::max(1,len(pairs)//8)]:
   examples.append({'a':np.mean([ar[k] for k in fa[i]],axis=0).tolist(),'b':np.mean([rest[k] for k in fb[j]],axis=0).tolist()})
  rows.append({'clip':clip,'fraction':f,'pair':[na,nb],'contacts':len(pairs),'rest_regions':bins,'examples':examples})
(out/'Inspection_Draft.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows),flush=True)
