"""Save the verified resized geometry with an unambiguous review viewport."""
import bpy,hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'Exports/Highhorn_Male_Commoner_Resized_Test.blend'
output=root/'Exports/Highhorn_Male_Commoner_RESIZED_READY.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
scene.name='RESIZED OUTFIT - STATIC FIT REVIEW'
scene.camera=bpy.data.objects['Fit review ThreeQuarter']
for window in bpy.context.window_manager.windows:
 window.scene=scene
 window.workspace=bpy.data.workspaces['Layout']
for obj in scene.objects:
 obj.select_set(False)
 if obj.type in {'ARMATURE','CAMERA'} or obj.name.startswith('VIEW_ONLY'):
  obj.hide_set(True)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   sp=area.spaces.active
   sp.shading.type='SOLID';sp.shading.light='STUDIO';sp.shading.color_type='TEXTURE'
   sp.overlay.show_overlays=False
   sp.region_3d.view_perspective='CAMERA'
   sp.region_3d.view_camera_zoom=0
scene['Highhorn_Review_File']='RESIZED_READY: resized original FBX garments, not the older Fit or Dimension_Test files'
expected={n:len(bpy.data.objects[n].data.vertices) for n in ['Tunic','Pants','Boots','Shoulders']}
bpy.ops.wm.save_as_mainfile(filepath=str(output))
bpy.ops.wm.open_mainfile(filepath=str(output))
assert bpy.context.scene.name=='RESIZED OUTFIT - STATIC FIT REVIEW'
assert expected=={n:len(bpy.data.objects[n].data.vertices) for n in expected}
scene=bpy.context.scene
scene.render.filepath=str(root/'Exports/Highhorn_RESIZED_READY_Reopened.png')
bpy.ops.render.render(write_still=True)
print('REOPEN VERIFIED',str(output),expected)
