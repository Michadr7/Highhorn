import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
root=ROOT/'Exports/MedievalRoster/2026-11-01';out=root/'Garment_v6';out.mkdir(exist_ok=True)
rows=[]
for slug,revision,tag in [('woman','NaturalIdle_v4','NATURAL_IDLE'),('businessman','Neck_v5','NECK')]:
 bpy.ops.wm.open_mainfile(filepath=str(root/revision/slug/(slug+'_'+tag+'_TEST.blend')));rig=bpy.data.objects['Roster_Armature'];rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(24)
 row={'id':slug,'bones':{n:list(rig.matrix_world@rig.data.bones[n].head_local) for n in ['neck','Spine02','LeftArm','LeftForeArm','LeftHand']},'objects':{}}
 for name in ['Tunic','Shoulders']:
  o=bpy.data.objects[name];ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();rest=[o.matrix_world@v.co for v in o.data.vertices];posed=[ev.matrix_world@v.co for v in m.vertices];edges=[]
  for e in o.data.edges:
   a,b=e.vertices;d=(rest[a]-rest[b]).length;p=(posed[a]-posed[b]).length
   if p>.04:edges.append({'ratio':p/max(d,.00001),'rest':d,'posed':p,'vertices':[{'id':i,'p':list(rest[i]),'weights':{o.vertex_groups[g.group].name:g.weight for g in o.data.vertices[i].groups}} for i in [a,b]]})
  row['objects'][name]={'bounds':[[min(p[i] for p in rest),max(p[i] for p in rest)] for i in range(3)],'worst':sorted(edges,key=lambda e:e['ratio'],reverse=True)[:12]};ev.to_mesh_clear()
 rows.append(row)
(out/'Inspection.json').write_text(json.dumps(rows,indent=2))
