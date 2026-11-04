"""Distribute idle wrist roll through the forearm and refit actual sleeve cuffs."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01/Corrections_v2';OUT=BASE.parent/'Corrections_v3';OUT.mkdir(exist_ok=True)

def boundary_ids(mesh):
 welded={};vertex_keys=[]
 for v in mesh.vertices:
  key=tuple(round(x,5) for x in v.co);vertex_keys.append(welded.setdefault(key,len(welded)))
 counts={}
 for face in mesh.polygons:
  ids=[vertex_keys[i] for i in face.vertices]
  for a,b in zip(ids,ids[1:]+ids[:1]):
   edge=tuple(sorted((a,b)));counts[edge]=counts.get(edge,0)+1
 boundary={i for edge,count in counts.items() if count==1 for i in edge}
 return {i for i,key in enumerate(vertex_keys) if key in boundary}

def distribute_roll(rig):
 source=bpy.data.actions['idle'];source.name='Previous_wrist_idle';source.use_fake_user=True;poses=[];report={}
 for frame in range(0,97,4):
  rig.animation_data.action=source;rig.animation_data.action_slot=source.slots[0];bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
  for side in ['Left','Right']:
   fore=rig.pose.bones[side+'ForeArm'];hand=rig.pose.bones[side+'Hand'];saved=hand.matrix.copy();axis=(hand.head-fore.head).normalized()
   rest_fore=fore.bone.matrix_local.to_3x3();rest_hand=hand.bone.matrix_local.to_3x3();wanted=hand.matrix.to_3x3()@rest_hand.inverted()@rest_fore;delta=(wanted@fore.matrix.to_3x3().inverted()).to_quaternion();projection=Vector((delta.x,delta.y,delta.z)).dot(axis);twist=Quaternion((delta.w,axis.x*projection,axis.y*projection,axis.z*projection));twist.normalize()
   if twist.w<0:twist=-twist
   angle=2*math.atan2(Vector((twist.x,twist.y,twist.z)).dot(axis),twist.w);comfortable=max(-math.radians(95),min(math.radians(95),angle));neutralize=Quaternion(axis,comfortable-angle).to_matrix().to_4x4();saved=Matrix.Translation(hand.head)@neutralize@Matrix.Translation(-hand.head)@saved
   applied=comfortable*.88;turn=Quaternion(axis,applied).to_matrix().to_4x4();fore.matrix=Matrix.Translation(fore.head)@turn@Matrix.Translation(-fore.head)@fore.matrix;bpy.context.view_layer.update();hand.matrix=saved;bpy.context.view_layer.update()
   if frame==0:report[side]={'roll_at_wrist_before_degrees':math.degrees(angle),'comfortable_total_roll_degrees':math.degrees(comfortable),'roll_moved_to_forearm_degrees':math.degrees(applied),'residual_degrees':math.degrees(comfortable-applied)}
  poses.append((frame,{b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones}))
 action=bpy.data.actions.new('idle');action.use_fake_user=True;rig.animation_data.action=action
 for frame,pose in poses:
  for b in rig.pose.bones:
   b.rotation_mode='QUATERNION';b.location,b.rotation_quaternion,b.scale=pose[b.name]
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
 for curve in action.fcurves:
  for key in curve.keyframe_points:key.interpolation='LINEAR'
 return report

def fit_cuffs(rig,tunic):
 rig.data.pose_position='REST';bpy.context.view_layer.update();tunic.data=tunic.data.copy();inv=tunic.matrix_world.inverted();counts={}
 body=bpy.data.objects['Roster_Body'];_,skin_weights=tree_and_weights(body)
 skin_boundary=boundary_ids(body.data);cloth_boundary=boundary_ids(tunic.data)
 for side,sign in [('Left',1),('Right',-1)]:
  w=rig.matrix_world@rig.data.bones[side+'Hand'].head_local;e=rig.matrix_world@rig.data.bones[side+'ForeArm'].head_local;axis=(w-e).normalized();changed=0
  group=tunic.vertex_groups.get(side+'ForeArm') or tunic.vertex_groups.new(name=side+'ForeArm')
  skin=[]
  for v in body.data.vertices:
   p=body.matrix_world@v.co;t=(p-w).dot(axis);radial=p-w-axis*t;weight=sum(g.weight for g in v.groups if body.vertex_groups[g.group].name.startswith(side+'Hand'))
   if weight>.65 and (p-w).length<.095 and radial.length<.065:skin.append((t,p))
  assert len(skin)>20
  edge=float(np.quantile([t for t,p in skin],.08));section=[p for t,p in skin if edge-.007<t<edge+.012];center=sum((p-w-axis*(p-w).dot(axis) for p in section),Vector())/len(section);skin_radius=max((p-w-axis*(p-w).dot(axis)-center).length for p in section);skin_radius=max(.022,min(.055,skin_radius));end=edge+.018
  if slug in ['businessman','elderly-man']:skin_radius+=.006
  if slug=='woman':skin_radius+=.008
  rim=[(body.matrix_world@body.data.vertices[i].co-w).dot(axis) for i in skin_boundary if (body.matrix_world@body.data.vertices[i].co-w).length<.085 and -.03<(body.matrix_world@body.data.vertices[i].co-w).dot(axis)<.075]
  if len(rim)>10:end=max(end,min(.075,float(np.quantile(rim,.90))+.006))
  for v in tunic.data.vertices:
   p=tunic.matrix_world@v.co;t=(p-w).dot(axis);radial=p-w-axis*t
   if p.x*sign<0 or not -.17<t<.055 or radial.length>.18:continue
   fade=max(0,min(1,(t+.17)/.14));fade=fade*fade*(3-2*fade)
   # Preserve separation between the original rolled cloth layers. Clamping
   # every radius onto one surface collapses folds and creates intersections.
   radius=radial.length;newrad=radial*((1-.72*fade)+(skin_radius*.95)*fade/max(radius,1e-8));newt=t+max(0,min(1,(t+.14)/.175))*(end-.035)
   fitted=w+axis*newt+newrad+center*fade
   if v.index in cloth_boundary and t>-.09:
    direction=(radial-center).normalized();fitted=w+axis*end+center+direction*(skin_radius+.009)
   v.co=inv@fitted
   old={g.group:g.weight for g in v.groups};blend=max(0,min(1,(t+.17)/.10));native_raw=skin_weights(fitted);native={}
   for name,weight in native_raw.items():
    key=side+'Hand' if name.startswith(side+'Hand') else name;native[key]=native.get(key,0)+weight
   for g in list(v.groups):tunic.vertex_groups[g.group].remove([v.index])
   weights={i:weight*(1-blend) for i,weight in old.items()}
   for name,weight in native.items():
    vg=tunic.vertex_groups.get(name) or tunic.vertex_groups.new(name=name);weights[vg.index]=weights.get(vg.index,0)+weight*blend
   for i,weight in weights.items():
    if weight>1e-7:tunic.vertex_groups[i].add([v.index],weight,'REPLACE')
   changed+=1
  counts[side]={'vertices':changed,'measured_skin_edge_m':edge,'measured_skin_radius_m':skin_radius,'cuff_end_m':end}
 tunic.data.update()
 # Relax the elongated original rolled sleeve folds before the armature acts.
 # This edits the supplied garment mesh, retaining its UVs and materials.
 smooth_group=tunic.vertex_groups.new(name='Cuff fold relaxation')
 for v in tunic.data.vertices:
  p=tunic.matrix_world@v.co
  for side in ['Left','Right']:
   w=rig.matrix_world@rig.data.bones[side+'Hand'].head_local;e=rig.matrix_world@rig.data.bones[side+'ForeArm'].head_local;axis=(w-e).normalized();t=(p-w).dot(axis);r=(p-w-axis*t).length
   if v.index not in cloth_boundary and -.18<t<.075 and r<.14:smooth_group.add([v.index],max(0,min(1,(t+.18)/.08))*max(.15,min(1,-t/.035)),'REPLACE')
 smooth=tunic.modifiers.new('Relax supplied cuff folds','SMOOTH');smooth.factor=.6;smooth.iterations=16;smooth.vertex_group=smooth_group.name
 bpy.context.view_layer.objects.active=tunic;tunic.hide_set(False)
 bpy.ops.object.modifier_apply(modifier=smooth.name)
 rig.data.pose_position='POSE';bpy.context.view_layer.update();return counts

def render_views(dest,rig):
 scene=bpy.context.scene;scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100;rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(0);bpy.context.view_layer.update()
 # Explicit close-ups include the previously untested wrist/cuff opening.
 cam=scene.camera;original=(cam.matrix_world.copy(),cam.data.type,cam.data.ortho_scale)
 wrist=rig.matrix_world@rig.pose.bones['LeftHand'].head;elbow=rig.matrix_world@rig.pose.bones['LeftForeArm'].head;target=wrist.lerp(elbow,.15)
 for label,offset in [('Wrist_Front',Vector((.20,-.48,.03))),('Wrist_Underside',Vector((.08,-.24,-.35))),('Wrist_Back',Vector((.16,.40,.04)))]:
  cam.data.type='ORTHO';cam.data.ortho_scale=.40;cam.location=target+offset;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(dest/(label+'.png'));bpy.ops.render.render(write_still=True)
 cam.matrix_world,cam.data.type,cam.data.ortho_scale=original

roster=json.loads((BASE/'Roster_Test.json').read_text())
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [a['id'] for a in roster if not a.get('reference')]
for slug in ids:
 paths=[(BASE/slug,OUT/slug)]+[(BASE/slug/'Appearance'/v,OUT/slug/'Appearance'/v) for v in ['warm-medium','deep-warm'] if (BASE/slug/'Appearance'/v).exists()]
 for folder,dest in paths:
  dest.mkdir(parents=True,exist_ok=True);source=next(folder.glob('*_CORRECTED_TEST.blend'));bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects.get('Roster_Armature') or next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
  report={'id':slug,'appearance':folder.name if folder.parent.name=='Appearance' else 'original','source_file':str(source.relative_to(ROOT)),'roll':distribute_roll(rig)}
  tunic=bpy.data.objects.get('Tunic')
  if tunic and tunic in meshes:
   report['cuff_vertices_refitted']=fit_cuffs(rig,tunic)
  scene=bpy.context.scene;scene.frame_set(0);scene['Highhorn_Correction_Revision']='v3 wrist and cuff';bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_WRIST_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression')
  if folder==BASE/slug:render_views(dest,rig)
  (dest/'Wrist_Report.json').write_text(json.dumps(report,indent=2));print('WRIST EXPORT SAVED',slug,folder.name,json.dumps(report),flush=True)
