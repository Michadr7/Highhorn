"""Inspect static appearance meshes and skin images; no add-on or character replacement."""
import bpy,json,math,shlex
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';DEST=OUT/'Appearance';DEST.mkdir(exist_ok=True)
inventory=json.loads((OUT/'Appearance_Inventory.json').read_text());bpy.ops.wm.read_factory_settings(use_empty=True);reports=[];skin_reports=[]
sample_ids=['cortu_short_messy_hair','elvs_double_mh_braid','rehmanpolanski_hair_bun_brown','wdg_scruffy_beard','rehmanpolanski_beard_viking']
def parse_material(path):
 fields={}
 for line in path.read_text(encoding='utf-8-sig',errors='replace').splitlines():
  line=line.strip()
  if not line or line.startswith(('#','//')):continue
  parts=line.split(None,1)
  if len(parts)==2:fields[parts[0]]=parts[1].strip()
 return fields
def texture_path(material,value):
 p=material.parent/value
 if p.exists():return p
 # Some original MHMATs store a MakeHuman data-folder prefix.
 return next((f for f in material.parent.rglob('*') if f.name==Path(value).name),None)
for pack in inventory:
 for asset in pack['assets']:
  files=[ROOT/f for f in asset['files']];material_path=next((p for p in files if p.suffix=='.mhmat'),None)
  if not material_path:continue
  fields=parse_material(material_path);diffuse=texture_path(material_path,fields['diffuseTexture']) if fields.get('diffuseTexture') else None
  objpath=next((p for p in files if p.suffix=='.obj'),None)
  if not objpath:
   if diffuse:
    image=bpy.data.images.load(str(diffuse),check_existing=True);image.use_fake_user=True;skin_reports.append({'id':asset['id'],'pack':pack['id'],'diffuse':str(diffuse.relative_to(ROOT)),'size':list(image.size),'channels':image.channels,'source_material':str(material_path.relative_to(ROOT)),'fit_status':'Native MakeHuman UV skin; not matched or baked to Grab3D UVs.'})
   continue
  scene=bpy.data.scenes.new(asset['id']);bpy.context.window.scene=scene
  before=set(bpy.data.objects);bpy.ops.wm.obj_import(filepath=str(objpath),forward_axis='NEGATIVE_Z',up_axis='Y');objects=[o for o in set(bpy.data.objects)-before if o.type=='MESH'];assert objects
  mat=bpy.data.materials.new(asset['id']+' converted preview');mat.use_nodes=True;nodes=mat.node_tree.nodes;shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.7
  color=[float(x) for x in fields.get('diffuseColor','.22 .12 .07').split()[:3]];shader.inputs['Base Color'].default_value=(*color,1)
  if diffuse:
   image=bpy.data.images.load(str(diffuse),check_existing=True);tex=nodes.new('ShaderNodeTexImage');tex.image=image
   multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;multiply.inputs[2].default_value=(*color,1)
   mat.node_tree.links.new(tex.outputs['Color'],multiply.inputs[1]);mat.node_tree.links.new(multiply.outputs[0],shader.inputs['Base Color']);mat.node_tree.links.new(tex.outputs['Alpha'],shader.inputs['Alpha']);nodes.active=tex
   if hasattr(mat,'surface_render_method'):mat.surface_render_method='DITHERED'
  points=[]
  for o in objects:
   o.data.materials.clear();o.data.materials.append(mat);points.extend(o.matrix_world@v.co for v in o.data.vertices)
  assert all(math.isfinite(x) for p in points for x in p)
  lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)*.5;extent=max(hi-lo)
  report={'id':asset['id'],'pack':pack['id'],'source_obj':str(objpath.relative_to(ROOT)),'source_material':str(material_path.relative_to(ROOT)),'vertices':sum(len(o.data.vertices) for o in objects),'polygons':sum(len(o.data.polygons) for o in objects),'uv_layers':[len(o.data.uv_layers) for o in objects],'bounds_imported_units':[list(lo),list(hi)],'dimensions_imported_units':list(hi-lo),'source_units':'OBJ unit scale not established','diffuse_loaded':bool(diffuse),'source_shader':fields.get('shader'),'fit_status':'Static source sample; not fitted/skinned to a Grab3D head.'}
  assert all(report['uv_layers']),asset['id']
  scene['Highhorn_Appearance_Status']=report['fit_status'];scene['Highhorn_Inspection']=json.dumps(report)
  scene.render.engine='BLENDER_EEVEE_NEXT';scene.eevee.taa_render_samples=24;scene.render.resolution_x=420;scene.render.resolution_y=420;scene.render.resolution_percentage=100
  scene.world=bpy.data.worlds.new(asset['id']+' world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.12,.12,1)
  camdata=bpy.data.cameras.new(asset['id']+' camera');cam=bpy.data.objects.new(asset['id']+' camera',camdata);scene.collection.objects.link(cam);cam.location=center+Vector((extent*.4,-extent*2.5,extent*.25));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=55;scene.camera=cam
  lightdata=bpy.data.lights.new(asset['id']+' light','AREA');lightdata.energy=700*extent*extent;lightdata.shape='DISK';lightdata.size=extent*2;light=bpy.data.objects.new(asset['id']+' light',lightdata);scene.collection.objects.link(light);light.location=center+Vector((-extent, -extent*1.5,extent*2));light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
  if asset['id'] in sample_ids:
   scene.render.filepath=str(DEST/(asset['id']+'.png'));bpy.ops.render.render(write_still=True);report['render']=str((DEST/(asset['id']+'.png')).relative_to(ROOT))
  reports.append(report);print('APPEARANCE INSPECTED',asset['id'],report['vertices'],flush=True)
bpy.context.window.scene=bpy.data.scenes[sample_ids[0]]
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Appearance_Sweep_TEST.blend'),compress=True)
(OUT/'Appearance_Inspection.json').write_text(json.dumps({'mesh_assets':reports,'skin_materials':skin_reports,'limitations':['MakeHuman materials require conversion; preview uses diffuse/alpha only.','Source hair/beard meshes are static, have unverified unit scale, and are not fitted to the existing baked hairstyles.','Skin textures require matching UVs or a deliberate rebake; no skin tint applied.']},indent=2))
print('APPEARANCE SWEEP SAVED',len(reports),len(skin_reports),flush=True)
