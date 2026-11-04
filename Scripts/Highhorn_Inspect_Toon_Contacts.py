import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
from Highhorn_Fit_Toon_v4 import surface,pose
out=ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4'
bpy.ops.wm.open_mainfile(filepath=str(out/'Highhorn_Commoner_TOON_v4_TEST.blend'))
rig=bpy.data.objects['Armature']
for clip,f in [('idle',0),('run',.125),('run',0)]:
 pose(rig,clip,f)
 for na,nb in [('Tunic','Shoulders'),('Pants','Boots')]:
  a,fa,ta=surface(bpy.data.objects[na]);b,fb,tb=surface(bpy.data.objects[nb]);pairs=ta.overlap(tb);ids=set(j for _,j in pairs)
  p=np.array([np.mean([b[i] for i in fb[j]],axis=0) for j in ids]);bins={}
  for v in p:
   key=tuple(round(float(x)/.05)*.05 for x in v);bins[str(tuple(round(x,2) for x in key))]=bins.get(str(tuple(round(x,2) for x in key)),0)+1
  print(clip,f,na,nb,'pairs',len(pairs),'region faces',sorted(bins.items(),key=lambda a:-a[1]),flush=True)
