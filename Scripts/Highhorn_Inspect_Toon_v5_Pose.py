import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4/Highhorn_Commoner_TOON_v4_TEST.blend'))
rig=bpy.data.objects['Armature'];rows=[]
for clip in ['idle','walk','run']:
 for f in [i/8 for i in range(8)]:
  pose(rig,clip,f);r={'clip':clip,'f':f}
  for side in ['Left','Right']:
   a=rig.matrix_world@rig.pose.bones[side+'Arm'].head;b=rig.matrix_world@rig.pose.bones[side+'ForeArm'].head
   r[side]=list(b-a)
  rows.append(r)
print(json.dumps(rows),flush=True)
