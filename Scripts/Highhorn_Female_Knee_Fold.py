"""Test local cloth compression at the back of the bent thigh, preserving bone keys."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
OUT=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Corrective_Trial.blend'))
rig=bpy.data.objects['Female_Armature'];o=bpy.data.objects['Pants'];original=world_coords(o);inv=o.matrix_world.inverted();reports=[]
o.shape_key_add(name='Basis');keys={s:o.shape_key_add(name=s+' knee fold clearance') for s in ['Left','Right']}
for side,key in keys.items():
 d=key.driver_add('value').driver;v=d.variables.new();v.name='k';v.type='TRANSFORMS';t=v.targets[0];t.id=rig;t.bone_target=side+'Leg';t.transform_type='ROT_X';t.transform_space='TRANSFORM_SPACE';t.rotation_mode='XYZ'
 x='min(1,max(0,(k-1.5)/0.65))';d.expression=f'({x})*({x})*(3-2*({x}))'
def smooth(x):
 x=float(np.clip(x,0,1));return x*x*(3-2*x)
for amount in [.025,.05,.075,.10]:
 for side,key in keys.items():
  for v,p in zip(key.data,original):
   q=p.copy()
   if (p[0]>0)==(side=='Left'):
    w=smooth((p[2]-.48)/.15)*smooth((.98-p[2])/.16)*smooth((p[1]-.04)/.10)
    q[1]-=amount*w
   v.co=inv@Vector(q)
 o.data.update();bpy.context.view_layer.update();rows=checks(rig,32)
 report={'amount':amount,'poses':rows};reports.append(report)
 print('PANTS_TRIAL',amount,max(r['Pants-Boots'] for r in rows),flush=True)
 if max(r['Pants-Boots'] for r in rows)==0:break
(OUT/'Knee_Fold_Trials.json').write_text(json.dumps(reports,indent=2))
pose(rig,'idle',0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Female_Knee_Fit.blend'),compress=True)
