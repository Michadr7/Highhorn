import sys,json,hashlib,struct,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
O=ROOT/'Exports/MedievalRoster/2026-11-01/CommonerBoots_v8';rows=[]
def geometry(o):
 h=hashlib.sha256()
 for v in o.data.vertices:h.update(struct.pack('<3f',*v.co))
 for layer in o.data.uv_layers:
  for v in layer.data:h.update(struct.pack('<2f',*v.uv))
 return h.hexdigest()
def binding(o):return hashlib.sha256(repr([[(o.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in o.data.vertices]).encode()).hexdigest()
def skeleton(r):return repr([(b.name,b.parent.name if b.parent else None,[list(row) for row in b.matrix_local]) for b in r.data.bones])
for file in sorted(O.glob('**/*_BOOTS_TEST.blend')):
 report=json.loads((file.parent/'Fit_Report.json').read_text());bpy.ops.wm.open_mainfile(filepath=report['source_blend']);boot=bpy.data.objects['Boots'];rig=next(m.object for m in boot.modifiers if m.type=='ARMATURE');rig.data.pose_position='REST';bpy.context.view_layer.update();original_other={o.name:geometry(o) for o in bpy.context.scene.objects if o.type=='MESH' and o!=boot};original_uv=[tuple(v.uv) for v in boot.data.uv_layers.active.data];weights=binding(boot);bones=skeleton(rig);actions={a.name:action_hash(a) for a in bpy.data.actions};positions=[v.co.copy() for v in boot.data.vertices]
 bpy.ops.wm.open_mainfile(filepath=str(file));boot=bpy.data.objects['Boots'];rig=next(m.object for m in boot.modifiers if m.type=='ARMATURE');assert skeleton(rig)==bones;assert all(action_hash(bpy.data.actions[n])==h for n,h in actions.items());assert original_other=={name:geometry(bpy.data.objects[name]) for name in original_other};assert binding(boot)==weights;assert original_uv==[tuple(v.uv) for v in boot.data.uv_layers.active.data]
 for side,sign in [('Left',1),('Right',-1)]:
  row=report['boots'][side];ankle=Vector(row['ankle_world']);toe=Vector(row['toe_joint_world']);forward=(toe-ankle).normalized();right=Vector((0,0,1)).cross(forward).normalized();points=[boot.matrix_world@v.co for v in boot.data.vertices if (boot.matrix_world@v.co).x*sign>0 and (boot.matrix_world@v.co).z<ankle.z+.035]
  for axis,expected in [(forward,row['target_sole_length_m']),(right,row['target_sole_width_m'])]:assert abs(max(p.dot(axis) for p in points)-min(p.dot(axis) for p in points)-expected)<.00002
  for v,p in zip(boot.data.vertices,positions):
   q=boot.matrix_world@p
   if q.x*sign>0 and q.z>=row['upper_shaft_unchanged_above_z']:assert (p-v.co).length<.000001
 sides={s:[tuple(f.vertices) for f in boot.data.polygons if all((boot.matrix_world@boot.data.vertices[i].co).x*sign>0 for i in f.vertices)] for s,sign in [('Left',1),('Right',-1)]};hits=[]
 rig.data.pose_position='POSE'
 for track in rig.animation_data.nla_tracks:track.mute=True
 for clip,frames in [('idle',[0,24,48,72]),('walk',list(range(0,25,3))),('run',list(range(0,16,3)))]:
  action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for frame in frames:
   bpy.context.scene.frame_set(frame);ev=boot.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();points=[ev.matrix_world@v.co for v in m.vertices];assert all(math.isfinite(x) for p in points for x in p);trees={s:BVHTree.FromPolygons(points,faces) for s,faces in sides.items()};pairs=len(trees['Left'].overlap(trees['Right']));hits.append({'clip':clip,'frame':frame,'boot_to_boot_pairs':pairs});ev.to_mesh_clear()
 assert not any(p['boot_to_boot_pairs'] for p in hits),(file,'Boots overlap',hits)
 rows.append({'file':str(file.relative_to(O)),'passed':True,'poses':len(hits),'boot_to_boot_intersections':0,'other_meshes_unchanged':True,'all_action_keys_and_rest_skeleton_unchanged':True,'boot_uv_weights_and_upper_shafts_unchanged':True});print('BOOTS VALIDATED',rows[-1],flush=True)
assert len(rows)==6
(O/'Validation.json').write_text(json.dumps({'passed':True,'results':rows,'scope':'Measured footprints, original non-boot geometry, boot UV/binding, unchanged upper shafts, all saved action keys and rest bones, sampled finite poses and left/right boot intersections. Not continuous cloth collision certification.'},indent=2))
