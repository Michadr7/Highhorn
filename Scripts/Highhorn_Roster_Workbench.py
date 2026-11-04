"""Shared, reversible Blender operations for whole-character medieval roster tests."""
import bpy,bmesh,json,math,struct,hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
def action_hash(a):
 return hashlib.sha256(repr([(c.data_path,c.array_index,[(tuple(k.co),k.interpolation) for k in c.keyframe_points]) for c in a.fcurves]).encode()).hexdigest()
def aim(rig,name,child,direction):
 b=rig.pose.bones[name];c=rig.pose.bones[child];turn=(c.head-b.head).normalized().rotation_difference(Vector(direction).normalized()).to_matrix().to_4x4()
 b.matrix=Matrix.Translation(b.head)@turn@Matrix.Translation(-b.head)@b.matrix;bpy.context.view_layer.update()
def relaxed_idle(rig,body,spread=.40):
 rig.animation_data.action=None
 for t in rig.animation_data.nla_tracks:t.mute=True
 rig.data.pose_position='POSE'
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 for side,sign in [('Left',1),('Right',-1)]:
  aim(rig,side+'Arm',side+'ForeArm',(sign*spread,.015,-1));aim(rig,side+'ForeArm',side+'Hand',(sign*.26,-.10,-1))
  # Infer the current palm plane from actual weighted hand vertices. Both
  # imported 24- and 54-bone rigs need the palms turned inward for a normal idle.
  group=body.vertex_groups.get(side+'Hand');indices=[v.index for v in body.data.vertices if group and any(g.group==group.index and g.weight>.55 for g in v.groups)]
  if len(indices)>20:
   evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();points=np.array([tuple(rig.matrix_world.inverted()@(evaluated.matrix_world@mesh.vertices[i].co)) for i in indices]);evaluated.to_mesh_clear()
   hand=rig.pose.bones[side+'Hand'];fore=rig.pose.bones[side+'ForeArm'];forward=Vector(points.mean(axis=0))-hand.head
   _,vectors=np.linalg.eigh(np.cov(points.T));normal=Vector(vectors[:,0]);normal-=forward.normalized()*normal.dot(forward.normalized());normal.normalize()
   if normal.y>0:normal=-normal
   forward.normalize();across=forward.cross(normal).normalized();normal=across.cross(forward).normalized()
   desired=(hand.head-fore.head).normalized();inward=Vector((-sign,.1,0));inward-=desired*inward.dot(desired);inward.normalize();right=desired.cross(inward).normalized();inward=right.cross(desired).normalized()
   original=Matrix((across,forward,normal)).transposed();target=Matrix((right,desired,inward)).transposed();turn=(target@original.transposed()).to_4x4()
   hand.matrix=Matrix.Translation(hand.head)@turn@Matrix.Translation(-hand.head)@hand.matrix;bpy.context.view_layer.update()
 base={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones};idle=bpy.data.actions.new('idle');idle.use_fake_user=True;rig.animation_data.action=idle
 for frame in range(0,97,4):
  phase=2*math.pi*frame/96
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name]
   if b.name=='Spine01':b.rotation_quaternion=base[b.name]@Quaternion((1,0,0),math.sin(phase)*.006)
   if b.name=='Head':b.rotation_quaternion=base[b.name]@Quaternion((0,1,0),.02+math.sin(phase)*.007)
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
 for curve in idle.fcurves:
  for key in curve.keyframe_points:key.interpolation='LINEAR'
 return idle
def tree_and_weights(body):
 body.data.calc_loop_triangles();points=[body.matrix_world@v.co for v in body.data.vertices];tris=[tuple(t.vertices) for t in body.data.loop_triangles];tree=BVHTree.FromPolygons(points,tris,all_triangles=True)
 weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-6} for v in body.data.vertices]
 def at(p):
  q,n,index,d=tree.find_nearest(p);ids=tris[index];a,b,c=[points[i] for i in ids];e=b-a;f=c-a;v=q-a;ee=e.dot(e);ef=e.dot(f);ff=f.dot(f);den=ee*ff-ef*ef
  if abs(den)<1e-16:mix=[1,0,0]
  else:
   t=(ff*v.dot(e)-ef*v.dot(f))/den;u=(ee*v.dot(f)-ef*v.dot(e))/den;mix=[max(0,1-t-u),max(0,t),max(0,u)]
  result={}
  for i,factor in zip(ids,mix):
   for name,w in weights[i].items():result[name]=result.get(name,0)+factor*w
  return result
 return tree,at
