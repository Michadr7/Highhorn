import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
D=ROOT/'Exports/StyleStudy/2026-11-03/Female_v1';D.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/MedievalRoster/2026-11-01/CommonerBoots_v8/approved-female/approved-female_BOOTS_TEST.blend'))
r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');report={'rig':r.name,'bones':len(r.data.bones),'objects':[],'actions':{a.name:action_hash(a) for a in bpy.data.actions}}
for o in bpy.context.scene.objects:
 if o.type=='MESH':report['objects'].append({'name':o.name,'verts':len(o.data.vertices),'bounds':[world_coords(o).min(0).tolist(),world_coords(o).max(0).tolist()],'materials':[m.name for m in o.data.materials]})
report['pose_position']=r.data.pose_position;report['modifiers']={n:[{'type':m.type,'rig':m.object.name if m.type=='ARMATURE' and m.object else None,'viewport':m.show_viewport} for m in bpy.data.objects[n].modifiers] for n in ['Tunic','Shoulders','Boots','Pants']};r.data.pose_position='POSE'
for t in r.animation_data.nla_tracks:t.mute=True
report['contacts']=checks(r,32)
(D/'Inspection.json').write_text(json.dumps(report,indent=2));print('FEMALE_INSPECTION',json.dumps({k:v for k,v in report.items() if k!='contacts'}),flush=True)
