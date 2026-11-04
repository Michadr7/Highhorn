import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
OUT=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Female_Final_Fit.blend'))
r=bpy.data.objects['Female_Armature'];o=bpy.data.objects['Boots'];old=world_coords(o);inv=o.matrix_world.inverted();reports=[]
for shrink in [.1,.2,.3]:
 for v,p in zip(o.data.vertices,old):
  q=p.copy();side='Left' if p[0]>0 else 'Right';a=np.array(r.matrix_world@r.data.bones[side+'Foot'].head_local);b=np.array(r.matrix_world@r.data.bones[side+'Leg'].head_local);axis=a+(b-a)*(p[2]-a[2])/(b[2]-a[2]);t=float(np.clip((p[2]-.16)/.035,0,1));t=t*t*(3-2*t);q[0]=axis[0]+(p[0]-axis[0])*(1-shrink*t);v.co=inv@Vector(q)
 o.data.update();bpy.context.view_layer.update();rows=checks(r,48);peak=max(x['Pants-Boots'] for x in rows);reports.append({'shaft_x_shrink':shrink,'max_boot_pairs':peak,'poses':rows});print('SHAFT',shrink,peak,flush=True)
 if peak==0:break
(OUT/'Final_Clearance.json').write_text(json.dumps(reports,indent=2));pose(r,'idle',0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Female_Final_Fit.blend'),compress=True)
