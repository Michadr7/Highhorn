"""Repair original neck boundaries beneath medieval collars in isolated copies."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01/NaturalIdle_v4';OUT=BASE.parent/'Neck_v5';OUT.mkdir(exist_ok=True)
OFFSETS={'businessman':.070,'man':.070,'elderly-man':.075,'elderly-woman':.060}

def repair_neck(slug,rig,body):
 rig.data.pose_position='REST';bpy.context.view_layer.update();body.data=body.data.copy();world=body.matrix_world;inv=world.inverted();neck=rig.matrix_world@rig.data.bones['neck'].head_local;cut=neck.z+OFFSETS[slug];bottom=neck.z-.050
 front=neck.z+({'elderly-man':.045,'elderly-woman':.042}.get(slug,.040));tilted=lambda p:p.z-cut-.65*(p.y-neck.y);signed=lambda p:min(tilted(p),p.z-front)
 on_boundary=lambda p:(abs(tilted(p))<.00003 and p.z>=front-.00003) or (abs(p.z-front)<.00003 and tilted(p)>=-.00003)
 protected=[tuple(round(x,6) for x in v.co) for v in body.data.vertices if signed(world@v.co)>.008 or any(body.vertex_groups[g.group].name.startswith(('LeftHand','RightHand')) and g.weight>.65 for g in v.groups)]
 bm=bmesh.new();bm.from_mesh(body.data);uv=bm.loops.layers.uv.active;deform=bm.verts.layers.deform.verify();bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=inv@Vector((neck.x,neck.y,cut)),plane_no=world.to_3x3().transposed()@Vector((0,-.65,1)),clear_inner=False,clear_outer=False)
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=inv@Vector((neck.x,neck.y,front)),plane_no=world.to_3x3().transposed()@Vector((0,0,1)),clear_inner=False,clear_outer=False)

 remove=[]
 for f in bm.faces:
  p=world@f.calc_center_median()
  if p.z>neck.z-.08 and signed(p)<-.000001 and math.hypot(p.x-neck.x,p.y-neck.y)<.175:
   remove.append(f)
 bmesh.ops.delete(bm,geom=remove,context='FACES')
 at_plane=[v for v in bm.verts if on_boundary(world@v.co) and math.hypot((world@v.co).x-neck.x,(world@v.co).y-neck.y)<.20]
 bmesh.ops.remove_doubles(bm,verts=at_plane,dist=.000015)
 edges=[e for e in bm.edges if e.is_boundary and all(on_boundary(world@v.co) for v in e.verts)]
 endpoints=[v for v in {v for e in edges for v in e.verts} if sum(v in e.verts for e in edges)==1];bridges=0
 while endpoints:
  a=endpoints.pop()
  if not endpoints:break
  b=min(endpoints,key=lambda v:(world@v.co-world@a.co).length)
  if (world@b.co-world@a.co).length>.0035:continue
  endpoints.remove(b);edge=bm.edges.get((a,b)) or bm.edges.new((a,b));edges.append(edge);bridges+=1
 remaining=set(edges);loops=[]
 while remaining:
  seed=remaining.pop();component={seed};stack=[seed]
  while stack:
   e=stack.pop()
   for v in e.verts:
    for neighbor in v.link_edges:
     if neighbor in remaining:remaining.remove(neighbor);component.add(neighbor);stack.append(neighbor)
  verts={v for e in component for v in e.verts};degree={v:sum(v in e.verts for e in component) for v in verts}
  if len(verts)<12 or any(n!=2 for n in degree.values()):continue
  points=[world@v.co for v in verts];lo=[min(p[i] for p in points) for i in range(2)];hi=[max(p[i] for p in points) for i in range(2)]
  if lo[0]<neck.x<hi[0] and lo[1]<neck.y<hi[1]:loops.append((component,verts))
 if not loops:
  diagnostics=[{'p':list(world@v.co),'degree':sum(v in e.verts for e in edges)} for v in {v for e in edges for v in e.verts}];(OUT/(slug+'_Boundary.json')).write_text(json.dumps(diagnostics,indent=2))
 assert loops,(slug,'No closed anatomical neck boundary at measured cut',len(edges))
 loop,top=max(loops,key=lambda pair:len(pair[1]));coordinates={v:world@v.co for v in top};old_uv={v:next((l[uv].uv.copy() for l in v.link_loops),Vector((0,0))) for v in top};center=sum(coordinates.values(),Vector())/len(top)
 # Smooth only the repair boundary, not facial features above it. Dense scan
 # vertices otherwise turn tiny nape irregularities into long vertical ridges.
 neighbors={v:[e.other_vert(v) for e in loop if v in e.verts] for v in top}
 for _ in range(12):
  updated={v:coordinates[v]*.55+(coordinates[neighbors[v][0]]+coordinates[neighbors[v][1]])*.225 for v in top}
  coordinates=updated
 for v,p in coordinates.items():v.co=inv@p
 first=min(top,key=lambda v:coordinates[v].y);ordered=[first];previous=None;current=first
 while True:
  choices=[v for v in neighbors[current] if v!=previous];following=choices[0]
  if following==first:break
  ordered.append(following);previous,current=current,following
 assert len(ordered)==len(top)
 area=sum(coordinates[a].x*coordinates[b].y-coordinates[b].x*coordinates[a].y for a,b in zip(ordered,ordered[1:]+ordered[:1]))
 if area<0:ordered=[ordered[0]]+list(reversed(ordered[1:]))
 lengths=[(coordinates[b]-coordinates[a]).length for a,b in zip(ordered,ordered[1:]+ordered[:1])];total=sum(lengths);fractions=np.r_[0,np.cumsum(lengths[:-1])]/total;difference=[math.atan2(coordinates[v].y-neck.y,coordinates[v].x-neck.x)-2*math.pi*s for v,s in zip(ordered,fractions)];phase=math.atan2(sum(math.sin(a) for a in difference),sum(math.cos(a) for a in difference));parameters={v:phase+2*math.pi*s for v,s in zip(ordered,fractions)}
 radius=float(np.quantile([math.hypot(p.x-neck.x,p.y-neck.y) for p in coordinates.values() if p.y<neck.y],.25));radius=max(.040,min(.058,radius))
 material=body.data.materials[0];shader=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');image=shader.inputs['Base Color'].links[0].from_node.image;pixels=list(image.pixels);iw,ih=image.size;candidates=[];cheek_candidates=[];target=Vector((neck.x+.025,neck.y-.030,neck.z+.070));head=rig.matrix_world@rig.data.bones['Head'].head_local;cheek=Vector((neck.x+.045,head.y-.065,head.z+.055))
 for f in bm.faces:
  p=world@f.calc_center_median()
  neck_sample=neck.z+.025<p.z<neck.z+.115 and math.hypot(p.x-neck.x,p.y-neck.y)<.085 and p.y<neck.y
  cheek_sample=head.z+.025<p.z<head.z+.115 and neck.x+.015<p.x<neck.x+.080 and p.y<head.y-.035
  if f.material_index!=0 or not (neck_sample or cheek_sample):continue
  q=sum((l[uv].uv for l in f.loops),Vector((0,0)))/len(f.loops);i=(int(q.y%1*(ih-1))*iw+int(q.x%1*(iw-1)))*4;r,g,b=pixels[i:i+3]
  if r>.20 and g>.15 and b>.10 and r>g*1.10 and r>b*1.25 and b>r*.30:
   if neck_sample:candidates.append(((p-target).length_squared,q,.21*r+.72*g+.07*b,(r,g,b)))
   if cheek_sample:cheek_candidates.append(((p-cheek).length_squared,q,.21*r+.72*g+.07*b,(r,g,b)))
 if cheek_candidates:candidates=cheek_candidates
 assert candidates,(slug,'No original neck skin UV reference');brightness=float(np.quantile([c[2] for c in candidates],.75));chosen=min((c for c in candidates if c[2]>=brightness),key=lambda row:row[0]);skin_uv=chosen[1]
 # Give the reconstructed band its own small skin atlas. Copying UVs vertically
 # would stretch hair/beard texels down the missing nape and produce stripes.
 samples=[]
 for v in top:
  p=coordinates[v];q=old_uv[v];i=(int(q.y%1*(ih-1))*iw+int(q.x%1*(iw-1)))*4;color=np.array(pixels[i:i+3]);r,g,b=color
  valid=r>max(.20,chosen[3][0]*.70) and g>max(.15,chosen[3][1]*.70) and b>.10 and r>g*1.12 and r>b*1.35 and b>r*.32
  samples.append(((math.atan2(p.y-neck.y,p.x-neck.x)+math.pi)/(2*math.pi),color if valid else None))
 valid_colors=[c for u,c in samples if c is not None];assert valid_colors
 skin_mean=np.array(chosen[3])*.95;samples=sorted((u,c if c is not None else skin_mean) for u,c in samples)
 xp=np.array([samples[-1][0]-1]+[u for u,c in samples]+[samples[0][0]+1]);cp=np.array([samples[-1][1]]+[c for u,c in samples]+[samples[0][1]]);x=np.linspace(0,1,256);top_colors=np.stack([np.interp(x,xp,cp[:,channel]) for channel in range(3)],axis=1)
 for _ in range(32):top_colors=(np.roll(top_colors,1,axis=0)+top_colors*2+np.roll(top_colors,-1,axis=0))/4
 t=np.linspace(0,1,128)[:,None,None];rgb=skin_mean[None,None,:]*(1-t)+top_colors[None,:,:]*t;rgba=np.ones((128,256,4),dtype=np.float32);rgba[:,:,:3]=rgb
 atlas=bpy.data.images.new('Neck_Repair_Skin',width=256,height=128,alpha=True,float_buffer=False);atlas.colorspace_settings.name='sRGB';atlas.pixels.foreach_set(rgba.ravel());atlas.file_format='PNG';atlas.pack()
 repair=bpy.data.materials.new('Repaired neck skin');repair.use_nodes=True;nodes=repair.node_tree.nodes;bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED');bsdf.inputs['Roughness'].default_value=.65;tex=nodes.new('ShaderNodeTexImage');tex.image=atlas;repair.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']);nodes.active=tex;skin_slot=len(body.data.materials);body.data.materials.append(repair)
 result=bmesh.ops.extrude_edge_only(bm,edges=list(loop));newverts=[o for o in result['geom'] if isinstance(o,bmesh.types.BMVert)];newfaces=[o for o in result['geom'] if isinstance(o,bmesh.types.BMFace)];mapping={}
 spine=body.vertex_groups.get('Spine02') or body.vertex_groups.get('Spine01');neck_group=body.vertex_groups['neck']
 lower={}
 for v in newverts:
  original=min(top,key=lambda t:(t.co-v.co).length_squared);mapping[v]=original;angle=parameters[original];p=Vector((neck.x+math.cos(angle)*radius*1.08,neck.y+math.sin(angle)*radius*1.08,bottom));lower[original]=p.copy();v.co=inv@p;v[deform].clear();v[deform][neck_group.index]=.30;v[deform][spine.index]=.70
 for f in newfaces:
  f.material_index=skin_slot;f.smooth=True;coords=[]
  for l in f.loops:
   p=world@l.vert.co;coords.append(((math.atan2(p.y-neck.y,p.x-neck.x)+math.pi)/(2*math.pi),0 if l.vert in mapping else 1))
  seam=max(q[0] for q in coords)-min(q[0] for q in coords)>.5
  for l,q in zip(f.loops,coords):l[uv].uv=(q[0]+(1 if seam and q[0]<.5 else 0),q[1])
 bottom_edges=[e for e in bm.edges if e.is_boundary and all(v in mapping for v in e.verts)]
 for e in bm.edges:
  if any(v in mapping for v in e.verts):e.smooth=True
 for f in bmesh.ops.holes_fill(bm,edges=bottom_edges,sides=0)['faces']:
  f.material_index=skin_slot;f.smooth=True
  for l in f.loops:l[uv].uv=(.5,0)
 vertical=[e for e in bm.edges if any(v in top for v in e.verts) and any(v in mapping for v in e.verts)]
 anchors=[(parameters[v],dict(v[deform]),p.z,p.copy(),lower[v].copy()) for v,p in coordinates.items()];bmesh.ops.subdivide_edges(bm,edges=vertical,cuts=2,use_grid_fill=True)
 for v in [v for v in bm.verts if v.link_faces and all(f.material_index==skin_slot for f in v.link_faces) and (world@v.co).z>bottom+.00001]:
  p=world@v.co
  def segment_distance(a):
   direction=a[4]-a[3];t=max(0,min(1,(p-a[3]).dot(direction)/direction.length_squared));return (p-(a[3]+direction*t)).length_squared
  anchor=min(anchors,key=segment_distance);p.x=neck.x+math.cos(anchor[0])*radius;p.y=neck.y+math.sin(anchor[0])*radius;v.co=inv@p
  blend=max(0,min(1,(p.z-bottom)/(anchor[2]-bottom)));weights={i:w*blend for i,w in anchor[1].items()};weights[neck_group.index]=weights.get(neck_group.index,0)+.30*(1-blend);weights[spine.index]=weights.get(spine.index,0)+.70*(1-blend);v[deform].clear()
  for i,w in weights.items():v[deform][i]=w
 for e in bm.edges:
  if any(f.material_index==skin_slot for f in e.link_faces):e.smooth=True
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free();body.data.update()
 # Imported split normals copied from hair/collar faces must not shade the new
 # skin panels. Preserve the original face/hand normals and calculate only the
 # repaired band's corner normals from its actual smooth geometry.
 normals=[tuple(n.vector) for n in body.data.corner_normals]
 for f in body.data.polygons:
  if f.material_index==skin_slot:
   cap=all(abs((world@body.data.vertices[i].co).z-bottom)<.0001 for i in f.vertices)
   for index in f.loop_indices:
    p=world@body.data.vertices[body.data.loops[index].vertex_index].co;n=Vector((0,0,-1)) if cap else Vector((p.x-neck.x,p.y-neck.y,0)).normalized();normals[index]=tuple((world.to_3x3().transposed()@n).normalized())
 body.data.normals_split_custom_set(normals);body.data.update()
 remaining_positions={tuple(round(x,6) for x in v.co) for v in body.data.vertices};assert all(p in remaining_positions for p in protected),(slug,'Protected face/hair/hand vertex moved');rig.data.pose_position='POSE';bpy.context.view_layer.update()
 return {'cut_world_z':cut,'lower_neck_world_z':bottom,'removed_lower_collar_faces':len(remove),'neck_boundary_vertices':len(top),'small_boundary_gaps_bridged':bridges,'new_skin_faces':len(newfaces),'skin_uv_reference':list(skin_uv),'skin_reference_rgb':chosen[3],'method':'Extruded actual closed neck boundary, mapped to existing neck skin texels; native neck/chest weights blended. Face and hair above the repair preserved.'}

def render_neck(dest,rig):
 scene=bpy.context.scene;cam=scene.camera;original=(cam.matrix_world.copy(),cam.data.type,cam.data.ortho_scale);scene.frame_set(0);bpy.context.view_layer.update();neck=rig.matrix_world@rig.pose.bones['neck'].head;head=rig.matrix_world@rig.pose.bones['Head'].head;target=neck.lerp(head,.35);scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 for name,offset in [('Neck_Front',Vector((.06,-.52,.03))),('Neck_Under',Vector((.03,-.39,-.25))),('Neck_Back',Vector((.03,.45,.12))),('Neck_Top',Vector((.20,-.32,.40)))]:
  cam.data.type='ORTHO';cam.data.ortho_scale=.46;cam.location=target+offset;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(dest/(name+'.png'));bpy.ops.render.render(write_still=True)
 cam.matrix_world,cam.data.type,cam.data.ortho_scale=original

ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['businessman']
assert set(ids)<={'businessman','man','elderly-man','elderly-woman'},'Only the four reported necks are approved for this repair; Townswoman prototype is excluded.'
for slug in ids:
 folders=[(BASE/slug,OUT/slug)]+[(BASE/slug/'Appearance'/v,OUT/slug/'Appearance'/v) for v in ['warm-medium','deep-warm']]
 for folder,dest in folders:
  dest.mkdir(parents=True,exist_ok=True);source=next(folder.glob('*_NATURAL_IDLE_TEST.blend'));bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];hashes={n:action_hash(bpy.data.actions[n]) for n in ['idle','walk','run']};report=repair_neck(slug,rig,body);meshes=[body]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']]
  rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0)
  bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_NECK_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression');assert hashes=={n:action_hash(bpy.data.actions[n]) for n in hashes};report['actions_unchanged']=hashes;(dest/'Neck_Report.json').write_text(json.dumps(report,indent=2))
  if folder==BASE/slug:render_neck(dest,rig)
  print('NECK SAVED',slug,folder.name,json.dumps(report),flush=True)
