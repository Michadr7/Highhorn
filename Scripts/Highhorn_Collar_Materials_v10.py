"""Localized collar material/UV corrections; no mesh-position or pose edits."""
import sys,json,hashlib,struct
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'Collar_v10';OUT.mkdir(exist_ok=True)

def geometry(o):return hashlib.sha256(b''.join(struct.pack('<3f',*v.co) for v in o.data.vertices)).hexdigest()

def correct(rig,head,source):
 rig.data.pose_position='REST';bpy.context.view_layer.update();head.data=head.data.copy();neck=rig.matrix_world@rig.data.bones['neck'].head_local;source.data.calc_loop_triangles();triangles=list(source.data.loop_triangles);points=[source.matrix_world@v.co for v in source.data.vertices];tree=BVHTree.FromPolygons(points,[tuple(t.vertices) for t in triangles],all_triangles=True);suv=source.data.uv_layers.active.data;uv=head.data.uv_layers.active.data;group=head.vertex_groups['Head'].index;texture=next(n for n in source.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image;pixels=list(texture.pixels);iw,ih=texture.size;accepted=next(n for n in head.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image;accepted_pixels=list(accepted.pixels);aw,ah=accepted.size;head.data.materials.append(source.data.materials[0]);counts={'skin_hair_faces_restored':0,'native_hair_faces_missing_from_bake_restored':0,'blue_green_collar_faces_retextured':0,'white_garment_faces_retextured':0,'cloth_uv_faces':0,'facial_faces_with_cloth_material':0}
 def original_uv(p,tri):
  a,b,c=[points[i] for i in tri.vertices];e=b-a;f=c-a;v=p-a;ee=e.dot(e);ef=e.dot(f);ff=f.dot(f);den=ee*ff-ef*ef
  if abs(den)<1e-18:return suv[tri.loops[0]].uv.copy()
  t=(ff*v.dot(e)-ef*v.dot(f))/den;u=(ee*v.dot(f)-ef*v.dot(e))/den;return suv[tri.loops[0]].uv*(1-t-u)+suv[tri.loops[1]].uv*t+suv[tri.loops[2]].uv*u
 tunic=bpy.data.objects['Tunic'];target=neck+Vector((0,-.13,-.35));fabric_face=min(tunic.data.polygons,key=lambda f:((tunic.matrix_world@f.center)-target).length_squared);fabric_uv=sum((tunic.data.uv_layers.active.data[i].uv for i in fabric_face.loop_indices),Vector((0,0)))/len(fabric_face.loop_indices);counts['fabric_uv_anchor']=list(fabric_uv)
 for face in head.data.polygons:
  p=sum((head.matrix_world@head.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices);h=sum(sum(g.weight for g in head.data.vertices[i].groups if g.group==group) for i in face.vertices)/len(face.vertices);radial=math.hypot(p.x-neck.x,p.y-neck.y);near=p.z<neck.z+.13 and radial<.29;tri=triangles[tree.find_nearest(p)[2]];q=original_uv(p,tri);index=(int(q.y%1*(ih-1))*iw+int(q.x%1*(iw-1)))*4;r,g,b=pixels[index:index+3];native_hair=r>max(.025,g*1.45,b*2.2) and (abs(p.x-neck.x)>.075 or p.y>neck.y+.025);native_guard=h>.60 or native_hair
  # A high Head influence identifies the actual chin, jaw, face and hair. This
  # guard takes precedence over collar height and color, including pale skin.
  restore=face.material_index==1 and (native_guard or p.z>neck.z+.04201 or radial>.145)
  if restore:
   tri=triangles[tree.find_nearest(p)[2]]
   for index in face.loop_indices:uv[index].uv=original_uv(head.matrix_world@head.data.vertices[head.data.loops[index].vertex_index].co,tri)
   face.material_index=0;counts['skin_hair_faces_restored']+=1
  if near and h<.45 and not native_guard:
   samples=[(r,g,b)]
   for index in face.loop_indices:
    q2=original_uv(head.matrix_world@head.data.vertices[head.data.loops[index].vertex_index].co,tri);i=(int(q2.y%1*(ih-1))*iw+int(q2.x%1*(iw-1)))*4;samples.append(pixels[i:i+3])
   blue=any(cb>max(.04,cr*1.25) and cg>cr*1.05 and cr<.25 for cr,cg,cb in samples);green=any(cg>max(.05,cr*1.10,cb*1.10) and cr<.40 for cr,cg,cb in samples);white=any(min(cr,cg,cb)>.30 and cr<cg*1.08 and cr<cb*1.15 for cr,cg,cb in samples) and h<.25 and radial>.045
   if blue or green or white:
    face.material_index=1;counts['white_garment_faces_retextured' if white else 'blue_green_collar_faces_retextured']+=1
  if face.material_index==0 and (native_hair or (r>.03 and b<r*.28)) and accepted!=texture:
   ai=(int(q.y%1*(ah-1))*aw+int(q.x%1*(aw-1)))*4;ar,ag,ab=accepted_pixels[ai:ai+3];lum=.21*r+.72*g+.07*b;alum=.21*ar+.72*ag+.07*ab
   # A restored low curl/jewelry surface can straddle painted and unpainted
   # bake texels. Keep that complete native detail on its original material,
   # rather than mixing source and baked colors triangle by triangle.
   if h<.60 or (lum>.01 and alum<min(.02,lum*.15)):
    face.material_index=2;counts['native_hair_faces_missing_from_bake_restored']+=1
    for index in face.loop_indices:uv[index].uv=original_uv(head.matrix_world@head.data.vertices[head.data.loops[index].vertex_index].co,tri)
  if h>.60:assert face.material_index!=1,('Facial skin is still cloth',face.index)
  if face.material_index==1:
   counts['cloth_uv_faces']+=1
   angles=[math.atan2((head.matrix_world@head.data.vertices[head.data.loops[i].vertex_index].co).y-neck.y,(head.matrix_world@head.data.vertices[head.data.loops[i].vertex_index].co).x-neck.x) for i in face.loop_indices];seam=max(angles)-min(angles)>math.pi
   for index,angle in zip(face.loop_indices,angles):
    q=head.matrix_world@head.data.vertices[head.data.loops[index].vertex_index].co
    if seam and angle<0:angle+=2*math.pi
    uv[index].uv=(fabric_uv.x+angle*.020,fabric_uv.y+(q.z-neck.z)*.4)
 head.data.update();rig.data.pose_position='POSE';bpy.context.view_layer.update();return counts

for slug in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['man','businessman','woman']):
 previous='VillagerNeck_v9' if slug=='man' else 'Anatomy_v7'
 for tone in ['original','warm-medium','deep-warm']:
  rel=Path(slug) if tone=='original' else Path(slug)/'Appearance'/tone;folder=BASE/previous/rel;dest=OUT/rel;dest.mkdir(parents=True,exist_ok=True);source_file=folder/(slug+'_ANATOMY_TEST.blend');bpy.ops.wm.open_mainfile(filepath=str(source_file));rig=bpy.data.objects['Roster_Armature'];head=bpy.data.objects['Native face and neck'];source=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'));before={o.name:geometry(o) for o in bpy.context.scene.objects if o.type=='MESH'};actions={a.name:action_hash(a) for a in bpy.data.actions};report={'id':slug,'tone':tone,'source_blend':str(source_file),'correction':correct(rig,head,source),'actions_unchanged':actions};assert before=={n:geometry(bpy.data.objects[n]) for n in before};report['mesh_positions_unchanged']=before
  rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);meshes=[bpy.data.objects['Roster_Body'],head]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_COLLAR_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression');assert actions=={a.name:action_hash(a) for a in bpy.data.actions};(dest/'Repair_Report.json').write_text(json.dumps(report,indent=2));print('COLLAR SAVED',slug,tone,json.dumps(report['correction']),flush=True)
