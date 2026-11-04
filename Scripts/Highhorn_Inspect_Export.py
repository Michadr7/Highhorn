import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'Exports/Highhorn_Male_Commoner_RIGGED_TEST.blend'))
for n in ['char1','Tunic','Shoulders','Pants','Boots']:
 o=bpy.data.objects[n];print(n,'verts',len(o.data.vertices),'faces',len(o.data.polygons),'mats',[m.name for m in o.data.materials])
print('FPS',bpy.context.scene.render.fps,bpy.context.scene.render.fps_base)
