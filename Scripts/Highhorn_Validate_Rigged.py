import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'Exports/Highhorn_Male_Commoner_RIGGED_TEST.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
scene=bpy.context.scene;rig=bpy.data.objects['Armature']
report=json.loads((ROOT/'Exports/Highhorn_Rigged_Validation.json').read_text())
assert rig.data.pose_position=='POSE'
assert rig.animation_data.action.name=='walk'
for name in ['Tunic','Shoulders','Pants','Boots']:
 o=bpy.data.objects[name]
 assert next(m for m in o.modifiers if m.type=='ARMATURE').object==rig
 assert all(1<=len(v.groups)<=4 and abs(sum(g.weight for g in v.groups)-1)<1e-5 for v in o.data.vertices)
# Verify the skeleton itself drives the garment even without clearance correction.
for o in [bpy.data.objects[n] for n in report['garments']]:
 next(m for m in o.modifiers if m.type=='SHRINKWRAP').show_viewport=False
samples={}
for frame in [0,12]:
 scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
 for name in report['garments']:
  o=bpy.data.objects[name].evaluated_get(dg);mesh=o.to_mesh()
  p=[o.matrix_world@mesh.vertices[i].co for i in range(0,len(mesh.vertices),101)]
  if frame==0:samples[name]=p
  else:
   motion=max((a-b).length for a,b in zip(p,samples[name]));assert motion>.015
   report['garments'][name]['skin_only_motion_verified']=motion
  o.to_mesh_clear()
for n in report['garments']:next(m for m in bpy.data.objects[n].modifiers if m.type=='SHRINKWRAP').show_viewport=True
for action,frame in [('walk',6),('run',3)]:
 a=bpy.data.actions[action];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];scene.frame_set(frame)
 for angle in ['Side','Back']:
  scene.camera=bpy.data.objects['Fit review '+angle]
  scene.render.filepath=str(ROOT/f'Exports/Highhorn_Rigged_{action}_{angle}.png');bpy.ops.render.render(write_still=True)
# A separate run review file lets the user play either clip without editing actions.
scene.camera=bpy.data.objects['Fit review ThreeQuarter']
a=bpy.data.actions['run'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
scene.frame_start=0;scene.frame_end=15;scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Exports/Highhorn_Male_Commoner_RIGGED_RUN.blend'))
bpy.ops.wm.open_mainfile(filepath=str(path))
assert bpy.context.scene.frame_end==24 and bpy.data.objects['Armature'].animation_data.action.name=='walk'
report['saved_file_reopened_verified']=True
(ROOT/'Exports/Highhorn_Rigged_Validation.json').write_text(json.dumps(report,indent=2))
print('REOPEN VERIFIED: default walk, normalized weights, original rig targets; skin-only movement verified')
