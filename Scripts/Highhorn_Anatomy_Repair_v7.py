"""Restore native source face surfaces; isolate all edits from earlier reviews."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'Anatomy_v7';OUT.mkdir(exist_ok=True)

def restore_native_head(slug,rig,body):
 source=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'));neck=rig.matrix_world@rig.data.bones['neck'].head_local;rig.data.pose_position='REST';bpy.context.view_layer.update()
 # Keep the accepted curled hands, discard the generated neck and its damaged
 # face boundary. The complete reference is this same character, never a donor.
 body.data=body.data.copy();bm=bmesh.new();bm.from_mesh(body.data);deform=bm.verts.layers.deform.verify();handgroups={g.index for g in body.vertex_groups if g.name.startswith(('LeftHand','RightHand','LeftForeArm','RightForeArm'))}
 remove=[f for f in bm.faces if not any(sum(v[deform].get(i,0) for i in handgroups)>.5 for v in f.verts)];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(body.data);bm.free()
 head=source.copy();head.data=source.data.copy();head.name='Native face and neck';bpy.context.scene.collection.objects.link(head);head.hide_render=False;head.hide_set(False)
 for mod in head.modifiers:
  if mod.type=='ARMATURE':mod.object=rig
 # Retain each accepted skin texture on its original UVs. Source normals/UVs
 # and original face topology are copied without pigment classification.
 head.data.materials.clear();head.data.materials.append(body.data.materials[0]);head.data.materials.append(bpy.data.objects['Tunic'].data.materials[0])
 shader=next(n for n in source.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED');texture=shader.inputs['Base Color'].links[0].from_node.image;pixels=list(texture.pixels);iw,ih=texture.size
 bm=bmesh.new();bm.from_mesh(head.data);world=head.matrix_world;inv=world.inverted();cut=neck.z-.005
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=inv@Vector((neck.x,neck.y,cut)),plane_no=world.to_3x3().transposed()@Vector((0,0,1)),dist=.000001,clear_inner=False,clear_outer=False)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=inv@Vector((neck.x,neck.y,neck.z+.042)),plane_no=world.to_3x3().transposed()@Vector((0,0,1)),dist=.000001,clear_inner=False,clear_outer=False)
 remove=[f for f in bm.faces if (world@f.calc_center_median()).z<cut or abs((world@f.calc_center_median()).x-neck.x)>.26]
 bmesh.ops.delete(bm,geom=remove,context='FACES');uv=bm.loops.layers.uv.active;cloth=0
 for f in bm.faces:
  p=world@f.calc_center_median();f.material_index=0
  q=sum((l[uv].uv for l in f.loops),Vector((0,0)))/len(f.loops);index=(int(q.y%1*(ih-1))*iw+int(q.x%1*(iw-1)))*4;r,g,b=pixels[index:index+3];white=min(r,g,b)>.30 and r<g*1.08 and r<b*1.15
  if p.z<neck.z+.042 or (p.z<neck.z+.12 and white):
   f.material_index=1;cloth+=1
   for l in f.loops:
    q=world@l.vert.co;l[uv].uv=(.45+(q.x-neck.x)*.35,.45+(q.y-neck.y)*.35)
 if slug=='elderly-woman':
  for v in bm.verts:
   p=world@v.co;blend=max(0,min(1,(p.z-neck.z)/.055));v.co=inv@p.lerp(neck+(p-neck)*.86,blend)
 bm.to_mesh(head.data);bm.free();head.data.update()
 # Lift the actual shoulder garment rather than stretching neck skin to bridge
 # a low-fitting hood. The mesh, textures and skin weights remain the originals.
 hood=bpy.data.objects['Shoulders'];hood.data=hood.data.copy()
 for v in hood.data.vertices:
  p=hood.matrix_world@v.co;p.z+=.028;v.co=hood.matrix_world.inverted()@p
 rig.data.pose_position='POSE';bpy.context.view_layer.update()
 return head,{'head_source':source.name,'neck_cut_world_z':cut,'lower_source_collar_faces_with_cloth_material':cloth,'hood_raise_m':.028}

def reverse_elder_palms(rig):
 original=bpy.data.actions['idle'];original.name='Previous_v6_idle';original.use_fake_user=True;poses=[]
 for frame in range(0,97,4):
  rig.animation_data.action=original;rig.animation_data.action_slot=original.slots[0];bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
  for side in ['Left','Right']:
   fore=rig.pose.bones[side+'ForeArm'];hand=rig.pose.bones[side+'Hand'];axis=(hand.head-fore.head).normalized();pivot=fore.head.copy();rotation=Quaternion(axis,math.pi).to_matrix().to_4x4();fore.matrix=Matrix.Translation(pivot)@rotation@Matrix.Translation(-pivot)@fore.matrix;bpy.context.view_layer.update()
  body=bpy.data.objects['Roster_Body'];ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=ev.to_mesh()
  for side in ['Left','Right']:
   group=body.vertex_groups[side+'Hand'];points=[rig.matrix_world.inverted()@(ev.matrix_world@mesh.vertices[v.index].co) for v in body.data.vertices if any(g.group==group.index and g.weight>.8 for g in v.groups)];hand=rig.pose.bones[side+'Hand'];fore=rig.pose.bones[side+'ForeArm'];direction=sum(points,Vector())/len(points)-hand.head;desired=hand.head-fore.head;rotation=direction.rotation_difference(desired).to_matrix().to_4x4();hand.matrix=Matrix.Translation(hand.head)@rotation@Matrix.Translation(-hand.head)@hand.matrix
  ev.to_mesh_clear();bpy.context.view_layer.update()
  poses.append((frame,{b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in rig.pose.bones}))
 action=bpy.data.actions.new('idle');action.use_fake_user=True;rig.animation_data.action=action
 for frame,pose in poses:
  for b in rig.pose.bones:
   b.location,b.rotation_quaternion,b.scale=pose[b.name]
   for prop in ['location','rotation_quaternion','scale']:b.keyframe_insert(prop,frame=frame,group=b.name)
 for c in action.fcurves:
  for k in c.keyframe_points:k.interpolation='LINEAR'

def build(ids):
 for slug in ids:
  for variant in ['original','warm-medium','deep-warm']:
   rel=Path(slug) if variant=='original' else Path(slug)/'Appearance'/variant;folder=BASE/'Garment_v6'/rel;dest=OUT/rel;dest.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(folder/(slug+'_GARMENT_TEST.blend')));rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];hashes={n:action_hash(bpy.data.actions[n]) for n in ['walk','run']};head,report=restore_native_head(slug,rig,body)
   if slug=='elderly-woman':reverse_elder_palms(rig)
   rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);meshes=[body,head]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_ANATOMY_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression');assert hashes=={n:action_hash(bpy.data.actions[n]) for n in hashes};report['walk_run_unchanged']=hashes;(dest/'Repair_Report.json').write_text(json.dumps(report,indent=2));print('ANATOMY SAVED',slug,variant,flush=True)

if __name__=='__main__':
 build(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['businessman'])
