"""Author an idle action on an export copy; keep original bind matrices and clips."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/HeroPhase2/ClippingFix';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/GameReady/Highhorn_Male_Commoner_EXPORT.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Armature']
def action_hash(a):
 return hashlib.sha256(repr([(c.data_path,c.array_index,[(tuple(k.co),k.interpolation) for k in c.keyframe_points]) for c in a.fcurves]).encode()).hexdigest()
before={n:action_hash(bpy.data.actions[n]) for n in ['walk','run']}
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
scene.frame_set(0);bpy.context.view_layer.update()
def aim(name,child,direction):
 b=rig.pose.bones[name]; c=rig.pose.bones[child]
 turn=(c.head-b.head).normalized().rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
 b.matrix=Matrix.Translation(b.head)@turn@Matrix.Translation(-b.head)@b.matrix
 bpy.context.view_layer.update()
for side,sign in [('Left',1),('Right',-1)]:
 aim(side+'Arm',side+'ForeArm',(sign*.30,.015,-1))
 aim(side+'ForeArm',side+'Hand',(sign*.20,-.10,-1))
# Relaxed shoulders, a slight asymmetry and small upper-body breathing;
# feet and root stay planted throughout this four-second loop.
base={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones}
a=bpy.data.actions.new('idle');rig.animation_data.action=a
for f in range(0,97,4):
 phase=2*math.pi*f/96
 for b in rig.pose.bones:
  b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name]
  if b.name=='Spine01':b.rotation_quaternion=base[b.name]@Quaternion((1,0,0),math.sin(phase)*.007)
  if b.name=='Head':b.rotation_quaternion=base[b.name]@Quaternion((0,1,0),.025+math.sin(phase)*.008)
  b.keyframe_insert('rotation_quaternion',frame=f,group=b.name)
  b.keyframe_insert('location',frame=f,group=b.name)
  b.keyframe_insert('scale',frame=f,group=b.name)
for c in a.fcurves:
 for k in c.keyframe_points:k.interpolation='LINEAR'
scene.frame_start=0;scene.frame_end=96;scene.frame_set(0)
assert before=={n:action_hash(bpy.data.actions[n]) for n in before}
objects=[rig]+[bpy.data.objects[n] for n in ['char1','Tunic','Pants','Boots','Shoulders']]
for o in scene.objects:o.select_set(False)
for o in objects:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=rig
scene.name='COMMONER - RELAXED IDLE REVIEW'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Commoner_IDLE_CLEARANCE_TEST.blend'))
def export(path):
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_force_sampling=True,export_skins=True,export_all_influences=False,export_apply=False,export_cameras=False,export_lights=False,export_morph=False)
export(OUT/'Idle_Source.glb')
scene.render.resolution_percentage=65
for angle in ['ThreeQuarter','Side','Back']:
 scene.camera=bpy.data.objects['Fit review '+angle];scene.render.filepath=str(OUT/('Idle_'+angle+'.png'))
 bpy.ops.render.render(write_still=True)
# Lightweight board copy uses the same UVs, materials, skeleton and animations.
counts={}
for o in objects:
 if o.type!='MESH':continue
 o.data=o.data.copy();bpy.context.view_layer.objects.active=o
 d=o.modifiers.new('Board detail reduction','DECIMATE');d.ratio=.08 if o.name=='char1' else .20
 bpy.ops.object.modifier_apply(modifier=d.name)
 for v in o.data.vertices:
  weights=sorted([(g.group,g.weight) for g in v.groups],key=lambda p:p[1],reverse=True)[:4];total=sum(w for _,w in weights)
  assert total>0
  for g in list(v.groups):o.vertex_groups[g.group].remove([v.index])
  for i,w in weights:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
 counts[o.name]=len(o.data.polygons)
for im in bpy.data.images:
 if im.type=='IMAGE' and max(im.size)>512:
  factor=512/max(im.size);im.scale(round(im.size[0]*factor),round(im.size[1]*factor))
scene.frame_set(0);export(OUT/'Commoner_Board.glb')
(OUT/'Idle_Build_Report.json').write_text(json.dumps({'preserved_actions':before,'board_faces':counts,'idle_seconds':4,'source_unchanged':True},indent=2))
