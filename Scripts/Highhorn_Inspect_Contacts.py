import bpy,json,sys
from pathlib import Path
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/FemaleCommoner'
is_export='--glb' in sys.argv
if is_export:
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ROOT/'Models/Heroes/FemaleCommoner/commoner.glb'))
else:bpy.ops.wm.open_mainfile(filepath=str(OUT/'Highhorn_Female_Commoner_TEST.blend'))
rig=bpy.data.objects['Female_Armature'];body=bpy.data.objects['Female_Body'];scene=bpy.context.scene
groups={g.index:g.name for g in body.vertex_groups}
hand={v.index for v in body.data.vertices if any(groups[g.group] in ['LeftHand','RightHand'] and g.weight>.5 for g in v.groups)}
for name in ['walk','run']:
 a=bpy.data.actions[name];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for t in rig.animation_data.nla_tracks:t.mute=True
 rows=[];clearance=100
 for f in range(int(a.frame_range[0]),int(a.frame_range[1])+1):
  scene.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();o=body.evaluated_get(dg);m=o.to_mesh();pts=[o.matrix_world@v.co for v in m.vertices]
  faces=[tuple(p.vertices) for p in m.polygons if all(i in hand for i in p.vertices)];tree=BVHTree.FromPolygons(pts,faces)
  for garment in ['Tunic','Pants','Shoulders']:
   g=bpy.data.objects[garment].evaluated_get(dg);gm=g.to_mesh();gp=[g.matrix_world@v.co for v in gm.vertices];gt=BVHTree.FromPolygons(gp,[tuple(p.vertices) for p in gm.polygons]);hits=tree.overlap(gt)
   clearance=min(clearance,min(gt.find_nearest(pts[i])[3] for i in hand))
   if hits:
    contact=[pts[i] for h,j in hits for i in faces[h]]
    rows.append({'frame':f,'garment':garment,'hits':len(hits),'bounds':[[min(p[i] for p in contact) for i in range(3)],[max(p[i] for p in contact) for i in range(3)]]})
   g.to_mesh_clear()
  o.to_mesh_clear()
 report={'source':'game GLB' if is_export else 'Blender test','minimum_hand_surface_distance_m':clearance,'intersections':rows,'frames_tested':int(a.frame_range[1]-a.frame_range[0])+1}
 (OUT/(name+('_GLB' if is_export else '')+'_HandOnly_Contacts.json')).write_text(json.dumps(report,indent=2));print(name,json.dumps(report),flush=True)
