"""Fit real medieval garment copies to the whole female base and transfer its skin weights."""
import bpy,bmesh,json,math,hashlib,struct
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/FemaleCommoner';OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/GameReady/Highhorn_Male_Commoner_EXPORT.blend'))
scene=bpy.context.scene;male=bpy.data.objects['Armature'];male.data.pose_position='REST'
names=['Tunic','Pants','Boots','Shoulders'];garments=[bpy.data.objects[n] for n in names]
male_neck=(male.matrix_world@male.data.bones['neck'].head_local).z
male_arm_span=(male.matrix_world@male.data.bones['LeftArm'].head_local).x-(male.matrix_world@male.data.bones['RightArm'].head_local).x
male_hip_y=(male.matrix_world@male.data.bones['Hips'].head_local).y
# The male objects stay in this test file as hidden reference objects.
for o in scene.objects:o.hide_render=True;o.hide_set(True)
previous=set(bpy.data.objects);old_actions=set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'Models/CommonerSources/woman-base-character-rigged.glb'))
new=set(bpy.data.objects)-previous;rig=next(o for o in new if o.type=='ARMATURE')
body=next(o for o in new if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
rig.name='Female_Armature';body.name='Female_Body';rig.data.pose_position='REST'
female_actions={a.name.split('.')[0]:a for a in set(bpy.data.actions)-old_actions}
for a in old_actions:a.name='MaleReference_'+a.name
for n,a in female_actions.items():a.name=n
for o in new:
 if o not in [rig,body]:o.hide_render=True;o.hide_set(True)
rig.hide_render=True;body.hide_render=False
def action_hash(a):
 return hashlib.sha256(repr([(c.data_path,c.array_index,[(tuple(k.co),k.interpolation) for k in c.keyframe_points]) for c in a.fcurves]).encode()).hexdigest()
original_actions={n:action_hash(a) for n,a in female_actions.items()}
original_body=hashlib.sha256(b''.join(struct.pack('fff',*v.co) for v in body.data.vertices)).hexdigest()
zratio=(rig.matrix_world@rig.data.bones['neck'].head_local).z/male_neck
xratio=((rig.matrix_world@rig.data.bones['LeftArm'].head_local).x-(rig.matrix_world@rig.data.bones['RightArm'].head_local).x)/male_arm_span
dy=(rig.matrix_world@rig.data.bones['Hips'].head_local).y-male_hip_y*zratio
body.data.calc_loop_triangles();points=[body.matrix_world@v.co for v in body.data.vertices];tris=[tuple(t.vertices) for t in body.data.loop_triangles]
tree=BVHTree.FromPolygons(points,tris,all_triangles=True)
weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-6} for v in body.data.vertices]
def weights_at(p):
 q,n,index,d=tree.find_nearest(p);ids=tris[index];a,b,c=[points[i] for i in ids]
 e=b-a;f=c-a;v=q-a;ee=e.dot(e);ef=e.dot(f);ff=f.dot(f);denom=ee*ff-ef*ef
 if abs(denom)<1e-16:mix=[1,0,0]
 else:
  t=(ff*v.dot(e)-ef*v.dot(f))/denom;u=(ee*v.dot(f)-ef*v.dot(e))/denom;mix=[max(0,1-t-u),max(0,t),max(0,u)]
 result={}
 for i,factor in zip(ids,mix):
  for n,w in weights[i].items():result[n]=result.get(n,0)+factor*w
 return result
