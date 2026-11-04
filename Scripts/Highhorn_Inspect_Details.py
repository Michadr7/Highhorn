import bpy
from pathlib import Path
from mathutils import Vector
r=Path(r'C:\Users\Michael\Documents\Projects\Highhorn')
bpy.ops.wm.open_mainfile(filepath=str(r/'Exports/Highhorn_Male_Commoner_Fit.blend'))
for o in bpy.context.scene.objects:
 print(o.name, [c.name for c in o.users_collection], 'custom',[(b.name,b.custom_shape.name) for b in o.pose.bones if b.custom_shape] if o.type=='ARMATURE' else '')
 if o.type=='MESH' and o.name=='char1':
  for evaluated in [False,True]:
   ob=o.evaluated_get(bpy.context.evaluated_depsgraph_get()) if evaluated else o
   pts=[ob.matrix_world@v.co for v in ob.data.vertices]
   print('VERTEX BOUNDS',evaluated,[(min(p[i] for p in pts),max(p[i] for p in pts)) for i in range(3)])
print('actions',[(a.name,a.frame_range[:]) for a in bpy.data.actions])
