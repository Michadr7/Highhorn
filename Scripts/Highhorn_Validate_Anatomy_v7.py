import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
from mathutils.kdtree import KDTree
O=ROOT/'Exports/MedievalRoster/2026-11-01/Anatomy_v7';rows=[]
for file in sorted(O.glob('**/*_ANATOMY_TEST.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(file));rig=bpy.data.objects['Roster_Armature'];head=bpy.data.objects['Native face and neck'];source=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'));slug=file.name.split('_ANATOMY')[0];neck=rig.matrix_world@rig.data.bones['neck'].head_local;report=json.loads((file.parent/'Repair_Report.json').read_text());assert report['walk_run_unchanged']=={n:action_hash(bpy.data.actions[n]) for n in ['walk','run']}
 def key(p):return tuple(round(x,5) for x in p)
 actual={key(head.matrix_world@v.co) for v in head.data.vertices};protected=[]
 for v in source.data.vertices:
  p=source.matrix_world@v.co
  if p.z<=neck.z+.06 or abs(p.x-neck.x)>.24:continue
  if slug=='elderly-woman':p=neck+(p-neck)*.86
  protected.append(key(p))
 tree=KDTree(len(actual))
 for i,p in enumerate(actual):tree.insert(Vector(p),i)
 tree.balance();maximum=max(tree.find(Vector(p))[2] for p in protected);assert maximum<.00003,(slug,'Native face/hair geometry differs',maximum)
 samples=0
 for track in rig.animation_data.nla_tracks:track.mute=True
 for clip,frames in [('idle',[0,24,48,72]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for frame in frames:
   bpy.context.scene.frame_set(frame)
   for obj in [head,bpy.data.objects['Roster_Body'],bpy.data.objects['Shoulders']]:
    ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();assert all(math.isfinite(x) for v in m.vertices for x in v.co);ev.to_mesh_clear()
   samples+=1
 rows.append({'file':str(file.relative_to(O)),'native_face_hair_vertices_preserved':len(protected),'poses':samples,'walk_run_unchanged':True});print('ANATOMY VALIDATED',rows[-1],flush=True)
assert len(rows)==9
(O/'Validation.json').write_text(json.dumps({'passed':True,'results':rows,'scope':'Native source face/hair vertex preservation above the lower collar band, saved-file finite posed surfaces and unchanged walk/run keys. Visual palm orientation checked separately in browser images.'},indent=2))
