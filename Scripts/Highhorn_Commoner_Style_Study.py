"""One reversible, matte Highhorn material study on the accepted male fit."""
import sys,json,hashlib,struct
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/StyleStudy/2026-11-02';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'Exports/MedievalRoster/2026-11-01/CommonerBoots_v8/approved-male/approved-male_BOOTS_TEST.blend'
PALETTE={'Tunic':('#b4aa80',.90,.16),'Shoulders':('#80553b',.88,.12),'Pants':('#62654e',.94,.14),'Boots':('#493d32',.92,.14)}
def digest(o):
 h=hashlib.sha256()
 for v in o.data.vertices:
  h.update(struct.pack('<3f',*v.co));h.update(repr([(o.vertex_groups[g.group].name,g.weight) for g in v.groups]).encode())
 for l in o.data.uv_layers:
  for p in l.data:h.update(struct.pack('<2f',*p.uv))
 return h.hexdigest()
def linear(hexcolor):
 c=[int(hexcolor[i:i+2],16)/255 for i in [1,3,5]];return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
def unlink(socket,links):
 for link in list(socket.links):links.remove(link)

bpy.ops.wm.open_mainfile(filepath=str(SOURCE));rig=bpy.data.objects['Armature'];objects=[bpy.data.objects[n] for n in ['char1','Tunic','Pants','Boots','Shoulders']];before={o.name:digest(o) for o in objects};actions={a.name:action_hash(a) for a in bpy.data.actions};bones=repr([(b.name,[list(row) for row in b.matrix_local]) for b in rig.data.bones]);rig.data.pose_position='REST';bpy.context.view_layer.update();scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1;scene.render.bake.margin=12;texdir=OUT/'Textures';texdir.mkdir(exist_ok=True);report={'source':str(SOURCE),'palette':{},'body_texture_preserved':True}
tunic=bpy.data.objects['Tunic'];layer_tree=BVHTree.FromPolygons([tunic.matrix_world@v.co for v in tunic.data.vertices],[tuple(f.vertices) for f in tunic.data.polygons])
for obj in objects:
 obj.data=obj.data.copy()
 if obj.name=='Shoulders':
  offsets=[]
  for v in obj.data.vertices:
   p=obj.matrix_world@v.co;q,n,index,d=layer_tree.find_nearest(p)
   if d<.008:
    amount=max(0,min(.012,.003-(p-q).dot(n)))
    if amount>0:v.co=obj.matrix_world.inverted()@(p+n*amount);offsets.append(amount)
  report['shoulder_layer_clearance']={'vertices':len(offsets),'max_offset_m':max(offsets,default=0),'purpose':'Separate the existing leather layer from almost coplanar tunic surfaces; no topology changes.'}
 for i,mat in enumerate(obj.data.materials):obj.data.materials[i]=mat.copy()
 if obj.name=='char1':
  for mat in obj.data.materials:
   bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');unlink(bsdf.inputs['Roughness'],mat.node_tree.links);bsdf.inputs['Roughness'].default_value=.82;unlink(bsdf.inputs['Metallic'],mat.node_tree.links);bsdf.inputs['Metallic'].default_value=0
   for node in mat.node_tree.nodes:
    if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.22
  continue
 color,roughness,normal=PALETTE[obj.name];mat=obj.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');source_node=shader.inputs['Base Color'].links[0].from_node;assert source_node.type=='TEX_IMAGE';image=source_node.image;pixels=np.asarray(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4);uv=obj.data.uv_layers.active.data;samples=[]
 for f in obj.data.polygons:
  q=sum((uv[i].uv for i in f.loop_indices),Vector((0,0)))/len(f.vertices);rgb=pixels[int(q.y%1*(image.size[1]-1)),int(q.x%1*(image.size[0]-1)),:3];samples.append((float(rgb@np.array([.2126,.7152,.0722])),f.area))
 mean=sum(c*w for c,w in samples)/sum(w for c,w in samples);mean=max(.02,mean)
 lum=nodes.new('ShaderNodeRGBToBW');links.new(source_node.outputs['Color'],lum.inputs[0]);multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY';multiply.inputs[1].default_value=.14/mean;links.new(lum.outputs[0],multiply.inputs[0]);add=nodes.new('ShaderNodeMath');add.operation='ADD';add.inputs[1].default_value=.86;links.new(multiply.outputs[0],add.inputs[0]);mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[1].default_value=linear(color);links.new(add.outputs[0],mix.inputs[2]);emission=nodes.new('ShaderNodeEmission');links.new(mix.outputs[0],emission.inputs['Color']);unlink(output.inputs['Surface'],links);links.new(emission.outputs[0],output.inputs['Surface'])
 target=bpy.data.images.new('Highhorn '+obj.name+' painted base',width=1024,height=1024,alpha=False);target.colorspace_settings.name='sRGB';bake=nodes.new('ShaderNodeTexImage');bake.image=target;nodes.active=bake
 for o in scene.objects:o.select_set(False)
 obj.hide_set(False);obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.bake(type='EMIT');target.filepath_raw=str(texdir/(obj.name+'_BaseColor.png'));target.file_format='PNG';target.save();target.pack();unlink(output.inputs['Surface'],links);links.new(shader.outputs[0],output.inputs['Surface']);unlink(shader.inputs['Base Color'],links);links.new(bake.outputs['Color'],shader.inputs['Base Color']);unlink(shader.inputs['Roughness'],links);shader.inputs['Roughness'].default_value=roughness;unlink(shader.inputs['Metallic'],links);shader.inputs['Metallic'].default_value=0
 for node in nodes:
  if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=normal
 report['palette'][obj.name]={'base_srgb':color,'roughness':roughness,'normal_strength':normal,'retained_texture_contrast':.14,'source_mean_luminance':mean,'baked_size':[1024,1024]};print('STYLE BAKED',obj.name,flush=True)
assert all(before[o.name]==digest(o) for o in objects if o.name!='Shoulders');assert actions=={a.name:action_hash(a) for a in bpy.data.actions};assert bones==repr([(b.name,[list(row) for row in b.matrix_local]) for b in rig.data.bones]);report['source_mesh_hashes']=before;report['styled_mesh_hashes']={o.name:digest(o) for o in objects};report['preserved_action_hashes']=actions;rig.data.pose_position='POSE';rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(0);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Commoner_STYLE_TEST.blend'),compress=True);export_glb(OUT/'style-raw.glb',rig,objects);package_glb(OUT/'style-raw.glb',OUT/'commoner-style.glb',OUT/'TextureCompression');(OUT/'Build_Report.json').write_text(json.dumps(report,indent=2));print('STYLE STUDY SAVED',flush=True)
