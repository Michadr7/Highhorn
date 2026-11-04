"""Transfer original body skin weights by closest-triangle barycentric interpolation.
Only writes a separate Blender rigging test and review artifacts under Exports.
"""
import bpy, json, math, hashlib, struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/Highhorn_Male_Commoner_RESIZED_READY.blend'))
scene=bpy.context.scene;body=bpy.data.objects['char1'];rig=bpy.data.objects['Armature']
names=['Tunic','Shoulders','Pants','Boots']
def digest():
 h=hashlib.sha256()
 for v in body.data.vertices:
  h.update(struct.pack('fff',*v.co))
  for g in v.groups:
   if body.vertex_groups[g.group].name in rig.data.bones: h.update(struct.pack('if',g.group,g.weight))
 for b in rig.data.bones:
  h.update(b.name.encode());h.update(str(tuple(tuple(row) for row in b.matrix_local)).encode())
 for a in bpy.data.actions:
  h.update(a.name.encode())
  for layer in a.layers:
   for strip in layer.strips:
    for slot in a.slots:
     bag=strip.channelbag(slot)
     if bag:
      for f in bag.fcurves:
       h.update(f.data_path.encode());h.update(str(f.array_index).encode())
       for p in f.keyframe_points:h.update(struct.pack('ff',*p.co))
 return h.hexdigest()
before=digest()
rig.data.pose_position='REST';bpy.context.view_layer.update()
body.data.calc_loop_triangles()
points=[body.matrix_world@v.co for v in body.data.vertices]
triangles=[tuple(t.vertices) for t in body.data.loop_triangles]
bvh=BVHTree.FromPolygons(points,triangles,all_triangles=True)
body_weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups if g.weight>1e-6} for v in body.data.vertices]
def weights_at(p):
 q,n,idx,d=bvh.find_nearest(p)
 ids=triangles[idx];a,b,c=[points[i] for i in ids]
 e=b-a;f=c-a;v=q-a;ee=e.dot(e);ef=e.dot(f);ff=f.dot(f)
 denom=ee*ff-ef*ef
 if abs(denom)<1e-16:mix=[1,0,0]
 else:
  t=(ff*v.dot(e)-ef*v.dot(f))/denom;u=(ee*v.dot(f)-ef*v.dot(e))/denom
  mix=[max(0,1-t-u),max(0,t),max(0,u)]
 result={}
 for i,t in zip(ids,mix):
  for name,w in body_weights[i].items():result[name]=result.get(name,0)+t*w
 return result
report={'source':bpy.data.filepath,'method':'closest body triangle, barycentric source weights, 3 neighbor smoothing passes, maximum 4 normalized influences','base_digest_before':before,'garments':{}}
for name in names:
 o=bpy.data.objects[name];o.data=o.data.copy()
 ws=[weights_at(o.matrix_world@v.co) for v in o.data.vertices]
 adjacency=[set() for v in o.data.vertices]
 for edge in o.data.edges:
  a,b=edge.vertices;adjacency[a].add(b);adjacency[b].add(a)
 for iteration in range(3):
  updated=[]
  for i,w in enumerate(ws):
   result={k:v*.7 for k,v in w.items()};neighbors=adjacency[i]
   if neighbors:
    for j in neighbors:
     for k,v in ws[j].items():result[k]=result.get(k,0)+v*.3/len(neighbors)
   else:result=w
   updated.append(result)
  ws=updated
 groups={b.name:o.vertex_groups.new(name=b.name) for b in rig.data.bones if b.use_deform}
 unweighted=0;error=0
 for i,w in enumerate(ws):
  top=sorted(((k,v) for k,v in w.items() if k in groups and v>1e-5),key=lambda x:x[1],reverse=True)[:4]
  total=sum(v for k,v in top)
  if total<=0:unweighted+=1;continue
  for k,v in top:groups[k].add([i],v/total,'REPLACE')
  error=max(error,abs(sum(v/total for k,v in top)-1))
 assert unweighted==0
 arm=o.modifiers.new('Highhorn - original skeleton skinning','ARMATURE');arm.object=rig
 arm.use_deform_preserve_volume=body.modifiers['Armature'].use_deform_preserve_volume
 # Reversible Blender-only correction for residual movement intersections.
 clearance=o.modifiers.new('Highhorn - animated body clearance (Blender review)','SHRINKWRAP')
 clearance.target=body;clearance.wrap_method='NEAREST_SURFACEPOINT';clearance.wrap_mode='OUTSIDE';clearance.offset=.009
 o['Highhorn_Rigged']=True;o['Highhorn_Skinning']='Transferred from original Grab3D mesh; normalized, max 4 influences'
 report['garments'][name]={'vertices':len(ws),'unweighted':unweighted,'max_normalization_error':error,'uv_layers':len(o.data.uv_layers)}
 print('SKINNED',name,len(ws),flush=True)
