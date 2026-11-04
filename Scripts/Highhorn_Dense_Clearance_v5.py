import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Knee_Fold_Trial.blend'))
r=bpy.data.objects['Armature'];o=bpy.data.objects['Shoulders'];keys=o.data.shape_keys.key_blocks;base=np.array([v.co for v in keys[0].data]);offsets=[np.array([v.co for v in k.data])-base for k in list(keys)[1:]];reports=[]
for factor in [1.03,1.06,1.10]:
 for key,delta in zip(list(keys)[1:],offsets):
  for v,p in zip(key.data,base+delta*factor):v.co=p
 o.data.update();bpy.context.view_layer.update();rows=checks(r,96);peak=max(row['Tunic-Shoulders'] for row in rows)
 reports.append({'factor':factor,'peak_shoulder_pairs':peak});print('DENSE_CLEARANCE',factor,peak,flush=True)
 if peak==0:break
(OUT/'Dense_Clearance.json').write_text(json.dumps(reports,indent=2));pose(r,'idle',0)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Final_Fit.blend'),compress=True)
