import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
D=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1';bpy.ops.wm.open_mainfile(filepath=str(D/'Female_Knee_Fit.blend'));r=bpy.data.objects['Female_Armature'];rows=[]
for clip in ['walk','run']:
 for i in range(16):
  f=i/16;pose(r,clip,f);a,fa,ta=surface(bpy.data.objects['Pants']);b,fb,tb=surface(bpy.data.objects['Boots']);pairs=ta.overlap(tb)
  if pairs:rows.append({'clip':clip,'f':f,'pairs':len(pairs),'knees':{s:r.pose.bones[s+'Leg'].matrix_basis.to_euler().x for s in ['Left','Right']},'pants_centers':[np.mean([world_coords(bpy.data.objects['Pants'])[i] for i in fa[j]],axis=0).tolist() for j,_ in pairs[::max(1,len(pairs)//3)]],'rest_centers':[np.mean([world_coords(bpy.data.objects['Boots'])[i] for i in fb[j]],axis=0).tolist() for _,j in pairs[::max(1,len(pairs)//3)]]})
(D/'Boot_Regions.json').write_text(json.dumps(rows,indent=2))
