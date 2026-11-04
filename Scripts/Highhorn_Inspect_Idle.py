import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/GameReady/Highhorn_Male_Commoner_EXPORT.blend'))
rig=bpy.data.objects['Armature']; scene=bpy.context.scene
report={'bones':[],'poses':{}}
for b in rig.data.bones:
 report['bones'].append({'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None})
for action in ['walk','run']:
 a=bpy.data.actions[action];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for frame in [0,6,12]:
  scene.frame_set(frame)
  report['poses'][action+str(frame)]={b.name:{'head':list(b.head),'tail':list(b.tail),'q':list(b.rotation_quaternion)} for b in rig.pose.bones}
(ROOT/'Exports/HeroPhase2/Idle_Inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
