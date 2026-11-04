import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/MedievalRoster/2026-11-01/Anatomy_v7/elderly-woman/elderly-woman_ANATOMY_TEST.blend'));r=bpy.data.objects['Roster_Armature'];o=bpy.data.objects['Roster_Body'];r.animation_data.action=bpy.data.actions['idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0);ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh()
for side in ['Left','Right']:
 g=o.vertex_groups[side+'Hand'];points=[ev.matrix_world@m.vertices[v.index].co for v in o.data.vertices if any(x.group==g.index and x.weight>.8 for x in v.groups)];w=r.matrix_world@r.pose.bones[side+'Hand'].head;e=r.matrix_world@r.pose.bones[side+'ForeArm'].head;f=sum(points,Vector())/len(points)-w;print('HAND',side,'center direction',list(f.normalized()),'forearm',list((w-e).normalized()),'bend deg',math.degrees(f.angle(w-e)),flush=True)
