import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
OUT=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1';bpy.ops.wm.open_mainfile(filepath=str(OUT/'Female_Final_Fit.blend'))
r=bpy.data.objects['Female_Armature'];o=bpy.data.objects['Shoulders'];key=o.data.shape_keys.key_blocks['Left backswing clearance'];old=np.array([o.matrix_world@v.co for v in key.data]);p=world_coords(o);support=np.exp(-np.sum((p-np.array([.175,.199,1.18]))**2,axis=1)/(.025**2));inv=o.matrix_world.inverted();reports=[]
previous=json.loads((OUT/'Rear_Margin.json').read_text())[-1]['local_margin_per_xy_m']
old-=support[:,None]*np.array([previous,previous,0])
for amount in [-.002,-.004,-.008]:
 for v,q,w in zip(key.data,old,support):v.co=inv@Vector(q+np.array([amount,amount,0])*w)
 o.data.update();bpy.context.view_layer.update();rows=checks(r,96);peak=max(row['Tunic-Shoulders'] for row in rows);reports.append({'local_margin_per_xy_m':amount,'peak_shoulder_pairs':peak,'poses':rows});print('REAR_MARGIN',amount,peak,flush=True)
 if peak==0:break
(OUT/'Rear_Margin.json').write_text(json.dumps(reports,indent=2));pose(r,'idle',0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Female_Final_Fit.blend'),compress=True)
