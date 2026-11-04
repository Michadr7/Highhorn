"""Create reversible Hero/board LODs, transferring original garment correctives."""
import sys,json,hashlib,struct,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
from Highhorn_Fit_Toon_v4 import surface,pose
from Highhorn_Facet_Normals_v5 import broad_facets

OUT=ROOT/'Exports/CommonerOptimization/2026-11-03';OUT.mkdir(parents=True,exist_ok=True)
SOURCES={
 'male':('Exports/StyleStudy/2026-11-03/Toon_v5/Highhorn_Commoner_TOON_v5_TEST.blend','Exports/StyleStudy/2026-11-03/Toon_v5/commoner-toon.glb','Armature','char1'),
 'female':('Exports/StyleStudy/2026-11-03/Female_v1/Highhorn_Female_Commoner_TOON_TEST.blend','Exports/StyleStudy/2026-11-03/Female_v1/female-commoner-toon.glb','Female_Armature','Female_Body')}

def triangles(mesh):
 return sum(len(p.vertices)-2 for p in mesh.polygons)

def driver_spec(keys):
 result=[]
 for fc in keys.animation_data.drivers if keys and keys.animation_data else []:
  variables=[]
  for v in fc.driver.variables:
   t=v.targets[0]
   variables.append((v.name,v.type,t.id,t.bone_target,t.transform_type,t.transform_space,t.rotation_mode))
  result.append((fc.data_path,fc.driver.expression,variables))
 return result

def simplify(obj,ratio,cloth):
 old=obj.data;old.calc_loop_triangles();basis=old.shape_keys.key_blocks[0].data if old.shape_keys else old.vertices
 if ratio>=1:
  return {'source_triangles':triangles(old),'triangles':triangles(old),'basis_surface_error_max_m':0,'basis_surface_error_p95_m':0,'retained_contact_and_silhouette_mesh':True,'correctives':[k.name for k in list(old.shape_keys.key_blocks)[1:]] if old.shape_keys else [],'normal_report':{'accepted_normals_preserved':True}}
 points=np.array([v.co for v in basis]);tris=[tuple(t.vertices) for t in old.loop_triangles]
 tree=BVHTree.FromPolygons([Vector(p) for p in points],tris,all_triangles=True)
 shapes=[(k.name,np.array([v.co for v in k.data])-points) for k in list(old.shape_keys.key_blocks)[1:]] if old.shape_keys else []
 drivers=driver_spec(old.shape_keys)
 temp=obj.copy();temp.data=old.copy();bpy.context.scene.collection.objects.link(temp)
 temp.modifiers.clear();temp.hide_set(False);temp.hide_viewport=False
 if temp.data.shape_keys:temp.shape_key_clear()
 for v,p in zip(temp.data.vertices,points):v.co=p
 for o in bpy.context.selected_objects:o.select_set(False)
 temp.select_set(True);bpy.context.view_layer.objects.active=temp
 modifier=temp.modifiers.new('Review LOD simplification','DECIMATE');modifier.ratio=ratio;modifier.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 obj.data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
 # Decimate interpolates UVs and binding; retain four normalized influences.
 for v in obj.data.vertices:
  weights=sorted([(g.group,g.weight) for g in v.groups],key=lambda x:-x[1])[:4];total=sum(w for _,w in weights)
  for g in list(v.groups):obj.vertex_groups[g.group].remove([v.index])
  for gi,w in weights:
   if w>0:obj.vertex_groups[gi].add([v.index],w/total,'REPLACE')
 maps=[];distances=[]
 for v in obj.data.vertices:
  q,n,fi,d=tree.find_nearest(v.co);ids=tris[fi];a,b,c=[points[i] for i in ids]
  uv=np.linalg.lstsq(np.column_stack([b-a,c-a]),np.array(q)-a,rcond=None)[0]
  w=np.maximum([1-uv.sum(),uv[0],uv[1]],0);w/=sum(w);maps.append((ids,w))
  distances.append((obj.matrix_world.to_3x3()@(v.co-q)).length)
 if shapes:
  obj.shape_key_add(name='Basis')
  for name,delta in shapes:
   key=obj.shape_key_add(name=name)
   for v,base,(ids,w) in zip(key.data,obj.data.vertices,maps):v.co=base.co+Vector(sum((delta[i]*weight for i,weight in zip(ids,w)),np.zeros(3)))
  for path,expression,variables in drivers:
   name=path.split('["',1)[1].split('"]',1)[0];d=obj.data.shape_keys.key_blocks[name].driver_add('value').driver;d.expression=expression
   for vn,vt,identifier,bone,transform,space,rotation in variables:
    v=d.variables.new();v.name=vn;v.type=vt;t=v.targets[0];t.id=identifier;t.bone_target=bone;t.transform_type=transform;t.transform_space=space;t.rotation_mode=rotation
 if cloth:
  normal_report=broad_facets(obj,.028)
 else:
  for e in obj.data.edges:e.use_edge_sharp=False
  for p in obj.data.polygons:p.use_smooth=True
  obj.data.normals_split_custom_set([(0,0,0)]*len(obj.data.loops));normal_report={'smooth_skin':True}
 return {'source_triangles':triangles(old),'triangles':triangles(obj.data),'basis_surface_error_max_m':max(distances),'basis_surface_error_p95_m':float(np.quantile(distances,.95)),'correctives':[s[0] for s in shapes],'normal_report':normal_report}

