import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/StyleStudy/2026-11-02/Toon_v3/Highhorn_Commoner_TOON_v3_TEST.blend'))
rig=bpy.data.objects['Armature'];rig.data.pose_position='REST';bpy.context.view_layer.update()
for name in ['Shoulders','Pants','Boots']:
 o=bpy.data.objects[name];coords=[o.matrix_world@v.co for v in o.data.vertices];weld={};mapping={}
 for i,p in enumerate(coords):
  k=tuple(round(x,5) for x in p);mapping[i]=weld.setdefault(k,i)
 counts={}
 for f in o.data.polygons:
  ids=[mapping[i] for i in f.vertices]
  for a,b in zip(ids,ids[1:]+ids[:1]):
   if a!=b:k=tuple(sorted([a,b]));counts[k]=counts.get(k,0)+1
 edges=[e for e,n in counts.items() if n==1];adj={}
 for a,b in edges:adj.setdefault(a,set()).add(b);adj.setdefault(b,set()).add(a)
 seen=set();groups=[]
 for i in adj:
  if i in seen:continue
  ids=set();todo=[i]
  while todo:
   j=todo.pop()
   if j in ids:continue
   ids.add(j);todo.extend(adj[j]-ids)
  seen.update(ids);p=np.array([coords[j] for j in ids]);groups.append({'vertices':len(ids),'bounds':[p.min(0).tolist(),p.max(0).tolist()],'branched':sum(len(adj[j])!=2 for j in ids)})
 print(name,'WELDED BOUNDARIES',json.dumps(groups),flush=True)
 for z in ([.2,.25,.3] if name!='Shoulders' else [1.4]):
  rows={}
  for i,p in enumerate(coords):
   if p.x>.05 and abs(p.z-z)<.025:
    for g in o.data.vertices[i].groups:rows[o.vertex_groups[g.group].name]=rows.get(o.vertex_groups[g.group].name,0)+g.weight
  s=sum(rows.values());print(name,z,{k:round(v/s,3) for k,v in rows.items()},flush=True)
