import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent
result={}
for slug in ['man','businessman','woman','elderly-man','elderly-woman']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'Exports/MedievalRoster/2026-11-01/{slug}/{slug}_MEDIEVAL_TEST.blend'))
 rig=bpy.data.objects['Roster_Armature'];rig.data.pose_position='REST';bpy.context.view_layer.update()
 body=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'))
 points=[body.matrix_world@v.co for v in body.data.vertices];adj=[[] for v in points]
 for edge in body.data.edges:
  a,b=edge.vertices;adj[a].append(b);adj[b].append(a)
 neck=rig.matrix_world@rig.data.bones['neck'].head_local;head=rig.matrix_world@rig.data.bones['Head'].head_local
 seen=set();components=[]
 for i in range(len(points)):
  if i in seen:continue
  stack=[i];seen.add(i);ids=[]
  while stack:
   j=stack.pop();ids.append(j)
   for k in adj[j]:
    if k not in seen:seen.add(k);stack.append(k)
  if len(ids)<30 or max(points[j].z for j in ids)<neck.z-.02:continue
  lo=[min(points[j][axis] for j in ids) for axis in range(3)];hi=[max(points[j][axis] for j in ids) for axis in range(3)]
  components.append({'seed':i,'vertices':len(ids),'lo':lo,'hi':hi})
 boots=bpy.data.objects['Boots'];bp=[boots.matrix_world@v.co for v in boots.data.vertices]
 result[slug]={'head':list(head),'neck':list(neck),'components':sorted(components,key=lambda c:c['vertices'],reverse=True),'bones':{n:list(rig.matrix_world@rig.data.bones[n].head_local) for n in ['LeftFoot','LeftToeBase','LeftHand','LeftForeArm'] if n in rig.data.bones},'boots_bounds':[[min(p[a] for p in bp),max(p[a] for p in bp)] for a in range(3)]}
 print(slug,'COMPONENTS',len(components),flush=True)
(ROOT/'Exports/MedievalRoster/2026-11-01/Correction_Inspection.json').write_text(json.dumps(result,indent=2))
