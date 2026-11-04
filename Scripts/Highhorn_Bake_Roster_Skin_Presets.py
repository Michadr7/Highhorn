"""Bake coordinated skin-tone tests to each character's own UVs, retaining source detail."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01';inventory=json.loads((ROOT/'Exports/AssetSweep/2026-11-01/Appearance_Inspection.json').read_text())['skin_materials']
PALETTES={'warm-medium':'callharvey3d_midtoned_female','deep-warm':'mindfront_skin_male_african_middleage'}
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['man','businessman','woman','elderly-man','elderly-woman']
def skin_mask(rgb):
 r,g,b=rgb
 return r>.12 and r>g*1.045 and r>b*1.12 and b>r*.28 and g>r*.45
def median_skin(image):
 p=np.asarray(image.pixels[:],dtype=np.float32).reshape(-1,4);c=p[:,:3];r,g,b=c.T;keep=(r>.12)&(r>g*1.045)&(r>b*1.12)&(b>r*.28)&(g>r*.45)&(r<.94)
 assert keep.sum()>100
 return np.median(c[keep],axis=0)
for slug in ids:
 dest=OUT/slug;dest.mkdir(exist_ok=True);source=dest/(slug+'_MEDIEVAL_TEST.blend')
 if slug=='approved-male':source=ROOT/'Exports/HeroPhase2/ClippingFix/Highhorn_Commoner_IDLE_CLEARANCE_TEST.blend'
 if slug=='approved-female':source=ROOT/'Exports/FemaleCommoner/Highhorn_Female_Commoner_TEST.blend'
 for variant,donor_id in PALETTES.items():
  bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;rig=bpy.data.objects.get('Roster_Armature') or bpy.data.objects.get('Female_Armature') or bpy.data.objects['Armature'];body=bpy.data.objects.get('Roster_Body') or bpy.data.objects.get('Female_Body') or bpy.data.objects['char1'];base=body.data.materials[0]
  original=next(n.image for n in base.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name.lower());pixels=np.asarray(original.pixels[:],dtype=np.float32).reshape(original.size[1],original.size[0],4);uv=body.data.uv_layers.active.data
  mask=body.data.color_attributes.get('Skin tone bake mask') or body.data.color_attributes.new(name='Skin tone bake mask',type='FLOAT_COLOR',domain='CORNER')
  counts=0
  for poly in body.data.polygons:
   coords=[uv[i].uv for i in poly.loop_indices];u=sum(v.x for v in coords)/len(coords);v=sum(v.y for v in coords)/len(coords);rgb=pixels[int(v%1*(original.size[1]-1)),int(u%1*(original.size[0]-1)),:3];selected=skin_mask(rgb);counts+=selected
   for i in poly.loop_indices:mask.data[i].color=(float(selected),)*3+(1,)
  assert counts>100
  donor_row=next(r for r in inventory if r['id']==donor_id);donor=bpy.data.images.load(str(ROOT/donor_row['diffuse']),check_existing=True);source_median=median_skin(original);target=median_skin(donor)
  # Palettes affect only classified skin faces. Existing brows, beard, hair,
  # clothes, eyes, source normal maps and metallic/roughness maps are retained.
  mat=base.copy();body.data.materials[0]=mat;nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');tex=next(n for n in nodes if n.type=='TEX_IMAGE' and n.image==original)
  curve=nodes.new('ShaderNodeRGBCurve');curve.mapping.initialize()
  for channel in range(3):
   c=curve.mapping.curves[channel];s=float(source_median[channel]);t=float(target[channel]);c.points.new(s,t);c.points.new(s*.40,t*.30)
   for point in c.points:point.handle_type='VECTOR'
  curve.mapping.update();links.new(tex.outputs['Color'],curve.inputs['Color'])
  attr=nodes.new('ShaderNodeVertexColor');attr.layer_name=mask.name;mix=nodes.new('ShaderNodeMixRGB');links.new(attr.outputs['Color'],mix.inputs[0]);links.new(tex.outputs['Color'],mix.inputs[1]);links.new(curve.outputs['Color'],mix.inputs[2])
  emission=nodes.new('ShaderNodeEmission');links.new(mix.outputs[0],emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
  image=bpy.data.images.new(slug+'_'+variant+'_skin',width=min(2048,original.size[0]),height=min(2048,original.size[1]),alpha=False);bake_node=nodes.new('ShaderNodeTexImage');bake_node.image=image;nodes.active=bake_node
  for o in scene.objects:o.select_set(False)
  body.hide_set(False);body.select_set(True);bpy.context.view_layer.objects.active=body
  scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.bake.margin=8
  bpy.ops.object.bake(type='EMIT')
  folder=dest/'Appearance'/variant;folder.mkdir(parents=True,exist_ok=True);image.filepath_raw=str(folder/'Skin_BaseColor.png');image.file_format='PNG';image.save();image.pack()
  links.new(shader.outputs[0],output.inputs['Surface']);links.new(bake_node.outputs['Color'],shader.inputs['Base Color'])
  # The separate file makes the test reviewable and leaves the original palette intact.
  scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='TEXTURE';nodes.active=bake_node
  idle=bpy.data.actions['idle'];rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];scene.frame_set(0);scene.camera=bpy.data.objects['Fit review ThreeQuarter'];scene.render.filepath=str(folder/'Preview.png');bpy.ops.render.render(write_still=True)
  bpy.ops.wm.save_as_mainfile(filepath=str(folder/(slug+'_'+variant+'_TEST.blend')),compress=True)
  meshes=[body]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];export_glb(folder/'raw.glb',rig,meshes);package_glb(folder/'raw.glb',folder/'preview.glb',folder/'TextureCompression')
  report={'id':slug,'preset':variant,'source_body_uv_retained':True,'source_detail_retained':True,'skin_faces_classified':int(counts),'palette_reference':donor_row['diffuse'],'source_skin_median':source_median.tolist(),'target_palette_median':target.tolist(),'scope':'Tone reference with nonlinear per-channel curves baked on the original body UVs; donor skin details are not transferred.','status':'Test palette; visual review required. Hair mesh remains the character original.'}
  (folder/'Preset_Report.json').write_text(json.dumps(report,indent=2));print('SKIN PRESET BAKED',slug,variant,json.dumps(report),flush=True)