def build(gender,level):
 source,glb,rig_name,body=SOURCES[gender];dest=OUT/gender/level;dest.mkdir(parents=True,exist_ok=True)
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/source));rig=bpy.data.objects[rig_name];rig.data.pose_position='REST';bpy.context.view_layer.update()
 actions={a.name:action_hash(a) for a in bpy.data.actions};names=[body,'Tunic','Pants','Boots','Shoulders'];objects=[bpy.data.objects[n] for n in names]
 report={'gender':gender,'level':level,'source':source,'source_glb':glb,'meshes':{},'textures':[]}
 for o in objects:
  ratio=(.55 if gender=='male' else .40) if level=='hero' else (.12 if gender=='male' else .08)
  if o.name!=body:ratio=.60 if level=='hero' else .18
  if o.name in ['Tunic','Shoulders']:ratio=1
  report['meshes'][o.name]=simplify(o,ratio,o.name!=body)
 # Clone material/images locally. Fine normal maps are unused by the accepted toon shader.
 restore=[];images={}
 for o in objects:
  for i,original in enumerate(o.data.materials):
   mat=original.copy();o.data.materials[i]=mat;nodes,links=mat.node_tree.nodes,mat.node_tree.links
   bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
   restore.append((mat,output,[link.from_socket for link in output.inputs['Surface'].links]))
   for link in list(output.inputs['Surface'].links):links.remove(link)
   links.new(bsdf.outputs[0],output.inputs['Surface'])
   for link in list(bsdf.inputs['Normal'].links):links.remove(link)
   base=bsdf.inputs['Base Color'].links[0].from_node;source_image=base.image
   limit=(2048 if o.name==body else 1024) if level=='hero' else (1024 if o.name==body else 512)
   key=(source_image.name,limit)
   if key not in images:
    width,height=source_image.size
    pixels=np.array(source_image.pixels[:],dtype=np.float32)
    assert pixels.size==width*height*4,(source_image.name,'missing source image pixels')
    image=bpy.data.images.new(f'LP_DefaultMaterial_{gender}_{level}_{o.name}_BaseColor',width=width,height=height,alpha=True)
    image.colorspace_settings.name=source_image.colorspace_settings.name
    image.pixels.foreach_set(pixels);image.update()
    if max(width,height)>limit:image.scale(round(width*limit/max(width,height)),round(height*limit/max(width,height)))
    image.pack();images[key]=image;report['textures'].append({'mesh':o.name,'source_size':[width,height],'size':list(image.size)})
   base.image=images[key]
 rig.data.pose_position='POSE'
 for track in rig.animation_data.nla_tracks:track.mute=True
 pose(rig,'idle',0)
 for o in bpy.context.scene.objects:o.select_set(False)
 for o in [rig]+objects:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 raw=dest/'raw.glb';target=dest/'commoner.glb'
 bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_anim_single_armature=True,export_frame_range=False,export_force_sampling=True,export_skins=True,export_all_influences=False,export_apply=False,export_cameras=False,export_lights=False,export_morph=True,export_morph_normal=False,export_morph_animation=True)
 package_glb(raw,target,dest/'TextureCompression')
 data=target.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);tail=data[20+length:]
 for m in doc['materials']:
  if 'Tunic' in m['name']:m['pbrMetallicRoughness']['baseColorFactor']=[.9155893473741998,.7476627054889389,.6413012800369131,1]
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
 target.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail)
 for mat,output,sockets in restore:
  for link in list(output.inputs['Surface'].links):mat.node_tree.links.remove(link)
  for socket in sockets:mat.node_tree.links.new(socket,output.inputs['Surface'])
 assert actions=={a.name:action_hash(a) for a in bpy.data.actions},'Source bone actions changed'
 report['unused_morph_normal_targets_omitted']=True
 report['action_hashes']=actions;report['bytes']=target.stat().st_size;report['source_bytes']=(ROOT/glb).stat().st_size
 report['triangles']=sum(row['triangles'] for row in report['meshes'].values())
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/'Highhorn_Commoner_LOD_TEST.blend'),compress=True)
 (dest/'Build.json').write_text(json.dumps(report,indent=2));print('LOD BUILT',gender,level,report['triangles'],report['bytes'],flush=True)

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 for gender in ([args[0]] if args else SOURCES):
  for level in ([args[1]] if len(args)>1 else ['hero','board']):build(gender,level)
