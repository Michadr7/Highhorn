import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'Exports/Highhorn_Male_Commoner_Dimension_Test.blend'))
r=bpy.data.objects['Armature']
for b in r.data.bones:
 if any(t in b.name.lower() for t in ['neck','spine','leg','foot','arm','shoulder','hips']): print(b.name,tuple(round(x,4) for x in r.matrix_world@b.head_local))
for name in ['char1','Tunic','Pants','Boots','Shoulders']:
 o=bpy.data.objects[name];p=[o.matrix_world@v.co for v in o.data.vertices]
 print(name,'bounds',[(round(min(v[i] for v in p),4),round(max(v[i] for v in p),4)) for i in range(3)])
 if name=='char1':
  for z in [.15,.3,.45,.6,.8,1,1.15,1.3,1.4]:
   vs=[v for v in p if abs(v.z-z)<.015 and abs(v.x)<.24]
   if vs: print(z,[(round(min(v[i] for v in vs),4),round(max(v[i] for v in vs),4)) for i in range(2)])
