import bpy,json,struct
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/GameReady'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Highhorn_Male_Commoner_EXPORT.blend'))
source_scene=bpy.context.scene;rig=bpy.data.objects['Armature'];names=['char1','Tunic','Shoulders','Pants','Boots']
refs={}
for act,fs in [('walk',[0,6,12,18,24]),('run',[0,3,7,11,15])]:
 a=bpy.data.actions[act];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
 for frame in fs:
  source_scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
  for name in names:
   o=bpy.data.objects[name].evaluated_get(dg);m=o.to_mesh();refs[(act,frame,name)]=[o.matrix_world@v.co for v in list(m.vertices)[::157]];o.to_mesh_clear()
scene=bpy.data.scenes.new('GLB ROUNDTRIP VALIDATION');bpy.context.window.scene=scene
scene.render.fps=source_scene.render.fps
prior=set(bpy.data.objects);old_actions=set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=str(OUT/'Highhorn_Male_Commoner.glb'))
new=set(bpy.data.objects)-prior;new_actions=set(bpy.data.actions)-old_actions
r=next(o for o in new if o.type=='ARMATURE');r.data.pose_position='POSE'
for t in r.animation_data.nla_tracks:t.mute=True
meshes={n:next(o for o in new if o.type=='MESH' and o.name.split('.')[0]==n) for n in names}
report={}
for act,fs in [('walk',[0,6,12,18,24]),('run',[0,3,7,11,15])]:
 a=next(a for a in new_actions if a.name.split('.')[0]==act);r.animation_data.action=a;r.animation_data.action_slot=a.slots[0]
 report[act]={'frame_range':list(a.frame_range),'maximum_nearest_surface_error':{},'tested_frames':fs}
 for frame in fs:
  scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
  for name,o in meshes.items():
   e=o.evaluated_get(dg);m=e.to_mesh();pts=[e.matrix_world@v.co for v in m.vertices];bvh=BVHTree.FromPolygons(pts,[tuple(p.vertices) for p in m.polygons]);error=max(bvh.find_nearest(p)[3] for p in refs[(act,frame,name)]);e.to_mesh_clear()
   report[act]['maximum_nearest_surface_error'][name]=max(report[act]['maximum_nearest_surface_error'].get(name,0),error)
   assert error<.003,(act,frame,name,error)
# Structural checks from the exact GLB binary.
buf=(OUT/'Highhorn_Male_Commoner.glb').read_bytes();length,kind=struct.unpack_from('<II',buf,12);doc=json.loads(buf[20:20+length])
assert len(doc['meshes'])==5 and len(doc['skins'])>=1
assert {a['name'] for a in doc['animations']}=={'walk','run'}
assert all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for m in doc['meshes'] for p in m['primitives'])
assert all('uri' not in i for i in doc['images'])
assert not any('Icosphere' in n.get('name','') or n.get('name')=='Cube' for n in doc['nodes'])
report['structure']={'meshes':len(doc['meshes']),'skins':len(doc['skins']),'animations':[a['name'] for a in doc['animations']],'embedded_images':len(doc['images']),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])}
(OUT/'Roundtrip_Validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