# Preserve a hidden animated full-body clearance cage before masking covered toes.
# The base mesh and all original skin groups remain intact; the mask is reversible.
cage=body.copy();cage.data=body.data.copy();cage.name='REVIEW_ONLY - full body clearance cage'
scene.collection.objects.link(cage);cage.hide_render=True;cage.hide_set(True)
for name in names:
 next(m for m in bpy.data.objects[name].modifiers if m.type=='SHRINKWRAP').target=cage
# Boots enclose this region in the accepted fit. Hide the covered base feet to
# prevent toes appearing through the source boots' open sole seams during motion.
visible=body.vertex_groups.new(name='Highhorn - visible base above boot soles')
keep=[v.index for v in body.data.vertices if (body.matrix_world@v.co).z>.105]
visible.add(keep,1,'REPLACE')
mask=body.modifiers.new('Highhorn - covered toes (reversible)','MASK')
mask.vertex_group=visible.name;mask.threshold=.5
report['covered_surface_mask']='Non-destructive mask of base rest vertices below Z 0.105 inside boots; full original geometry retained'
rig.data.pose_position='POSE'
for track in rig.animation_data.nla_tracks:track.mute=True
scene.name='RIGGED OUTFIT - WALK RUN REVIEW'
scene.render.resolution_x=560;scene.render.resolution_y=640
scene.camera=bpy.data.objects['Fit review ThreeQuarter']
scene.frame_start=0
# Test every frame of both clips for finite evaluated vertices and movement.
report['animations']={}
for action_name in ['walk','run']:
 action=bpy.data.actions[action_name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
 start,end=map(int,action.frame_range);frames={};reference=None;max_motion={n:0 for n in names}
 for frame in range(start,end+1):
  scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
  for name in names:
   ob=bpy.data.objects[name].evaluated_get(dg);mesh=ob.to_mesh()
   samples=[ob.matrix_world@mesh.vertices[i].co for i in range(0,len(mesh.vertices),83)]
   assert all(math.isfinite(x) for p in samples for x in p), (action_name,frame,name)
   key=(name,frame)
   if frame==start:frames[name]=samples
   else:max_motion[name]=max(max_motion[name],max((a-b).length for a,b in zip(samples,frames[name])))
   ob.to_mesh_clear()
  if frame in {start,start+(end-start)//4,start+(end-start)//2,start+3*(end-start)//4}:
   scene.render.filepath=str(ROOT/f'Exports/Highhorn_Rigged_{action_name}_{frame:02d}.png')
   bpy.ops.render.render(write_still=True)
 for name,motion in max_motion.items():assert motion>.015,(action_name,name,motion)
 report['animations'][action_name]={'tested_frames':[start,end],'finite_samples_every_frame':True,'max_sampled_motion':max_motion}
 print('TESTED',action_name,max_motion,flush=True)
assert digest()==before,'Original mesh, weights, rest bones or action curves changed'
report['base_digest_after']=digest()
# Leave the new file ready to play the walk cycle. Keep original actions/NLA strips.
rig.animation_data.action=bpy.data.actions['walk'];rig.animation_data.action_slot=bpy.data.actions['walk'].slots[0]
scene.frame_end=24;scene.frame_set(0)
scene['Highhorn_Fit_Status']='Skinned walk/run prototype; includes Blender-only animated clearance modifiers'
scene['Highhorn_Rig_Validation']=json.dumps(report)
output=ROOT/'Exports/Highhorn_Male_Commoner_RIGGED_TEST.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(output))
(ROOT/'Exports/Highhorn_Rigged_Validation.json').write_text(json.dumps(report,indent=2))
print('SAVED',output,flush=True)
