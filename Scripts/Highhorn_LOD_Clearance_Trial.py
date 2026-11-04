import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Optimize_Commoners import *
from Highhorn_Fit_Toon_v5 import checks
for gender in ['male','female']:
 dest=OUT/gender/'board';bpy.ops.wm.open_mainfile(filepath=str(dest/'Highhorn_Commoner_LOD_TEST.blend'));rig=bpy.data.objects[SOURCES[gender][2]];o=bpy.data.objects['Shoulders'];rig.data.pose_position='REST';bpy.context.view_layer.update();keys=o.data.shape_keys.key_blocks;old=[np.array([o.matrix_world@v.co for v in key.data]) for key in keys];p=old[0];inv=o.matrix_world.inverted();axes=[(np.array(rig.matrix_world@rig.data.bones[a].head_local),np.array(rig.matrix_world@rig.data.bones[b].head_local)) for a,b in [('Spine01','neck'),('LeftArm','LeftForeArm'),('RightArm','RightForeArm')]];directions=[]
 for q in p:
  centers=[a+np.clip(np.dot(q-a,b-a)/np.dot(b-a,b-a),0,1)*(b-a) for a,b in axes];center=min(centers,key=lambda c:np.linalg.norm(q-c));d=q-center;directions.append(d/max(np.linalg.norm(d),1e-9))
 directions=np.array(directions);rig.data.pose_position='POSE';reports=[]
 for amount in [.003,.006,.009]:
  for key,original in zip(keys,old):
   for v,q in zip(key.data,original+directions*amount):v.co=inv@Vector(q)
  o.data.update();bpy.context.view_layer.update();rows=checks(rig,32);peak=max(row['Tunic-Shoulders'] for row in rows);reports.append({'margin':amount,'peak':peak});print('BOARD_MARGIN',gender,amount,peak,flush=True)
  if peak==0:break
 (dest/'Clearance_Trial.json').write_text(json.dumps(reports,indent=2))