report={'neck_height_ratio':zratio,'shoulder_span_ratio':xratio,'depth_offset':dy,'source_actions':original_actions,'garments':{}}
for o in garments:
 o.hide_set(False);o.hide_render=False;o.data=o.data.copy();world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
 for m in list(o.modifiers):o.modifiers.remove(m)
 o.vertex_groups.clear();inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  p=o.matrix_world@v.co
  if o.name in ['Tunic','Shoulders']:
   blend=max(0,min(1,(p.z-.85)/.40));width=.97*(1-blend)+xratio*blend
  else:width=.90
  p.x*=width;p.y=p.y*zratio+dy;p.z*=zratio
  q,n,idx,d=tree.find_nearest(p)
  if (p-q).dot(n)<.012:p=q+n*.014
  v.co=inv@p
 # Surface clearance is baked into actual vertices, with no live browser offsets.
 ws=[weights_at(o.matrix_world@v.co) for v in o.data.vertices]
 adjacency=[set() for v in o.data.vertices]
 for edge in o.data.edges:
  a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
 for iteration in range(3):
  updated=[]
  for i,w in enumerate(ws):
   result={k:v*.75 for k,v in w.items()};neighbors=adjacency[i]
   if not neighbors:result=w
   else:
    for j in neighbors:
     for k,v in ws[j].items():result[k]=result.get(k,0)+v*.25/len(neighbors)
   updated.append(result)
  ws=updated
 groups={b.name:o.vertex_groups.new(name=b.name) for b in rig.data.bones}
 for i,w in enumerate(ws):
  top=sorted(((n,v) for n,v in w.items() if n in groups),key=lambda t:t[1],reverse=True)[:4];total=sum(v for _,v in top);assert total>0
  for n,v in top:groups[n].add([i],v/total,'REPLACE')
 mod=o.modifiers.new('Female native skinning','ARMATURE');mod.object=rig
 world=o.matrix_world.copy();o.parent=rig;o.matrix_world=world
 o.data.update();report['garments'][o.name]={'vertices':len(o.data.vertices),'uv_layers':len(o.data.uv_layers)}
# Keep the full original woman in the test file, hidden, before making an export copy.
original=body.copy();original.data=body.data;original.name='SOURCE - complete female base';scene.collection.objects.link(original);original.hide_render=True;original.hide_set(True)
body.data=body.data.copy();bm=bmesh.new();bm.from_mesh(body.data)
def covered(v):
 p=body.matrix_world@v.co
 return (p.z<.97 and abs(p.x)<.245) or (.94<=p.z<1.275 and abs(p.x)<.18)
remove=[f for f in bm.faces if all(covered(v) for v in f.verts)];report['covered_faces_removed_export_copy']=len(remove)
bmesh.ops.delete(bm,geom=remove,context='FACES');loose=[v for v in bm.verts if not v.link_faces]
if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
bm.to_mesh(body.data);bm.free()
assert hashlib.sha256(b''.join(struct.pack('fff',*v.co) for v in original.data.vertices)).hexdigest()==original_body
# An independent idle action; the female source's own walk/run are retained.
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
rig.data.pose_position='POSE'
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
def aim(name,child,direction):
 b=rig.pose.bones[name];c=rig.pose.bones[child];turn=(c.head-b.head).normalized().rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
 b.matrix=Matrix.Translation(b.head)@turn@Matrix.Translation(-b.head)@b.matrix;bpy.context.view_layer.update()
for side,sign in [('Left',1),('Right',-1)]:
 aim(side+'Arm',side+'ForeArm',(sign*.36,.015,-1));aim(side+'ForeArm',side+'Hand',(sign*.27,-.10,-1))
base={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones}
idle=bpy.data.actions.new('idle');rig.animation_data.action=idle
for f in range(0,97,4):
 phase=2*math.pi*f/96
 for b in rig.pose.bones:
  b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name]
  if b.name=='Spine01':b.rotation_quaternion=base[b.name]@Quaternion((1,0,0),math.sin(phase)*.007)
  if b.name=='Head':b.rotation_quaternion=base[b.name]@Quaternion((0,1,0),.025+math.sin(phase)*.008)
  for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=f,group=b.name)
for c in idle.fcurves:
 for k in c.keyframe_points:k.interpolation='LINEAR'
