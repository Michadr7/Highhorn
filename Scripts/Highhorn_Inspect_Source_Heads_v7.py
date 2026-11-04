import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
O=ROOT/'Exports/MedievalRoster/2026-11-01/Anatomy_v7';O.mkdir(exist_ok=True);rows=[]
for slug in ['businessman','woman','elderly-woman']:
 bpy.ops.wm.open_mainfile(filepath=str(O.parent/'Garment_v6'/slug/(slug+'_GARMENT_TEST.blend')));rig=bpy.data.objects['Roster_Armature'];rig.data.pose_position='REST';bpy.context.view_layer.update();src=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'));neck=rig.matrix_world@rig.data.bones['neck'].head_local;head=rig.matrix_world@rig.data.bones['Head'].head_local;groups={g.index:g.name for g in src.vertex_groups};row={'id':slug,'neck':list(neck),'head':list(head),'bins':[]}
 for low in [-.02,0,.02,.04,.06,.08,.10,.12]:
  fs=[]
  for f in src.data.polygons:
   p=sum((src.matrix_world@src.data.vertices[i].co for i in f.vertices),Vector())/len(f.vertices)
   if neck.z+low<p.z<neck.z+low+.02:
    h=sum(sum(g.weight for g in src.data.vertices[i].groups if groups[g.group]=='Head') for i in f.vertices)/len(f.vertices);fs.append((h,p.y))
  row['bins'].append({'z':low,'faces':len(fs),'head_weight':list(np.quantile([r[0] for r in fs],[0,.25,.5,.75,1])) if fs else []})
 rows.append(row)
(O/'Source_Heads.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows),flush=True)
