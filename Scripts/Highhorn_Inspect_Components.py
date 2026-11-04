import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'Exports/Highhorn_Male_Commoner_Dimension_Test.blend'))
for name in ['Tunic','Shoulders','Pants','Boots']:
 o=bpy.data.objects[name];adj=[[] for v in o.data.vertices]
 for e in o.data.edges:
  a,b=e.vertices;adj[a].append(b);adj[b].append(a)
 seen=set();comps=[]
 for i in range(len(adj)):
  if i in seen:continue
  stack=[i];seen.add(i);ids=[]
  while stack:
   j=stack.pop();ids.append(j)
   for k in adj[j]:
    if k not in seen:seen.add(k);stack.append(k)
  p=[o.matrix_world@o.data.vertices[j].co for j in ids]
  comps.append((len(ids),[(round(min(v[k] for v in p),3),round(max(v[k] for v in p),3)) for k in range(3)]))
 print(name,sorted(comps,reverse=True)[:20])
