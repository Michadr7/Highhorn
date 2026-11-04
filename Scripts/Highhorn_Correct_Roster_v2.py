"""Reversible second fit pass: measured footwear, intact hair, proportions and hands."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01'
OUT=BASE/'Corrections_v2';OUT.mkdir(exist_ok=True)
STARTERS=['man','businessman','woman','elderly-man','elderly-woman']

def hand_frame(rig,body,side):
 group=body.vertex_groups.get(side+'Hand');ids=[v.index for v in body.data.vertices if group and any(g.group==group.index and g.weight>.65 for g in v.groups)]
 if len(ids)<30:return None
 points=np.array([tuple(rig.matrix_world.inverted()@(body.matrix_world@body.data.vertices[i].co)) for i in ids]);wrist=rig.data.bones[side+'Hand'].head_local.copy();vals,axes=np.linalg.eigh(np.cov(points.T));forward=Vector(axes[:,-1]);mean=Vector(points.mean(axis=0))-wrist
 if forward.dot(mean)<0:forward=-forward
 if side+'HandMiddle3' in rig.data.bones:forward=(rig.data.bones[side+'HandMiddle3'].head_local-wrist).normalized()
 normal=Vector(axes[:,0]);normal-=forward*normal.dot(forward);normal.normalize()
 if normal.y>0:normal=-normal
 across=forward.cross(normal).normalized();normal=across.cross(forward).normalized()
 length=max((Vector(p)-wrist).dot(forward) for p in points)
 return wrist,forward,normal,across,length

def curl_rigid_hands(rig,body):
 changed=0;inv=body.matrix_world.inverted()@rig.matrix_world
 body['Highhorn_Uncurled_Hand_Frames']=json.dumps({s:[list(v) if isinstance(v,Vector) else v for v in hand_frame(rig,body,s)] for s in ['Left','Right'] if hand_frame(rig,body,s)})
 for side in ['Left','Right']:
  if side+'HandMiddle1' in rig.data.bones:continue
  frame=hand_frame(rig,body,side)
  if not frame:continue
  wrist,forward,normal,across,length=frame;start=length*.43;arc=length-start;angle=math.radians(43);radius=arc/angle
  group=body.vertex_groups[side+'Hand']
  for v in body.data.vertices:
   weight=sum(g.weight for g in v.groups if g.group==group.index)
   if weight<.65:continue
   p=rig.matrix_world.inverted()@(body.matrix_world@v.co);q=p-wrist;t=q.dot(forward);s=max(0,t-start)
   if s<=0:continue
   theta=min(angle,s/radius);offset=normal*(radius*(1-math.cos(theta)))+forward*(start+radius*math.sin(theta)-t)
   # Bring the distal spread gently toward the middle-finger line.
   offset-=across*q.dot(across)*min(.23,s/arc*.23)
   v.co=inv@(p+offset);changed+=1
 body.data.update();return changed

def make_idle(rig,body):
 old=bpy.data.actions.get('idle')
 if old:old.name='Previous_idle'
 rig.data.pose_position='REST';bpy.context.view_layer.update();frames={s:hand_frame(rig,body,s) for s in ['Left','Right']}
 if body.get('Highhorn_Uncurled_Hand_Frames'):
  for s,values in json.loads(body['Highhorn_Uncurled_Hand_Frames']).items():frames[s]=tuple(Vector(v) for v in values[:4])+(values[4],)
 rig.animation_data.action=None
 for t in rig.animation_data.nla_tracks:t.mute=True
 rig.data.pose_position='POSE'
 for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update()
 for side,sign in [('Left',1),('Right',-1)]:
  aim(rig,side+'Arm',side+'ForeArm',(sign*.43,.015,-1));aim(rig,side+'ForeArm',side+'Hand',(sign*.38,-.08,-1))
  if not frames[side]:continue
  wrist,forward,normal,across,length=frames[side];hand=rig.pose.bones[side+'Hand'];fore=rig.pose.bones[side+'ForeArm']
  restrotation=rig.data.bones[side+'Hand'].matrix_local.to_3x3();current=hand.matrix.to_3x3()@restrotation.inverted();forward=current@forward;normal=current@normal;across=current@across
  desired=(hand.head-fore.head).normalized();inward=Vector((-sign,-.15,0));inward-=desired*inward.dot(desired);inward.normalize();right=desired.cross(inward).normalized();inward=right.cross(desired).normalized()
  original=Matrix((across,forward,normal)).transposed();target=Matrix((right,desired,inward)).transposed();turn=(target@original.transposed()).to_4x4();hand.matrix=Matrix.Translation(hand.head)@turn@Matrix.Translation(-hand.head)@hand.matrix;bpy.context.view_layer.update()
  for finger in ['Index','Middle','Ring','Pinky','Thumb']:
   for joint,deg in [(1,12 if finger=='Thumb' else 13),(2,15 if finger=='Thumb' else 24),(3,12)]:
    bone=rig.pose.bones.get(side+'Hand'+finger+str(joint))
    if not bone:continue
    direction=(bone.tail-bone.head).normalized();axis=direction.cross(inward).normalized();rotation=Quaternion(axis,math.radians(deg)).to_matrix().to_4x4();bone.matrix=Matrix.Translation(bone.head)@rotation@Matrix.Translation(-bone.head)@bone.matrix;bpy.context.view_layer.update()
 base={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones};idle=bpy.data.actions.new('idle');idle.use_fake_user=True;rig.animation_data.action=idle
 for frame in range(0,97,4):
  phase=2*math.pi*frame/96
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';b.rotation_quaternion=base[b.name]
   if b.name=='Spine01':b.rotation_quaternion=base[b.name]@Quaternion((1,0,0),math.sin(phase)*.006)
   if b.name=='Head':b.rotation_quaternion=base[b.name]@Quaternion((0,1,0),.02+math.sin(phase)*.007)
   for prop in ['rotation_quaternion','location','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
 for c in idle.fcurves:
  for k in c.keyframe_points:k.interpolation='LINEAR'
 return idle

def fit_movement_clearance(rig,degrees=12):
 # Keep the native actions intact. Outfit-adjusted copies open the upper arms
 # slightly so the new tunic/pants do not intersect the original hand swing.
 scene=bpy.context.scene;axis=(rig.matrix_world.inverted().to_3x3()@Vector((0,1,0))).normalized()
 for name in ['walk','run']:
  source=bpy.data.actions[name];source.name='Source_'+name;source.use_fake_user=True;samples=[]
  for frame in range(int(source.frame_range.x),int(source.frame_range.y)+1):
   rig.animation_data.action=source;rig.animation_data.action_slot=source.slots[0];scene.frame_set(frame);bpy.context.view_layer.update()
   for side,sign in [('Left',1),('Right',-1)]:
    b=rig.pose.bones[side+'Arm'];turn=Quaternion(axis,math.radians(-sign*degrees)).to_matrix().to_4x4();b.matrix=Matrix.Translation(b.head)@turn@Matrix.Translation(-b.head)@b.matrix;bpy.context.view_layer.update()
   samples.append((frame,{b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones}))
  action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
  for frame,pose in samples:
   for b in rig.pose.bones:
    b.rotation_mode='QUATERNION';b.location,b.rotation_quaternion,b.scale=pose[b.name]
    for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
  for c in action.fcurves:
   for k in c.keyframe_points:k.interpolation='LINEAR'

def restore_body(slug,rig,body,source):
 if slug!='woman':
  body.data=body.data.copy()
  if slug=='elderly-woman':
   head=rig.matrix_world@rig.data.bones['Head'].head_local
   cloth=bpy.data.objects['Tunic'].data.materials[0].copy();cloth.name='Elder inner cloth collar';slot=len(body.data.materials);body.data.materials.append(cloth)
   for face in body.data.polygons:
    p=sum((body.matrix_world@body.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
    if head.z-.13<p.z<head.z-.04 and abs(p.x-head.x)<.085:face.material_index=slot
  return 0
 body.data=source.data.copy();neck=rig.matrix_world@rig.data.bones['neck'].head_local;head=rig.matrix_world@rig.data.bones['Head'].head_local;groups={g.index:g.name for g in body.vertex_groups};keep=set()
 for v in body.data.vertices:
  p=body.matrix_world@v.co;hand=sum(g.weight for g in v.groups if groups[g.group].startswith(('LeftHand','RightHand')))
  if p.z>neck.z-.035 or hand>.45:keep.add(v.index)
 tex=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name.lower());pixels=list(tex.pixels);iw,ih=tex.size;uv=body.data.uv_layers.active.data
 # Preserve original hair with its own original material when restoring faces
 # absent from the previous skin bake. All presets share the corrected geometry.
 body.data.materials.append(body.data.materials[0]);remove=set()
 for poly in body.data.polygons:
  if not all(i in keep for i in poly.vertices):remove.add(poly.index);continue
  p=sum((body.matrix_world@body.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
  if neck.z-.04<p.z<neck.z+.10:
   # Never classify side/back hair by a skin-color threshold.
   hair_region=abs(p.x-head.x)>.065 or p.y>head.y+.018
   if hair_region:poly.material_index=1;continue
   u=sum(uv[i].uv.x for i in poly.loop_indices)/len(poly.vertices);v=sum(uv[i].uv.y for i in poly.loop_indices)/len(poly.vertices);i=(int(v%1*(ih-1))*iw+int(u%1*(iw-1)))*4;r,g,b=pixels[i:i+3]
   white=min(r,g,b)>.30 and max(r,g,b)-min(r,g,b)<.11
   skin=r>g*1.045 and r>b*1.12 and b>r*.28
   if (white or not skin) and p.z<head.z-.025 and p.y<head.y+.018:remove.add(poly.index)
 bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.index in remove],context='FACES');loose=[v for v in bm.verts if not v.link_faces]
 if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
 bm.to_mesh(body.data);bm.free();body.data.update()
 return len(remove)

def resize_boots(rig,boots):
 original=[boots.matrix_world@v.co for v in boots.data.vertices];result={};inv=boots.matrix_world.inverted()
 for side,sign in [('Left',1),('Right',-1)]:
  foot=rig.matrix_world@rig.data.bones[side+'Foot'].head_local;toe=rig.matrix_world@rig.data.bones[side+'ToeBase'].head_local;ids=[i for i,p in enumerate(original) if p.x*sign>0 and p.z<.14]
  lo=Vector([min(original[i][a] for i in ids) for a in range(3)]);hi=Vector([max(original[i][a] for i in ids) for a in range(3)]);center=(lo+hi)*.5;length=abs(foot.y-toe.y)+.13;width=length*.48
  target=(foot+toe)*.5;target.y-=.012
  for v,p in zip(boots.data.vertices,original):
   if p.x*sign<=0:continue
   influence=max(0,min(1,(.27-p.z)/.13));q=p.copy();q.x=target.x+(p.x-center.x)*width/(hi.x-lo.x);q.y=target.y+(p.y-center.y)*length/(hi.y-lo.y);q.z=p.z+.012
   v.co=inv@p.lerp(q,influence)
  result[side]={'old_length_m':hi.y-lo.y,'new_length_m':length,'new_width_m':width}
 boots.data.update();return result

def elder_proportions(slug,rig,body):
 if slug not in ['elderly-man','elderly-woman']:return 1
 factor=.78 if slug=='elderly-man' else .86;neck=rig.matrix_world@rig.data.bones['neck'].head_local;inv=body.matrix_world.inverted()
 if slug=='elderly-man':
  # Remodel the existing cap mesh: retract the projecting brim and round the
  # crown. Reuse actual garment cloth; no replacement primitive or head swap.
  threshold=(rig.matrix_world@rig.data.bones['Head'].head_local).z+.19
  cloth=bpy.data.objects['Pants'].data.materials[0].copy();cloth.name='Elder cloth cap';slot=len(body.data.materials);body.data.materials.append(cloth)
  for poly in body.data.polygons:
   if all((body.matrix_world@body.data.vertices[i].co).z>threshold-.012 for i in poly.vertices):poly.material_index=slot
  for v in body.data.vertices:
   p=body.matrix_world@v.co
   if p.z<threshold-.012:continue
   t=max(0,min(1,(p.z-threshold+.012)/.04));p.x*=1-.13*t;p.y=neck.y+.015+(p.y-neck.y-.015)*(1-.30*t);p.z+=max(0,p.z-threshold)*.20;v.co=inv@p
 for v in body.data.vertices:
  p=body.matrix_world@v.co
  if p.z<neck.z-.01 or abs(p.x)>.24:continue
  blend=max(0,min(1,(p.z-neck.z)/.055));v.co=inv@p.lerp(neck+(p-neck)*factor,blend)
 body.data.update();return factor

def export_review(slug,dest,rig,body,meshes):
 scene=bpy.context.scene;scene.frame_set(0);rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0]
 scene.frame_set(0);scene['Highhorn_Correction_Revision']='v2';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_CORRECTED_TEST.blend')),compress=True)
 export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression')
 for clip,frames in [('idle',[0]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for frame in frames:
   scene.frame_set(frame)
   for angle in (['ThreeQuarter','Side','Back'] if frame==0 else ['ThreeQuarter']):
    camera=bpy.data.objects.get('Fit review '+angle)
    if camera:scene.camera=camera
    scene.render.filepath=str(dest/f'{clip}_{frame}_{angle}.png');bpy.ops.render.render(write_still=True)

ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else STARTERS
for slug in ids:
 dest=OUT/slug;dest.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(BASE/slug/(slug+'_MEDIEVAL_TEST.blend')))
 rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];source=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'));rig.data.pose_position='REST';bpy.context.view_layer.update();hashes={n:action_hash(bpy.data.actions[n]) for n in ['walk','run']}
 report={'id':slug,'source_actions':hashes,'restored_hair_and_neck':True};report['source_faces_removed']=restore_body(slug,rig,body,source);boots=bpy.data.objects['Boots'];boots.data=boots.data.copy();report['footwear']=resize_boots(rig,boots);report['head_scale']=elder_proportions(slug,rig,body);report['rigid_hand_vertices_curled']=curl_rigid_hands(rig,body);make_idle(rig,body);fit_movement_clearance(rig);report['outfit_adjusted_walk_run_degrees']=12
 meshes=[body]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];export_review(slug,dest,rig,body,meshes)
 assert hashes=={n:action_hash(bpy.data.actions['Source_'+n]) for n in hashes};(dest/'Correction_Report.json').write_text(json.dumps(report,indent=2));print('CORRECTED SAVED',slug,json.dumps(report),flush=True)
