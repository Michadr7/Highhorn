import bpy,json,sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'Exports/MedievalRoster/2026-11-01/Neck_v5';rows=[]
for slug in (sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['man','businessman','elderly-man','elderly-woman']):
 bpy.ops.wm.open_mainfile(filepath=str(OUT/slug/(slug+'_NECK_TEST.blend')));rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];rig.data.pose_position='REST';bpy.context.view_layer.update();ids=set()
 groups={g.index:g.name for g in body.vertex_groups}
 for v in body.data.vertices:
  if sum(g.weight for g in v.groups if groups[g.group].startswith(('LeftHand','RightHand','LeftForeArm','RightForeArm')))>.65:
   p=body.matrix_world@v.co
   if sum(g.weight for g in v.groups if groups[g.group].startswith(('LeftHand','RightHand')))>.65 or min((p-(rig.matrix_world@rig.data.bones[s+'Hand'].head_local)).length for s in ['Left','Right'])<.095:ids.add(v.index)
 faces=[tuple(f.vertices) for f in body.data.polygons if all(i in ids for i in f.vertices)];rig.data.pose_position='POSE'
 for track in rig.animation_data.nla_tracks:track.mute=True
 samples=[]
 for clip,frames in [('idle',[0,24,48,72]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  a=bpy.data.actions[clip];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
  for frame in frames:
   bpy.context.scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps);mesh=ev.to_mesh();points=[ev.matrix_world@v.co for v in mesh.vertices];handtree=BVHTree.FromPolygons(points,faces);ev.to_mesh_clear();hits={}
   for name in ['Tunic','Pants','Shoulders']:
    obj=bpy.data.objects[name];ev=obj.evaluated_get(deps);mesh=ev.to_mesh();tree=BVHTree.FromPolygons([ev.matrix_world@v.co for v in mesh.vertices],[tuple(f.vertices) for f in mesh.polygons]);hits[name]=len(handtree.overlap(tree));ev.to_mesh_clear()
   samples.append({'clip':clip,'frame':frame,'surface_triangle_pairs':hits})
 rows.append({'id':slug,'distal_hand_faces':len(faces),'samples':samples});print('CLEARANCE',slug,json.dumps(samples),flush=True)
(OUT/'Hand_Clearance.json').write_text(json.dumps({'scope':'Surface-intersection pairs between whole hand and proximal wrist faces and actual garment meshes at 12 poses per starter. Includes the wrist/cuff area within 9.5 cm of wrist. Not a continuous collision guarantee.','results':rows},indent=2))
