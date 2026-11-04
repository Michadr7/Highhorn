import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Corrective_Trial.blend'))
rig=bpy.data.objects['Armature'];o=bpy.data.objects['Boots'];original=world_coords(o);inv=o.matrix_world.inverted();reports=[]
for scale in [.02,.04,.06,.08]:
 for v,p in zip(o.data.vertices,original):
  p=p.copy()
  if p[2]>.16:
   t=float(np.clip((p[2]-.16)/.035,0,1));t=t*t*(3-2*t);p[1]-=scale*t
  v.co=inv@Vector(p)
 o.data.update();bpy.context.view_layer.update();rows=checks(rig,16)
 report={'scale':scale,'poses':rows};reports.append(report)
 print('BOOT_TRIAL',scale,max(r['Pants-Boots'] for r in rows),flush=True)
(OUT/'Boot_Trials.json').write_text(json.dumps(reports,indent=2))
