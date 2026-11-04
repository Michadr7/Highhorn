import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
OUT=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Female_Knee_Fit.blend'))
r=bpy.data.objects['Female_Armature'];o=bpy.data.objects['Shoulders'];keys=o.data.shape_keys.key_blocks;old=[np.array([o.matrix_world@v.co for v in k.data]) for k in keys];inv=o.matrix_world.inverted();reports=[]
def sm(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
p=old[0];support=sm((-p[:,1]-.02)/.045)*sm((np.abs(p[:,0])-.07)/.07)*sm((p[:,2]-1.08)/.08)*sm((1.38-p[:,2])/.08)
for amount in [.008,.016,.024,.032]:
 delta=np.zeros_like(p);delta[:,1]=-amount*support
 for key,original in zip(keys,old):
  for v,q in zip(key.data,original+delta):v.co=inv@Vector(q)
 o.data.update();bpy.context.view_layer.update();rows=checks(r,48);peak=max(row['Tunic-Shoulders'] for row in rows);reports.append({'front_margin_m':amount,'peak_shoulder_pairs':peak,'poses':rows});print('FRONT_FIT',amount,peak,flush=True)
 if peak==0:break
(OUT/'Front_Fit.json').write_text(json.dumps(reports,indent=2));pose(r,'idle',0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Female_Final_Fit.blend'),compress=True)
