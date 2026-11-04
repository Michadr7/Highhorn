import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
O=ROOT/'Exports/MedievalRoster/2026-11-01/Collar_v10';O.mkdir(exist_ok=True);rows=[]
for slug,folder in [('man','VillagerNeck_v9'),('businessman','Anatomy_v7'),('woman','Anatomy_v7')]:
 bpy.ops.wm.open_mainfile(filepath=str(O.parent/folder/slug/(slug+'_ANATOMY_TEST.blend')));r=bpy.data.objects['Roster_Armature'];r.data.pose_position='REST';bpy.context.view_layer.update();o=bpy.data.objects['Native face and neck'];n=r.matrix_world@r.data.bones['neck'].head_local;hg=o.vertex_groups['Head'].index;faces=[]
 for f in o.data.polygons:
  p=sum((o.matrix_world@o.data.vertices[i].co for i in f.vertices),Vector())/len(f.vertices)
  if f.material_index==1 and p.y<n.y-.045:
   h=sum(sum(g.weight for g in o.data.vertices[i].groups if g.group==hg) for i in f.vertices)/len(f.vertices);faces.append({'index':f.index,'position_from_neck':list(p-n),'head_weight':h})
 rows.append({'id':slug,'upper_cloth_faces':len(faces),'highest':sorted(faces,key=lambda a:a['head_weight'],reverse=True)[:18]})
(O/'Front_Inspection.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows),flush=True)
