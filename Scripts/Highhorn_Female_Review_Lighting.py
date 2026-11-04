import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1'
bpy.ops.wm.open_mainfile(filepath=str(out/'Highhorn_Female_Commoner_TOON_TEST.blend'))
scene=bpy.context.scene
# A dedicated review stage; source character collections remain intact.
for name,position,energy,size in [('Key',(-3,-4,5),700,4),('Fill',(4,-1,3),220,4),('Rim',(0,3,4),450,3)]:
 data=bpy.data.lights.new('Female toon review '+name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
 obj=bpy.data.objects.new('Female toon review '+name,data);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('Female toon review world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.045,.058,.043,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7;scene.world=world
scene.render.film_transparent=False;scene.render.resolution_x=900;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Highhorn_Female_Commoner_TOON_TEST.blend'),compress=True)
bpy.ops.render.render(write_still=True)
