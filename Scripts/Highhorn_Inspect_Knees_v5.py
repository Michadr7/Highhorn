import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Corrective_Trial.blend'))
r=bpy.data.objects['Armature']
for clip in ['idle','walk','run']:
 for f in [i/8 for i in range(8)]:
  pose(r,clip,f)
  print('KNEE',clip,f,[(s,tuple(round(v,2) for v in r.pose.bones[s+'Leg'].matrix_basis.to_euler())) for s in ['Left','Right']],flush=True)
