import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
O=ROOT/'Exports/MedievalRoster/2026-11-01/CommonerBoots_v8';O.mkdir(exist_ok=True);rows=[]
sources={'approved-male':ROOT/'Exports/HeroPhase2/ClippingFix/Highhorn_Commoner_IDLE_CLEARANCE_TEST.blend','approved-female':ROOT/'Exports/FemaleCommoner/Highhorn_Female_Commoner_TEST.blend'}
for slug,path in sources.items():
 bpy.ops.wm.open_mainfile(filepath=str(path));boot=bpy.data.objects['Boots'];rig=next(m.object for m in boot.modifiers if m.type=='ARMATURE');rig.data.pose_position='REST';bpy.context.view_layer.update();row={'id':slug,'rig':rig.name,'sides':{}}
 for side,sign in [('Left',1),('Right',-1)]:
  foot=rig.matrix_world@rig.data.bones[side+'Foot'].head_local;toe=rig.matrix_world@rig.data.bones[side+'ToeBase'].head_local;ps=[boot.matrix_world@v.co for v in boot.data.vertices if (boot.matrix_world@v.co).x*sign>0 and (boot.matrix_world@v.co).z<foot.z+.035];row['sides'][side]={'ankle':list(foot),'toe_end':list(toe),'bounds':[[min(p[i] for p in ps),max(p[i] for p in ps)] for i in range(3)]}
 rows.append(row)
(O/'Inspection.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows),flush=True)
