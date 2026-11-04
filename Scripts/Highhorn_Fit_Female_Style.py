import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
from Highhorn_Fit_Toon_v4 import fit_legs,fit_shoulders
D=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/MedievalRoster/2026-11-01/CommonerBoots_v8/approved-female/approved-female_BOOTS_TEST.blend'))
r=bpy.data.objects['Female_Armature'];report={'legs':fit_legs(r),'shoulders':fit_shoulders(r),'boots':boot_clearance(r)}
r.data.pose_position='POSE'
for t in r.animation_data.nla_tracks:t.mute=True
report['poses']=checks(r,32)
(D/'Initial_Fit.json').write_text(json.dumps(report,indent=2));pose(r,'idle',0)
bpy.ops.wm.save_as_mainfile(filepath=str(D/'Female_Fit.blend'),compress=True)
print('FEMALE FIT',max(x['Tunic-Shoulders'] for x in report['poses']),max(x['Pants-Boots'] for x in report['poses']),flush=True)
