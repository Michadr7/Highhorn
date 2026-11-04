"""Import source characters into separate review scenes; measure and sample native clips."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';RENDERS=OUT/'Renders';RENDERS.mkdir(exist_ok=True)
source_dir=ROOT/'Models/AssetSweepSources/2026-11-01'
catalog=json.loads((ROOT/'Exports/AssetResearch/2026-11-01/Grab3D_Selected_Metadata.json').read_text())['models']
bpy.ops.wm.read_factory_settings(use_empty=True)
reports=[]
def bounds(points):return {'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
def camera(scene,name,position,target,lens=55):
 data=bpy.data.cameras.new(name);data.lens=lens;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler();return obj
for m in catalog:
 slug=m['slug']
 if slug in ['man-base-character','woman-base-character']:continue
 f=next(f for f in m['rigged']['files'] if f['format']=='glb');source=source_dir/slug/f['file']
 scene=bpy.data.scenes.new(m['name']['en']+' - source walk');bpy.context.window.scene=scene;scene.render.fps=24
 old_objects=set(bpy.data.objects);old_actions=set(bpy.data.actions)
 bpy.ops.import_scene.gltf(filepath=str(source))
 new_objects=set(bpy.data.objects)-old_objects;new_actions=set(bpy.data.actions)-old_actions
 rig=next(o for o in new_objects if o.type=='ARMATURE');meshes=[o for o in new_objects if o.type=='MESH' and any(mod.type=='ARMATURE' and mod.object==rig for mod in o.modifiers)]
 assert len(meshes)==1,(slug,len(meshes))
 actions={a.name.split('.')[0]:a for a in new_actions}
 for name,a in actions.items():a.name=slug+' :: '+name;a.use_fake_user=True
 for track in rig.animation_data.nla_tracks:track.mute=True
 for o in new_objects:
  if o not in meshes:o.hide_render=True
  if o.type=='MESH' and o not in meshes and o.name in bpy.context.view_layer.objects:o.hide_set(True)
 rig.data.pose_position='REST';bpy.context.view_layer.update();points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices];box=bounds(points)
 size=Vector(box['max'])-Vector(box['min']);center=(Vector(box['max'])+Vector(box['min']))*.5;h=size.z
 assert .5<h<4,(slug,h)
 scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
 scene.display.shading.background_type='WORLD';scene.world=bpy.data.worlds.new(slug+' studio world');scene.world.color=(.12,.12,.12)
 scene.render.resolution_x=560;scene.render.resolution_y=680;scene.render.resolution_percentage=100
 overview=camera(scene,slug+' overview',(center.x+h*.85,center.y-h*2.45,center.z+h*.35),center)
 scene.camera=overview;scene.render.filepath=str(RENDERS/(slug+'_bind.png'));bpy.ops.render.render(write_still=True)
 head=rig.matrix_world@rig.data.bones['Head'].head_local
 portrait=camera(scene,slug+' face',(head.x+.18,head.y-1.5,head.z+.12),(head.x,head.y,head.z+.08),85)
 scene.camera=portrait;scene.render.resolution_x=360;scene.render.resolution_y=420;scene.render.filepath=str(RENDERS/(slug+'_face.png'));bpy.ops.render.render(write_still=True)
 scene.camera=overview;scene.render.resolution_x=560;scene.render.resolution_y=680
 report={'id':slug,'source':str(source.relative_to(ROOT)),'scene':scene.name,'rest_bounds_m':box,'rest_dimensions_m':list(size),'rig_scale':list(rig.scale),'rig_location':list(rig.location),'bones':len(rig.data.bones),'skinned_meshes':[o.name for o in meshes],'animations':{},'render_engine':'Workbench studio/base texture; browser test is the PBR check'}
 rig.data.pose_position='POSE'
 for name in ['walk','run']:
  a=actions[name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];start,end=map(int,a.frame_range);initial=None;motion=0
  for frame in range(start,end+1):
   scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();samples=[]
   for o in meshes:
    evaluated=o.evaluated_get(dg);mesh=evaluated.to_mesh();step=max(1,len(mesh.vertices)//1200);samples.extend(evaluated.matrix_world@mesh.vertices[i].co for i in range(0,len(mesh.vertices),step));evaluated.to_mesh_clear()
   assert all(math.isfinite(x) for p in samples for x in p),(slug,name,frame)
   if initial is None:initial=samples
   motion=max(motion,max((a-b).length for a,b in zip(initial,samples)))
   if frame in {start,start+(end-start)//4,start+(end-start)//2,start+3*(end-start)//4}:
    scene.render.filepath=str(RENDERS/f'{slug}_{name}_{frame:02d}.png');bpy.ops.render.render(write_still=True)
  assert .015<motion<5*h,(slug,name,motion)
  report['animations'][name]={'frames_checked':list(range(start,end+1)),'maximum_sampled_motion_m':motion,'finite_samples_every_frame':True}
 rig.animation_data.action=actions['walk'];rig.animation_data.action_slot=actions['walk'].slots[0];scene.frame_start=0;scene.frame_end=24;scene.frame_set(6)
 scene['Highhorn_Source_Asset']=slug;scene['Highhorn_Status']='Raw asset sweep: not optimized, fitted, or approved for production';scene['Highhorn_Inspection']=json.dumps(report)
 # Opening the file gives a framed camera view rather than the importer helpers.
 for screen in bpy.data.screens:
  for area in screen.areas:
   if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
 reports.append(report);(OUT/'Blender_Inspection.json').write_text(json.dumps(reports,indent=2));print('INSPECTED',slug,json.dumps(report),flush=True)
bpy.context.window.scene=next(s for s in bpy.data.scenes if s.name.startswith('Viking -'))
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Asset_Sweep_TEST.blend'),compress=True)
print('SWEEP BLENDER FILE SAVED',flush=True)
