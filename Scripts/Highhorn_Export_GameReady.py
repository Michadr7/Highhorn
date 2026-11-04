"""Create export-only meshes, bake static fit, remove covered base faces, export native skinning."""
import bpy,bmesh,json,struct,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/GameReady';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/Highhorn_Male_Commoner_RIGGED_TEST.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Armature'];body=bpy.data.objects['char1']
names=['Tunic','Shoulders','Pants','Boots'];report={'source':bpy.data.filepath,'meshes':{},'scope':'export copies only; accepted source files unchanged'}
rig.hide_set(False);rig.data.pose_position='REST';scene.frame_set(0)
for name in names:
 o=bpy.data.objects[name];o.data=o.data.copy();bpy.context.view_layer.objects.active=o
 report['meshes'][name]={'source_vertices':len(o.data.vertices),'source_faces':len(o.data.polygons)}
 # Capture the accepted rest fit without a live Blender-only deformation modifier.
 for m in list(o.modifiers):
  if m.type=='SHRINKWRAP':bpy.ops.object.modifier_apply(modifier=m.name)
 # The prior test added two SIMPLE subdivisions for collision evaluation. Reduce
 # those dense cloth surfaces on export copies while retaining UVs and skin groups.
 dec=o.modifiers.new('Export cloth reduction','DECIMATE');dec.ratio=.24
 bpy.ops.object.modifier_apply(modifier=dec.name)
 # Normalize the decimated weights to the portable glTF four-influence limit.
 for v in o.data.vertices:
  weights=sorted([(g.group,g.weight) for g in v.groups if o.vertex_groups[g.group].name in rig.data.bones],key=lambda x:x[1],reverse=True)[:4]
  total=sum(w for i,w in weights)
  if total<=0:raise RuntimeError('Unweighted export garment vertex')
  for g in list(v.groups):o.vertex_groups[g.group].remove([v.index])
  for i,w in weights:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
 world=o.matrix_world.copy();o.parent=rig;o.matrix_world=world
 o['Highhorn_Export_Status']='Native skinning; static fit baked; no live clearance modifier'
 o.data.update()
 report['meshes'][name].update(vertices=len(o.data.vertices),faces=len(o.data.polygons))
# Remove only fully covered base faces from this export copy. Keep original head,
# neck, arms and hands, UVs and deform weights. No source mesh is overwritten.
body.data=body.data.copy()
for m in list(body.modifiers):
 if m.type=='MASK':body.modifiers.remove(m)
mesh=body.data;bm=bmesh.new();bm.from_mesh(mesh)
def covered(v):
 p=body.matrix_world@v.co
 # Lower body is enclosed by trousers/boots; keep arms/hands at the same height.
 if p.z<1.03 and abs(p.x)<.265:return True
 # Torso is enclosed by the tunic, leaving neckline/shoulder boundary intact.
 if 1.00<=p.z<1.365 and abs(p.x)<.205:return True
 return False
remove=[f for f in bm.faces if all(covered(v) for v in f.verts)]
report['base_faces_removed_under_clothes']=len(remove)
bmesh.ops.delete(bm,geom=remove,context='FACES')
loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
bm.to_mesh(mesh);bm.free();mesh.update()
report['meshes']['char1']={'vertices':len(mesh.vertices),'faces':len(mesh.polygons)}
# Smaller copies of oversized garment maps; retain original body texture resolution.
report['texture_resize']=[]
for image in bpy.data.images:
 if image.type=='IMAGE' and max(image.size)>2048 and any(t in image.name for t in ['Tunic','Shoulders','Boots','LP_DefaultMaterial']):
  old=list(image.size);factor=2048/max(old);image.scale(round(old[0]*factor),round(old[1]*factor));report['texture_resize'].append({'image':image.name,'from':old,'to':list(image.size)})
# Native GLB selection explicitly excludes cameras, helper shapes and full-body cage.
for o in scene.objects:o.select_set(False)
for o in [rig,body]+[bpy.data.objects[n] for n in names]:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=rig
rig.data.pose_position='POSE'
for track in rig.animation_data.nla_tracks:track.mute=True
rig.animation_data.action=bpy.data.actions['walk'];rig.animation_data.action_slot=bpy.data.actions['walk'].slots[0]
scene.frame_start=0;scene.frame_end=24;scene.frame_set(0)
scene.name='GLB EXPORT - NATIVE SKINNING'
scene['Highhorn_Export_Report']=json.dumps(report)
# Only export objects visible in this review; helpers remain saved but hidden.
for o in scene.objects:
 if o not in [rig,body]+[bpy.data.objects[n] for n in names]:o.hide_set(True);o.hide_render=True
rig.hide_render=True
scene.camera=bpy.data.objects['Fit review ThreeQuarter']
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Male_Commoner_EXPORT.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'Highhorn_Male_Commoner.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_force_sampling=True,export_skins=True,export_all_influences=False,export_apply=False,export_cameras=False,export_lights=False,export_morph=False,export_extras=False)
# Render the actual native-skinning export scene (helpers excluded).
for act,frames in [('walk',[0,6,12,18]),('run',[0,3,7,11])]:
 a=bpy.data.actions[act];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for f in frames:
  scene.frame_set(f)
  for angle in (['ThreeQuarter','Side','Back'] if f==frames[1] else ['ThreeQuarter']):
   scene.camera=bpy.data.objects['Fit review '+angle]
   scene.render.filepath=str(OUT/f'Native_{act}_{f:02d}_{angle}.png');bpy.ops.render.render(write_still=True)
report['glb_bytes']=(OUT/'Highhorn_Male_Commoner.glb').stat().st_size
(OUT/'Export_Report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
