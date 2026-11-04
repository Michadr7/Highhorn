"""Fit two actual CC0 hair meshes on character copies; retain protected face vertices."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01';inventory=json.loads((ROOT/'Exports/AssetSweep/2026-11-01/Appearance_Inspection.json').read_text())['mesh_assets']
CHOICES={'man':('short-tousled','cortu_short_messy_hair'),'woman':('braided','elvs_double_mh_braid')}
def skin(rgb):
 r,g,b=rgb;return r>.12 and r>g*1.045 and r>b*1.12 and b>r*.28 and g>r*.45
for slug,(variant,asset_id) in CHOICES.items():
 folder=OUT/slug/'Appearance'/variant;folder.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(OUT/slug/(slug+'_MEDIEVAL_TEST.blend')))
 scene=bpy.context.scene;body=bpy.data.objects['Roster_Body'];rig=bpy.data.objects['Roster_Armature'];rig.data.pose_position='REST';bpy.context.view_layer.update();body.data=body.data.copy()
 image=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name.lower());pixels=np.asarray(image.pixels[:]).reshape(image.size[1],image.size[0],4);uv=body.data.uv_layers.active.data
 scores=np.zeros(len(body.data.vertices));counts=np.zeros(len(body.data.vertices))
 for loop in body.data.loops:
  p=uv[loop.index].uv;color=pixels[int(p.y%1*(image.size[1]-1)),int(p.x%1*(image.size[0]-1)),:3];scores[loop.vertex_index]+=int(skin(color));counts[loop.vertex_index]+=1
 scores/=np.maximum(1,counts);head_group=body.vertex_groups['Head'].index;head=rig.matrix_world@rig.data.bones['Head'].head_local
 selected=[v for v in body.data.vertices if any(g.group==head_group and g.weight>.7 for g in v.groups)]
 skin_points=[body.matrix_world@v.co for v in selected if scores[v.index]>.6];assert len(skin_points)>100
 face_skin=[p for p in skin_points if p.y<head.y-.015 and head.z-.06<p.z<head.z+.17];assert len(face_skin)>20
 skin_top=float(np.quantile([p.z for p in face_skin],.98));skin_width=float(np.quantile([abs(p.x-head.x) for p in face_skin],.98));skin_front=min(p.y for p in face_skin)
 protected_ids={v.index for v in body.data.vertices if scores[v.index]>.6 and (body.matrix_world@v.co).z<head.z+.17}
 protected=hashlib.sha256(b''.join(struct.pack('fff',*v.co) for v in body.data.vertices if v.index in protected_ids)).hexdigest();changed=0;inv=body.matrix_world.inverted();neck=(rig.matrix_world@rig.data.bones['neck'].head_local).z
 for v in selected:
  p=body.matrix_world@v.co
  region=p.z>skin_top-.025 or (p.y>head.y+.025 and p.z>neck-.02) or (abs(p.x-head.x)>skin_width*.95 and p.y>head.y-.02 and p.z>neck-.02)
  if v.index not in protected_ids and ((scores[v.index]<.15 and region) or p.z>head.z+.17):
   p.z=min(p.z,skin_top+.015);p.x=head.x+(p.x-head.x)*.77;p.y=head.y+(p.y-head.y)*.77
   if p.z<head.z+.04:p.z=head.z+.04
   v.co=inv@p;changed+=1
 assert protected==hashlib.sha256(b''.join(struct.pack('fff',*v.co) for v in body.data.vertices if v.index in protected_ids)).hexdigest()
 row=next(a for a in inventory if a['id']==asset_id);path=ROOT/row['source_obj'];before=set(bpy.data.objects);bpy.ops.wm.obj_import(filepath=str(path),forward_axis='NEGATIVE_Z',up_axis='Y');hair=next(o for o in set(bpy.data.objects)-before if o.type=='MESH');hair.name='Fitted_CC0_Hair'
 points=[hair.matrix_world@v.co for v in hair.data.vertices];lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);mid=(lo+hi)*.5
 width=skin_width*2*1.06;scale=width/(hi.x-lo.x);top=skin_top+.035
 inv=hair.matrix_world.inverted()
 for v,p in zip(hair.data.vertices,points):
  p=Vector((head.x+(p.x-mid.x)*scale,head.y+(p.y-mid.y)*scale*.78,top+(p.z-hi.z)*scale));v.co=inv@p
 # Convert the source diffuse/alpha material into a supported hair material.
 mhmat=ROOT/row['source_material'];fields={}
 for line in mhmat.read_text(errors='replace').splitlines():
  parts=line.strip().split(None,1)
  if len(parts)==2 and not line.lstrip().startswith(('#','//')):fields[parts[0]]=parts[1]
 diffuse=mhmat.parent/fields['diffuseTexture'];assert diffuse.exists();tex_image=bpy.data.images.load(str(diffuse),check_existing=True)
 mat=bpy.data.materials.new('CC0 fitted hair - dark brown');mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.72
 texture=nodes.new('ShaderNodeTexImage');texture.image=tex_image;mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.09,.035,.015,1);links.new(texture.outputs['Color'],mix.inputs[1]);links.new(mix.outputs[0],shader.inputs['Base Color']);links.new(texture.outputs['Alpha'],shader.inputs['Alpha']);mat.surface_render_method='DITHERED';hair.data.materials.clear();hair.data.materials.append(mat)
 hair.vertex_groups.clear();hair.vertex_groups.new(name='Head').add([v.index for v in hair.data.vertices],1,'REPLACE');arm=hair.modifiers.new('Rigid head skinning','ARMATURE');arm.object=rig;world=hair.matrix_world.copy();hair.parent=rig;hair.matrix_world=world
 rig.data.pose_position='POSE';idle=bpy.data.actions['idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];scene.frame_set(0)
 scene.render.engine='BLENDER_EEVEE_NEXT';scene.eevee.taa_render_samples=24;scene.render.film_transparent=False;rig.hide_render=False
 if not scene.world:scene.world=bpy.data.worlds.new('Hair fitting studio')
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 for name,energy,position in [('Hair fit key',900,(-3,-4,5)),('Hair fit fill',400,(3,-2,3))]:
  data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=4;light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=position;light.rotation_euler=(Vector((0,0,1.4))-light.location).to_track_quat('-Z','Y').to_euler()
 for angle in ['ThreeQuarter','Side','Back']:
  scene.camera=bpy.data.objects['Fit review '+angle];scene.render.filepath=str(folder/('Preview_'+angle+'.png'));bpy.ops.render.render(write_still=True)
 scene.camera=bpy.data.objects['Fit review ThreeQuarter'];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(folder/(slug+'_'+variant+'_HAIR_TEST.blend')),compress=True)
 meshes=[body,hair]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];export_glb(folder/'raw.glb',rig,meshes);package_glb(folder/'raw.glb',folder/'preview.glb',folder/'TextureCompression')
 report={'id':slug,'hair_asset':asset_id,'source_obj':row['source_obj'],'original_hair_vertices_reduced':changed,'protected_skin_geometry_sha256':protected,'skin_geometry_unchanged':True,'hair_head_weight':1,'status':'Fitting prototype; inspect hairline, ears, collar and alpha cards before acceptance.'}
 (folder/'Hair_Fit_Report.json').write_text(json.dumps(report,indent=2));print('HAIR FIT TEST SAVED',slug,json.dumps(report),flush=True)
