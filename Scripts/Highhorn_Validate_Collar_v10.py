import sys,json,hashlib,struct,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
O=ROOT/'Exports/MedievalRoster/2026-11-01/Collar_v10';rows=[]
def geometry(o):return hashlib.sha256(b''.join(struct.pack('<3f',*v.co) for v in o.data.vertices)).hexdigest()
def binding(o):return hashlib.sha256(repr([[(o.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in o.data.vertices]).encode()).hexdigest()
for file in sorted(O.glob('**/*_COLLAR_TEST.blend')):
 report=json.loads((file.parent/'Repair_Report.json').read_text());bpy.ops.wm.open_mainfile(filepath=report['source_blend']);weights=binding(bpy.data.objects['Native face and neck']);rig=bpy.data.objects['Roster_Armature'];bones=repr([(b.name,[list(row) for row in b.matrix_local]) for b in rig.data.bones]);bpy.ops.wm.open_mainfile(filepath=str(file));rig=bpy.data.objects['Roster_Armature'];head=bpy.data.objects['Native face and neck'];assert weights==binding(head);assert bones==repr([(b.name,[list(row) for row in b.matrix_local]) for b in rig.data.bones]);assert report['mesh_positions_unchanged']=={n:geometry(bpy.data.objects[n]) for n in report['mesh_positions_unchanged']};assert report['actions_unchanged']=={a.name:action_hash(a) for a in bpy.data.actions};group=head.vertex_groups['Head'].index;facial=0
 for face in head.data.polygons:
  h=sum(sum(g.weight for g in head.data.vertices[i].groups if g.group==group) for i in face.vertices)/len(face.vertices)
  if h>.60:assert face.material_index!=1,('Facial surface has collar material',file,face.index);facial+=1
 assert facial>1000
 for track in rig.animation_data.nla_tracks:track.mute=True
 samples=0
 for clip,frames in [('idle',[0,24,48,72]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  a=bpy.data.actions[clip];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
  for frame in frames:
   bpy.context.scene.frame_set(frame);ev=head.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();assert all(math.isfinite(x) for v in m.vertices for x in v.co);ev.to_mesh_clear();samples+=1
 rows.append({'file':str(file.relative_to(O)),'passed':True,'facial_faces_with_correct_skin_material':facial,'poses':samples,'all_mesh_positions_bindings_rest_bones_action_keys_unchanged':True});print('COLLAR VALIDATED',rows[-1],flush=True)
assert len(rows)==9
(O/'Validation.json').write_text(json.dumps({'passed':True,'results':rows},indent=2))
