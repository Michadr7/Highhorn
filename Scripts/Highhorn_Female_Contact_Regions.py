import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
D=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1';bpy.ops.wm.open_mainfile(filepath=str(D/'Female_Fit.blend'));r=bpy.data.objects['Female_Armature'];rows=[]
for clip in ['walk','run']:
 for i in range(16):
  f=i/16;pose(r,clip,f);a,fa,ta=surface(bpy.data.objects['Tunic']);b,fb,tb=surface(bpy.data.objects['Shoulders']);pairs=ta.overlap(tb)
  if pairs:rows.append({'clip':clip,'f':f,'pairs':len(pairs),'arm_y':{s:(r.matrix_world@r.pose.bones[s+'ForeArm'].head).y-(r.matrix_world@r.pose.bones[s+'Arm'].head).y for s in ['Left','Right']},'rest_centers':[np.mean([world_coords(bpy.data.objects['Shoulders'])[i] for i in fb[j]],axis=0).tolist() for _,j in pairs[::max(1,len(pairs)//3)]]})
(D/'Contact_Regions.json').write_text(json.dumps(rows,indent=2))