assert original_actions=={n:action_hash(a) for n,a in female_actions.items()}
# Preserve untouched source actions in this test file, and make outfit-specific
# copies with a small outward upper-arm rotation. Her root, legs, timing and
# all other source tracks stay intact; the hands clear the garment side panels.
source_actions=dict(female_actions)
for name,source_action in source_actions.items():
 samples=[];rig.animation_data.action=source_action;rig.animation_data.action_slot=source_action.slots[0]
 for f in range(int(source_action.frame_range[0]),int(source_action.frame_range[1])+1):
  scene.frame_set(f);bpy.context.view_layer.update();row={}
  for side,sign in [('Left',1),('Right',-1)]:
   b=rig.pose.bones[side+'Arm'];turn=Quaternion((0,1,0),-sign*.14).to_matrix().to_4x4()
   b.matrix=Matrix.Translation(b.head)@turn@Matrix.Translation(-b.head)@b.matrix;bpy.context.view_layer.update();row[b.name]=b.rotation_quaternion.copy()
  samples.append((f,row))
 source_action.name='Source_'+name;source_action.use_fake_user=True;fitted=source_action.copy();fitted.name=name;fitted.use_fake_user=True;rig.animation_data.action=fitted;rig.animation_data.action_slot=fitted.slots[0]
 for f,row in samples:
  for bone,q in row.items():
   b=rig.pose.bones[bone];b.rotation_quaternion=q;b.keyframe_insert('rotation_quaternion',frame=f,group=bone)
 for curve in fitted.fcurves:
  if curve.data_path in ['pose.bones["LeftArm"].rotation_quaternion','pose.bones["RightArm"].rotation_quaternion']:
   for k in curve.keyframe_points:k.interpolation='LINEAR'
 female_actions[name]=fitted
assert original_actions=={n:action_hash(a) for n,a in source_actions.items()}
report['outfit_animation_copies']='walk/run upper arms rotated outward 8 degrees; original Source_walk/Source_run retained untouched'
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0]
scene.frame_start=0;scene.frame_end=96;scene.frame_set(0)
for o in scene.objects:o.select_set(False)
for o in [rig,body]+garments:o.select_set(True)
bpy.context.view_layer.objects.active=rig
for o in scene.objects:
 if o.type=='LIGHT':o.hide_render=False;o.hide_set(False)
scene.camera=bpy.data.objects['Fit review ThreeQuarter'];scene.render.resolution_percentage=100
scene.name='FEMALE COMMONER - FIT AND NATIVE SKINNING'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Female_Commoner_TEST.blend'))
def export(path):
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_force_sampling=True,export_skins=True,export_all_influences=False,export_apply=False,export_cameras=False,export_lights=False,export_morph=False)
export(OUT/'Female_Commoner_Full.glb')
for action,frames in [('idle',[0,48]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
 a=idle if action=='idle' else female_actions[action];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for f in frames:
  scene.frame_set(f)
  for angle in (['ThreeQuarter','Side','Back'] if f==0 else ['ThreeQuarter']):
   scene.camera=bpy.data.objects['Fit review '+angle];scene.render.filepath=str(OUT/f'{action}_{f}_{angle}.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];scene.frame_set(0)
for o in [body]+garments:
 o.data=o.data.copy();bpy.context.view_layer.objects.active=o;d=o.modifiers.new('Board detail','DECIMATE');d.ratio=.12 if o==body else .20;bpy.ops.object.modifier_apply(modifier=d.name)
 for v in o.data.vertices:
  ws=sorted([(g.group,g.weight) for g in v.groups],key=lambda t:t[1],reverse=True)[:4];total=sum(w for _,w in ws);assert total>0
  for g in list(v.groups):o.vertex_groups[g.group].remove([v.index])
  for i,w in ws:o.vertex_groups[i].add([v.index],w/total,'REPLACE')
for im in bpy.data.images:
 if im.type=='IMAGE' and max(im.size)>512:
  fac=512/max(im.size);im.scale(round(im.size[0]*fac),round(im.size[1]*fac))
export(OUT/'Female_Commoner_Board.glb')
(OUT/'Build_Report.json').write_text(json.dumps(report,indent=2))
print('FEMALE BUILD COMPLETE',json.dumps(report),flush=True)
