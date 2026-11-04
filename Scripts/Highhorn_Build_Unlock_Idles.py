"""Add a relaxed review idle to whole unlock characters; retain their appearance and clips."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01';OUT.mkdir(parents=True,exist_ok=True)
LABELS={'viking':('Viking',10),'armored-knight':('Armored Knight',15),'wizard':('Wizard',20),'witch':('Witch',20),'elf':('Elven Ranger',15),'king':('Winter King',30),'queen':('Desert Queen',30)}
for slug,(label,level) in LABELS.items():
 dest=OUT/slug;dest.mkdir(exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'Models/AssetSweepSources/2026-11-01/{slug}/{slug}-rigged.glb'))
 scene=bpy.context.scene;rig=next(o for o in scene.objects if o.type=='ARMATURE');body=next(o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));actions={a.name:a for a in bpy.data.actions};hashes={n:action_hash(a) for n,a in actions.items()}
 geometry=hashlib.sha256(b''.join(struct.pack('fff',*v.co) for v in body.data.vertices)).hexdigest()
 for a in actions.values():a.use_fake_user=True
 for o in bpy.data.objects:
  if o.type=='MESH' and o!=body:o.hide_render=True
 rig.data.pose_position='REST';bpy.context.view_layer.update();points=[body.matrix_world@v.co for v in body.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)*.5;h=hi.z-lo.z
 idle=relaxed_idle(rig,body,spread=.35);scene.frame_start=0;scene.frame_end=96;scene.frame_set(0)
 assert hashes=={n:action_hash(a) for n,a in actions.items()}
 assert geometry==hashlib.sha256(b''.join(struct.pack('fff',*v.co) for v in body.data.vertices)).hexdigest()
 scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='TEXTURE';scene.display.shading.light='STUDIO';scene.display.shading.show_shadows=True;scene.render.resolution_x=560;scene.render.resolution_y=680;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new(slug+' review world');scene.world.color=(.12,.12,.12)
 camera_data=bpy.data.cameras.new(slug+' review camera');camera=bpy.data.objects.new(slug+' review camera',camera_data);scene.collection.objects.link(camera);camera.location=center+Vector((h*.85,-h*2.5,h*.3));camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=55;scene.camera=camera
 scene.name=label+' - relaxed idle';scene['Highhorn_Min_Level']=level;scene['Highhorn_Roster_Status']='Whole unlock character; appearance unchanged, separate idle added'
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_IDLE_TEST.blend')),compress=True)
 export_glb(dest/'raw.glb',rig,[body]);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression')
 for frame in [0,24,48,72]:
  scene.frame_set(frame);scene.render.filepath=str(dest/f'idle_{frame}.png');bpy.ops.render.render(write_still=True)
 report={'id':slug,'label':label,'minimum_level':level,'source_actions_unchanged':hashes,'geometry_sha256_unchanged':geometry,'bones':len(rig.data.bones),'preview_bytes':(dest/'preview.glb').stat().st_size,'scope':'Added idle only; original character geometry/materials/walk/run kept'}
 (dest/'Fit_Report.json').write_text(json.dumps(report,indent=2));print('UNLOCK IDLE SAVED',slug,json.dumps(report),flush=True)