def transfer(o,rig,at):
 o.vertex_groups.clear();groups={b.name:o.vertex_groups.new(name=b.name) for b in rig.data.bones};weights=[at(o.matrix_world@v.co) for v in o.data.vertices];adj=[set() for v in o.data.vertices]
 for e in o.data.edges:
  a,b=e.vertices;adj[a].add(b);adj[b].add(a)
 for _ in range(2):
  updated=[]
  for i,w in enumerate(weights):
   result={k:v*.8 for k,v in w.items()}
   if not adj[i]:result=w
   else:
    for j in adj[i]:
     for k,v in weights[j].items():result[k]=result.get(k,0)+v*.2/len(adj[i])
   updated.append(result)
  weights=updated
 for i,w in enumerate(weights):
  top=sorted(((n,v) for n,v in w.items() if n in groups),key=lambda p:p[1],reverse=True)[:4];total=sum(v for n,v in top);assert total>0
  for n,v in top:groups[n].add([i],v/total,'REPLACE')
 mod=o.modifiers.new('Native character skinning','ARMATURE');mod.object=rig;world=o.matrix_world.copy();o.parent=rig;o.matrix_world=world
def export_glb(path,rig,objects):
 for o in bpy.context.scene.objects:o.select_set(False)
 for o in [rig]+objects:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_force_sampling=True,export_skins=True,export_all_influences=False,export_apply=False,export_cameras=False,export_lights=False,export_morph=False)
def package_glb(source,target,work):
 data=source.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);binary=data[28+n:];doc['animations']=[a for a in doc.get('animations',[]) if a['name'] in ['walk','run','idle']]
 assert {a['name'] for a in doc['animations']}=={'idle','walk','run'}
 # These source characters are texture-based. Temporary bake-mask color layers
 # must not become runtime vertex-color multipliers on the finished skin map.
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   for key in list(primitive['attributes']):
    if key.startswith('COLOR_'):del primitive['attributes'][key]
 views=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in doc['bufferViews']];replace={};work.mkdir(exist_ok=True)
 encoding=bpy.data.scenes.new('Texture JPEG encoding');encoding.render.image_settings.file_format='JPEG';encoding.render.image_settings.color_mode='RGB';encoding.render.image_settings.quality=94;encoding.view_settings.view_transform='Standard';encoding.view_settings.look='None';encoding.view_settings.exposure=0;encoding.view_settings.gamma=1
 for i,im in enumerate(doc.get('images',[])):
  if im['mimeType']!='image/png' or not any(s in im.get('name','') for s in ['Tunic','Boots','Shoulders','LP_DefaultMaterial']):continue
  png=work/(str(i)+'.png');jpg=work/(str(i)+'.jpg');png.write_bytes(views[im['bufferView']]);image=bpy.data.images.load(str(png),check_existing=False);image.save_render(str(jpg),scene=encoding);encoded=jpg.read_bytes();assert encoded[:2]==b'\xff\xd8';replace[im['bufferView']]=encoded;im['mimeType']='image/jpeg'
 result=bytearray()
 for i,v in enumerate(doc['bufferViews']):
  result.extend(b'\0'*((-len(result))%4));chunk=replace.get(i,views[i]);v['byteOffset']=len(result);v['byteLength']=len(chunk);result.extend(chunk)
 result.extend(b'\0'*((-len(result))%4));doc['buffers'][0]['byteLength']=len(result);j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 target.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(result))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(result),0x004e4942)+result)
 bpy.data.scenes.remove(encoding)
