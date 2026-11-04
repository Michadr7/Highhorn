import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'Exports/MedievalRoster/2026-11-01/NaturalIdle_v4';OUT=BASE.parent/'Neck_v5';OUT.mkdir(exist_ok=True);reports={}
for slug in ['businessman','man','woman','elderly-man','elderly-woman']:
 bpy.ops.wm.open_mainfile(filepath=str(BASE/slug/(slug+'_NATURAL_IDLE_TEST.blend')));rig=bpy.data.objects['Roster_Armature'];body=bpy.data.objects['Roster_Body'];rig.data.pose_position='REST';bpy.context.view_layer.update();neck=rig.matrix_world@rig.data.bones['neck'].head_local;head=rig.matrix_world@rig.data.bones['Head'].head_local
 image=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name.lower());pixels=list(image.pixels);iw,ih=image.size;uv=body.data.uv_layers.active.data;bins={}
 for poly in body.data.polygons:
  p=sum((body.matrix_world@body.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
  if not neck.z-.06<p.z<head.z+.025 or math.hypot(p.x-neck.x,p.y-neck.y)>.105:continue
  key=round(math.floor((p.z-neck.z)*100)/100,2);row=bins.setdefault(key,{'faces':0,'skin':0,'dark':0,'head_weight':0,'neck_weight':0,'material_slots':{}});row['faces']+=1
  coords=[uv[i].uv for i in poly.loop_indices];u=sum(p.x for p in coords)/len(coords);v=sum(p.y for p in coords)/len(coords);idx=(int(v%1*(ih-1))*iw+int(u%1*(iw-1)))*4;r,g,b=pixels[idx:idx+3];row['skin']+=r>g*1.04 and r>b*1.10 and b>r*.25;row['dark']+=max(r,g,b)<.22;row['material_slots'][poly.material_index]=row['material_slots'].get(poly.material_index,0)+1
  for vid in poly.vertices:
   for q in body.data.vertices[vid].groups:
    name=body.vertex_groups[q.group].name
    if name=='Head':row['head_weight']+=q.weight/len(poly.vertices)
    if name=='neck':row['neck_weight']+=q.weight/len(poly.vertices)
 for row in bins.values():
  for name in ['head_weight','neck_weight']:row[name]/=row['faces']
 reports[slug]={'neck':list(neck),'head':list(head),'bins':bins}
(OUT/'Inspection.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports),flush=True)
