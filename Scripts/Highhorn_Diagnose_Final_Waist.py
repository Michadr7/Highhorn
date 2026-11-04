import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01/Garment_v6';rows=[]
for source in [OUT/'woman/woman_GARMENT_TEST.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(source));rig=bpy.data.objects['Roster_Armature'];report=json.loads((source.parent/'Repair_Report.json').read_text());assert report['actions_unchanged']=={n:action_hash(bpy.data.actions[n]) for n in report['actions_unchanged']};o=bpy.data.objects['Tunic'];rest=[o.matrix_world@v.co for v in o.data.vertices];neck=rig.matrix_world@rig.data.bones['neck'].head_local;tested=0;maxstrain=0
 for track in rig.animation_data.nla_tracks:track.mute=True
 for clip,frames in [('idle',[0,24,48,72]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  action=bpy.data.actions[clip];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for frame in frames:
   bpy.context.scene.frame_set(frame);ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();posed=[ev.matrix_world@v.co for v in m.vertices];assert all(math.isfinite(x) for p in posed for x in p)
   if report['id']=='woman':
    for e in o.data.edges:
     a,b=e.vertices
     if all(abs(rest[i].x-neck.x)<.28 and .75<rest[i].z<1.05 for i in [a,b]):
      length=(rest[a]-rest[b]).length
      if length>.002:
       ratio=(posed[a]-posed[b]).length/length
       if ratio>maxstrain:maxstrain=ratio;worst={'clip':clip,'frame':frame,'rest':length,'posed':(posed[a]-posed[b]).length,'vertices':[(i,list(rest[i]),{o.vertex_groups[g.group].name:g.weight for g in o.data.vertices[i].groups}) for i in [a,b]]}
   ev.to_mesh_clear();tested+=1
 if report['id']=='woman':print('WORST',json.dumps(worst),flush=True)
 rows.append({'file':str(source.relative_to(OUT)),'poses':tested,'actions_unchanged':True,'max_waist_edge_ratio':maxstrain if report['id']=='woman' else None});print('VALIDATED',rows[-1],flush=True)
assert len(rows)==1
(OUT/'Diagnostic.json').write_text(json.dumps({'passed':True,'results':rows},indent=2))
