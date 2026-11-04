"""Measure actual posed hand/forearm triangles against the tunic and trousers."""
import bpy,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]);output=Path(args[1])
if source.suffix=='.glb':
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
else:bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene;rig=bpy.data.objects.get('Female_Armature') or bpy.data.objects['Armature'];body=bpy.data.objects.get('Female_Body') or bpy.data.objects['char1']
action_name=args[2] if len(args)>2 else 'idle'
a=bpy.data.actions[action_name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
for t in rig.animation_data.nla_tracks:t.mute=True
groups={g.index:g.name for g in body.vertex_groups}
# Include the whole hand plus forearm vertices below the sleeve cuff.
selected={v.index for v in body.data.vertices if any(groups[g.group] in ['LeftHand','RightHand','LeftForeArm','RightForeArm'] and g.weight>.15 for g in v.groups)}
hands={v.index for v in body.data.vertices if any(groups[g.group] in ['LeftHand','RightHand'] and g.weight>.15 for g in v.groups)}
report={'source':str(source),'action':action_name,'frames':[]}
for f in range(int(a.frame_range[0]),int(a.frame_range[1])+1,4 if action_name=='idle' else 1):
 scene.frame_set(f);dg=bpy.context.evaluated_depsgraph_get()
 ob=body.evaluated_get(dg);mesh=ob.to_mesh();points=[ob.matrix_world@v.co for v in mesh.vertices]
 cuff_height=1.10 if body.name=='Female_Body' else 1.18
 faces=[tuple(p.vertices) for p in mesh.polygons if all(i in hands or (i in selected and points[i].z<cuff_height) for i in p.vertices)]
 used=set(i for p in faces for i in p);hand=BVHTree.FromPolygons(points,faces)
 row={'frame':f,'garments':{}}
 for name in ['Tunic','Pants']:
  o=bpy.data.objects[name].evaluated_get(dg);m=o.to_mesh();verts=[o.matrix_world@v.co for v in m.vertices]
  tree=BVHTree.FromPolygons(verts,[tuple(p.vertices) for p in m.polygons]);overlaps=hand.overlap(tree)
  near=min(tree.find_nearest(points[i])[3] for i in used)
  row['garments'][name]={'intersecting_triangle_pairs':len(overlaps),'minimum_vertex_surface_distance_m':near}
  o.to_mesh_clear()
 ob.to_mesh_clear();report['frames'].append(row)
report['maximum_intersections']=max(g['intersecting_triangle_pairs'] for row in report['frames'] for g in row['garments'].values())
report['minimum_clearance_m']=min(g['minimum_vertex_surface_distance_m'] for row in report['frames'] for g in row['garments'].values())
output.write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='frames'}))
