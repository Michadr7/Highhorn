import sys, json, math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01/Corrections_v3'
results=[]
for meta in json.loads((OUT/'Roster_Test.json').read_text()):
 if meta.get('reference'):continue
 slug=meta['id'];path=next((OUT/slug).glob('*_TEST.blend'));bpy.ops.wm.open_mainfile(filepath=str(path))
 rig=bpy.data.objects['Roster_Armature'] if 'Roster_Armature' in bpy.data.objects else next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 actions={a.name:a for a in bpy.data.actions};report=json.loads((OUT/slug/'Wrist_Report.json').read_text())
 expected=json.loads((ROOT/'Exports/MedievalRoster/2026-11-01/Corrections_v2'/slug/'Correction_Report.json').read_text())['source_actions']
 for name,digest in expected.items():assert action_hash(actions.get('Source_'+name) or actions[name])==digest,(slug,name,'source clip changed')
 if meta['minLevel']==1:
  current=bpy.data.objects['Roster_Body'];reference=ROOT/'Exports/MedievalRoster/2026-11-01/Corrections_v2'/slug/(slug+'_CORRECTED_TEST.blend')
  with bpy.data.libraries.load(str(reference),link=False) as (available,loaded):loaded.objects=['Roster_Body']
  old=loaded.objects[0];assert len(current.data.vertices)==len(old.data.vertices),(slug,'body vertex count')
  assert all(tuple(a.co)==tuple(b.co) for a,b in zip(current.data.vertices,old.data.vertices)),(slug,'body mesh changed')
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)]
 assert len(meshes)==(5 if meta['minLevel']==1 else 1),(slug,len(meshes))
 for track in rig.animation_data.nla_tracks:track.mute=True
 rig.data.pose_position='POSE';samples=0
 for name in ['idle','walk','run']:
  action=actions[name];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for factor in [0,.25,.5,.75,1]:
   bpy.context.scene.frame_set(int(action.frame_range.x+factor*(action.frame_range.y-action.frame_range.x)));deps=bpy.context.evaluated_depsgraph_get()
   for obj in meshes:
    evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();step=max(1,len(mesh.vertices)//1200)
    indices=range(0,len(mesh.vertices),step)
    assert all(all(math.isfinite(x) for x in mesh.vertices[i].co) for i in indices),(slug,name)
    samples+=len(indices);evaluated.to_mesh_clear()
 results.append({'id':slug,'passed':True,'saved_file':str(path.relative_to(ROOT)),'meshes':len(meshes),'sampled_deformed_vertices':samples,'source_action_hashes_retained':bool(expected)})
 print('SAVED BLEND PASSED',slug,flush=True)
(OUT/'Saved_Blend_Validation.json').write_text(json.dumps({'passed':True,'results':results,'scope':'Reopened saved Blender files; visible skinned mesh counts, source action hash comparison where recorded, and finite evaluated geometry at 15 idle/walk/run poses. Not an exhaustive collision check.'},indent=2))
