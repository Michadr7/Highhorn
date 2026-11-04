"""Natural standing test copies; preserve accepted cuff fitting and source clips."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01/Corrections_v3';OUT=BASE.parent/'NaturalIdle_v4';OUT.mkdir(exist_ok=True)

def turn(bone,axis,angle):
 bone.matrix=Matrix.Translation(bone.head)@Quaternion(axis,angle).to_matrix().to_4x4()@Matrix.Translation(-bone.head)@bone.matrix;bpy.context.view_layer.update()

def soften_rigid_fingers(rig,body):
 if 'LeftHandMiddle1' in rig.data.bones:return 0
 cache=json.loads(body.get('Highhorn_Uncurled_Hand_Frames','{}'));body.data=body.data.copy();rig.data.pose_position='REST';bpy.context.view_layer.update();inv=body.matrix_world.inverted()@rig.matrix_world;count=0
 for side in ['Left','Right']:
  if side not in cache:continue
  values=cache[side];wrist,forward,normal,across=[Vector(v) for v in values[:4]];length=values[4];start=length*.53;group=body.vertex_groups.get(side+'Hand')
  for v in body.data.vertices:
   if not any(g.group==group.index and g.weight>.65 for g in v.groups):continue
   p=rig.matrix_world.inverted()@(body.matrix_world@v.co);t=(p-wrist).dot(forward);fade=max(0,min(1,(t-start)/(length*.32)))
   if fade<=0:continue
   pivot=wrist+forward*start;q=p-pivot;q=Quaternion(across,math.radians(-12)*fade)@q
   # Positive bend is checked against the palm normal, independent of handedness.
   if (q-(p-pivot)).dot(normal)<0:q=Quaternion(across,math.radians(12)*fade)@(p-pivot)
   q-=across*q.dot(across)*(.14*fade);v.co=inv@(pivot+q);count+=1
 body.data.update();rig.data.pose_position='POSE';return count

def pose_clearance(rig,body):
 garments=[bpy.data.objects.get(n) for n in ['Tunic','Pants','Shoulders']];garments=[o for o in garments if o and not o.hide_render]
 if not garments:return 0
 ids=set();groups={g.index:g.name for g in body.vertex_groups}
 for v in body.data.vertices:
  hand=sum(g.weight for g in v.groups if groups[g.group].startswith(('LeftHand','RightHand')))
  if hand>.65:ids.add(v.index)
 faces=[tuple(f.vertices) for f in body.data.polygons if all(i in ids for i in f.vertices)];deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps);mesh=ev.to_mesh();tree=BVHTree.FromPolygons([ev.matrix_world@v.co for v in mesh.vertices],faces);ev.to_mesh_clear();hits=0
 for obj in garments:
  ev=obj.evaluated_get(deps);mesh=ev.to_mesh();other=BVHTree.FromPolygons([ev.matrix_world@v.co for v in mesh.vertices],[tuple(f.vertices) for f in mesh.polygons]);hits+=len(tree.overlap(other));ev.to_mesh_clear()
 return hits

def build_idle(rig,body):
 source=bpy.data.actions['idle'];rig.animation_data.action=source;rig.animation_data.action_slot=source.slots[0];bpy.context.scene.frame_set(0);rig.data.pose_position='POSE'
 for track in rig.animation_data.nla_tracks:track.mute=True
 bpy.context.view_layer.update();cache=json.loads(body['Highhorn_Uncurled_Hand_Frames']);feet={s:rig.pose.bones[s+'Foot'].matrix.copy() for s in ['Left','Right']}
 spine=rig.pose.bones.get('Spine01')
 if spine:turn(spine,Vector((0,1,0)),.018)
 head=rig.pose.bones.get('Head')
 if head:turn(head,Vector((0,1,0)),-.010)
 report={}
 for side,sign in [('Left',1),('Right',-1)]:
  aim(rig,side+'Arm',side+'ForeArm',(sign*(.25 if side=='Left' else .29),.005,-1))
  aim(rig,side+'ForeArm',side+'Hand',(sign*(.23 if side=='Left' else .19),-.12 if side=='Left' else -.16,-1))
  hand=rig.pose.bones[side+'Hand'];fore=rig.pose.bones[side+'ForeArm'];upper=rig.pose.bones[side+'Arm'];values=cache[side];forward,normal,across=[Vector(values[i]) for i in [1,2,3]]
  current=hand.matrix.to_3x3()@hand.bone.matrix_local.to_3x3().inverted();forward=current@forward;normal=current@normal;across=current@across
  desired=(hand.head-fore.head).normalized();inward=Vector((-sign,-.08,0));inward-=desired*inward.dot(desired);inward.normalize();right=desired.cross(inward).normalized();inward=right.cross(desired).normalized();basis=Matrix((across,forward,normal)).transposed();target=Matrix((right,desired,inward)).transposed();rotation=(target@basis.transposed()).to_4x4();hand.matrix=Matrix.Translation(hand.head)@rotation@Matrix.Translation(-hand.head)@hand.matrix;bpy.context.view_layer.update()
  # Share pronation across shoulder and forearm rather than undoing the desired
  # palm direction with a wrist-roll clamp. Keep joint positions unchanged.
  saved=hand.matrix.copy();axis=(hand.head-fore.head).normalized();wanted=hand.matrix.to_3x3()@hand.bone.matrix_local.to_3x3().inverted()@fore.bone.matrix_local.to_3x3();delta=(wanted@fore.matrix.to_3x3().inverted()).to_quaternion();proj=Vector((delta.x,delta.y,delta.z)).dot(axis);twist=Quaternion((delta.w,*(axis*proj)));twist.normalize()
  if twist.w<0:twist=-twist
  angle=2*math.atan2(Vector((twist.x,twist.y,twist.z)).dot(axis),twist.w);saved_fore=fore.matrix.copy();turn(upper,(fore.head-upper.head).normalized(),angle*.47);fore.matrix=saved_fore;bpy.context.view_layer.update();hand.matrix=saved;bpy.context.view_layer.update();turn(fore,axis,angle*.94);hand.matrix=saved;bpy.context.view_layer.update()
  report[side]={'shared_roll_degrees':math.degrees(angle),'wrist_residual_degrees':math.degrees(angle*.06),'hand_position':list(rig.matrix_world@hand.head)}
 nudges=0
 while pose_clearance(rig,body)>0 and nudges<5:
  for side,sign in [('Left',1),('Right',-1)]:turn(rig.pose.bones[side+'Arm'],Vector((0,1,0)),-sign*math.radians(1.5))
  nudges+=1
 report['clearance_adjustment_degrees']=nudges*1.5;report['reference_pose_intersections']=pose_clearance(rig,body)
 source.name='Previous_v3_idle';source.use_fake_user=True;base={b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones};action=bpy.data.actions.new('idle');action.use_fake_user=True;rig.animation_data.action=action
 for frame in range(0,97,4):
  phase=2*math.pi*frame/96
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';loc,rot,scale=base[b.name];b.location=loc;b.rotation_quaternion=rot;b.scale=scale
   if b.name=='Spine01':b.rotation_quaternion=rot@Quaternion((1,0,0),math.sin(phase)*.004)@Quaternion((0,1,0),math.sin(phase)*.003)
   if b.name=='Head':b.rotation_quaternion=rot@Quaternion((0,1,0),math.sin(phase+.3)*.003)
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
 for c in action.fcurves:
  for k in c.keyframe_points:k.interpolation='LINEAR'
 bpy.context.scene.frame_set(0);bpy.context.view_layer.update();assert all((rig.pose.bones[s+'Foot'].head-feet[s].translation).length<1e-5 for s in feet)
 return report

def render_reference(dest,rig):
 scene=bpy.context.scene;scene.render.resolution_x=760;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.frame_set(0)
 for angle in ['ThreeQuarter','Side','Back']:
  camera=bpy.data.objects.get('Fit review '+angle)
  if camera:scene.camera=camera
  scene.render.filepath=str(dest/('Idle_'+angle+'.png'));bpy.ops.render.render(write_still=True)

roster=json.loads((BASE/'Roster_Test.json').read_text());ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['businessman']
for slug in ids:
 folders=[(BASE/slug,OUT/slug)]+[(BASE/slug/'Appearance'/v,OUT/slug/'Appearance'/v) for v in ['warm-medium','deep-warm'] if (BASE/slug/'Appearance'/v).exists()]
 for folder,dest in folders:
  dest.mkdir(parents=True,exist_ok=True);source=next(folder.glob('*_WRIST_TEST.blend'));bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects.get('Roster_Armature') or next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)];body=bpy.data.objects.get('Roster_Body') or meshes[0];hashes={n:action_hash(bpy.data.actions[n]) for n in ['walk','run']};report={'id':slug,'rigid_finger_vertices_adjusted':soften_rigid_fingers(rig,body),'pose':build_idle(rig,body)}
  bpy.context.scene.frame_set(0);bpy.context.scene['Highhorn_Idle_Revision']='Natural idle v4';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_NATURAL_IDLE_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression')
  assert hashes=={n:action_hash(bpy.data.actions[n]) for n in hashes};report['walk_run_unchanged']=hashes;(dest/'Idle_Report.json').write_text(json.dumps(report,indent=2))
  if folder==BASE/slug:render_reference(dest,rig)
  print('NATURAL IDLE SAVED',slug,folder.name,json.dumps(report),flush=True)
