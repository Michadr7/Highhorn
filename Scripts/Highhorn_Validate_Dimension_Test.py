import bpy,runpy
from mathutils import Vector
from pathlib import Path
root=Path(r'C:\Users\Michael\Documents\Projects\Highhorn')
bpy.ops.wm.open_mainfile(filepath=str(root/'Exports/Highhorn_Male_Commoner_Dimension_Test.blend'))
scene=bpy.context.scene
for o in scene.objects:
 if o.type=='ARMATURE': o.hide_render=True
cam_data=bpy.data.cameras.new('Review Camera')
cam=bpy.data.objects.new('Review Camera',cam_data)
scene.collection.objects.link(cam)
cam.location=(2,-5,2.3)
cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO';cam_data.ortho_scale=2.3;scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE'
scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.filepath=str(root/'Exports/Highhorn_Male_Commoner_Dimension_Test_Preview.png')
bpy.ops.render.render(write_still=True)
runpy.run_path(str(root/'Scripts/Highhorn_Inspect_Fit.py'))
assert len(bpy.data.actions)>=2
assert all(o.hide_get() for o in scene.objects if o.name.startswith('Icosphere'))
print('VALIDATED: actions retained, custom shape hidden, preview rendered')
