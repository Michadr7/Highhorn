import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Optimize_Commoners import *
from Highhorn_Fit_Toon_v5 import checks
bpy.ops.wm.open_mainfile(filepath=str(OUT/'male/board/Highhorn_Commoner_LOD_TEST.blend'));rows=checks(bpy.data.objects['Armature'],96)
print('PROTECTED_CONTACT_MAX',max(x['Tunic-Shoulders'] for x in rows),max(x['Pants-Boots'] for x in rows),flush=True)
