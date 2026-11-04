"""Isolated torso weight correction and boundary-derived inner collar lining."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'Garment_v6';OUT.mkdir(exist_ok=True)

def torso_weights(rig,o):
 elbow=rig.matrix_world@rig.data.bones['LeftForeArm'].head_local;neck=rig.matrix_world@rig.data.bones['neck'].head_local;changed=0
 with bpy.data.libraries.load(str(BASE/'Corrections_v2/woman/woman_CORRECTED_TEST.blend'),link=False) as (available,loaded):loaded.objects=['Tunic']
 original=loaded.objects[0];assert len(original.data.vertices)==len(o.data.vertices),'Cannot restore torso by index: topology changed'
 def smooth(a,b,x):
  t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
 for v in o.data.vertices:
  restored=o.matrix_world@original.data.vertices[v.index].co;p=restored;blend=(1-smooth(.24,.27,abs(p.x-neck.x)))*(1-smooth(elbow.z-.04,elbow.z+.04,p.z))
  if blend<.00001:continue
  v.co=v.co.lerp(o.matrix_world.inverted()@restored,blend)
  old={g.group:g.weight for g in v.groups if o.vertex_groups[g.group].name in rig.data.bones};total=sum(old.values());old={i:w/total for i,w in old.items()}
  height=smooth(.97,1.16,p.z);target={o.vertex_groups['Hips'].index:1-height,o.vertex_groups['Spine01'].index:height*(1-height),o.vertex_groups['Spine02'].index:height*height}
  weights={i:w*(1-blend) for i,w in old.items()}
  for i,w in target.items():weights[i]=weights.get(i,0)+w*blend
  for i in old:o.vertex_groups[i].remove([v.index])
  for i,w in weights.items():
   if w>1e-7:o.vertex_groups[i].add([v.index],w,'REPLACE')
  changed+=1
 return changed

def lining(rig,body):
 neck=rig.matrix_world@rig.data.bones['neck'].head_local;world=body.matrix_world;bottom=neck.z-.05;slot=next(i for i,m in enumerate(body.data.materials) if m.name.startswith('Repaired neck skin'))
 bm=bmesh.new();bm.from_mesh(body.data);deform=bm.verts.layers.deform.verify();uv=bm.loops.layers.uv.active
 caps=[f for f in bm.faces if f.material_index==slot and all(abs((world@v.co).z-bottom)<.0002 for v in f.verts)];assert len(caps)==1
 ring=list(caps[0].verts);bmesh.ops.delete(bm,geom=caps,context='FACES_ONLY')
 # Intersect the actual hood/tunic at the lower collar plane to derive the
 # lining perimeter. Its inner edge is the existing repaired neck boundary.
 points=[];polys=[]
 for name in ['Shoulders','Tunic']:
  o=bpy.data.objects[name];offset=len(points);points.extend(o.matrix_world@v.co for v in o.data.vertices);polys.extend(tuple(offset+i for i in f.vertices) for f in o.data.polygons)
 tree=BVHTree.FromPolygons(points,polys);mat=bpy.data.objects['Tunic'].data.materials[0];body.data.materials.append(mat);cloth=len(body.data.materials)-1;outer=[];misses=0
 spine=body.vertex_groups.get('Spine02') or body.vertex_groups['Spine01']
 for v in ring:
  p=world@v.co;direction=Vector((p.x-neck.x,p.y-neck.y,0)).normalized();start=Vector((neck.x,neck.y,bottom));hit=tree.ray_cast(start,direction,.35)
  assert hit[0] is not None,('No measured inner collar intersection',list(direction))
  q=hit[0]+direction*.012;q.z-=.055;w=bm.verts.new(world.inverted()@q);w[deform][spine.index]=1;outer.append(w)
 for i in range(len(ring)):
  j=(i+1)%len(ring);f=bm.faces.new((ring[i],ring[j],outer[j],outer[i]));f.material_index=cloth;f.smooth=True
  for l in f.loops:
   p=world@l.vert.co;l[uv].uv=(.45+(p.x-neck.x)*.35,.45+(p.y-neck.y)*.35)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free();body.data.update()
 return {'lining_faces':len(ring),'perimeter_method':'radial intersections with original hood and tunic at actual neck boundary height'}

ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['businessman','woman','elderly-woman','man','elderly-man']
for slug in ids:
 revision,tag=('NaturalIdle_v4','NATURAL_IDLE') if slug=='woman' else ('Neck_v5','NECK')
 for variant in ['original','warm-medium','deep-warm']:
  rel=Path(slug) if variant=='original' else Path(slug)/'Appearance'/variant;dest=OUT/rel;dest.mkdir(parents=True,exist_ok=True);source=BASE/revision/rel/(slug+'_'+tag+'_TEST.blend');bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];hashes={n:action_hash(bpy.data.actions[n]) for n in ['idle','walk','run']};rig.data.pose_position='REST';bpy.context.view_layer.update()
  report={'id':slug,'variant':variant,'source':str(source),'actions_unchanged':hashes}
  if slug=='woman':report['torso_vertices_reweighted']=torso_weights(rig,bpy.data.objects['Tunic'])
  else:report.update(lining(rig,body))
  rig.data.pose_position='POSE';rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);bpy.context.view_layer.update()
  meshes=[body]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_GARMENT_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression');assert hashes=={n:action_hash(bpy.data.actions[n]) for n in hashes};(dest/'Repair_Report.json').write_text(json.dumps(report,indent=2));print('GARMENT SAVED',slug,variant,flush=True)
