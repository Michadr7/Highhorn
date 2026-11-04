import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'Models/Heroes/FemaleCommoner';DEST.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/FemaleCommoner/Highhorn_Female_Commoner_TEST.blend'))
scene=bpy.context.scene;scene.frame_set(0)
data=bpy.data.cameras.new('Female portrait camera');camera=bpy.data.objects.new('Female portrait camera',data);scene.collection.objects.link(camera)
camera.location=(.38,-1.5,1.48);camera.rotation_euler=(Vector((0,0,1.40))-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=80
scene.camera=camera;scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.render.filepath=str(DEST/'portrait.png');bpy.ops.render.render(write_still=True)
