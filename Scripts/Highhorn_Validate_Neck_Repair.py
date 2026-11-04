import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01/Neck_v5';rows=[]
for slug in ['businessman','man','elderly-man','elderly-woman']:
 path=OUT/slug/(slug+'_NECK_TEST.blend');bpy.ops.wm.open_mainfile(filepath=str(path));rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];report=json.loads((OUT/slug/'Neck_Report.json').read_text());actions={name:bpy.data.actions[name] for name in ['idle','walk','run']}
 for name,digest in report['actions_unchanged'].items():assert action_hash(actions[name])==digest,(slug,name)
 index=next(i for i,m in enumerate(body.data.materials) if m.name.startswith('Repaired neck skin'));rig.data.pose_position='POSE'
 for track in rig.animation_data.nla_tracks:track.mute=True
 rays=0;distances=[];failures=[]
 for clip,frames in [('idle',[0,24,48,72]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  rig.animation_data.action=actions[clip];rig.animation_data.action_slot=actions[clip].slots[0]
  for frame in frames:
   bpy.context.scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(deps);mesh=ev.to_mesh();points=[ev.matrix_world@v.co for v in mesh.vertices];faces=[tuple(f.vertices) for f in mesh.polygons if f.material_index==index];assert faces;assert all(all(math.isfinite(x) for x in p) for p in points);tree=BVHTree.FromPolygons(points,faces);origin=rig.matrix_world@rig.pose.bones['neck'].head
   for height in [-.015,0,.015]:
    for step in range(16):
     angle=2*math.pi*step/16;start=origin+Vector((0,0,height));direction=Vector((math.cos(angle),math.sin(angle),0));hit=tree.ray_cast(start,direction,.25);rays+=1
     if hit[0] is None:failures.append({'clip':clip,'frame':frame,'height':height,'angle':step})
     else:distances.append(hit[3])
   ev.to_mesh_clear()
 assert not failures,(slug,'Open reconstructed neck surface',failures)
 rows.append({'id':slug,'passed':True,'sampled_poses':12,'coverage_rays':rays,'misses':len(failures),'min_radius_m':min(distances),'max_radius_m':max(distances),'idle_walk_run_hashes_unchanged':True});print('NECK VALIDATED',slug,json.dumps(rows[-1]),flush=True)
(OUT/'Neck_Validation.json').write_text(json.dumps({'passed':True,'results':rows,'scope':'Reopened saved files, finite evaluated body geometry, unchanged idle/walk/run hashes, and 360-degree coverage of reconstructed neck skin at three heights through twelve poses. Not a full head/clothing collision certification.'},indent=2))
