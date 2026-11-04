import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'Exports/MedievalRoster/2026-11-01/Corrections_v2';rows={}
for slug in ['man','businessman','woman','elderly-man','elderly-woman']:
 bpy.ops.wm.open_mainfile(filepath=str(OUT/slug/(slug+'_CORRECTED_TEST.blend')));rig=bpy.data.objects['Roster_Armature'];rig.data.pose_position='REST';bpy.context.view_layer.update();tunic=bpy.data.objects['Tunic'];body=bpy.data.objects['Roster_Body'];w=rig.matrix_world@rig.data.bones['LeftHand'].head_local;e=rig.matrix_world@rig.data.bones['LeftForeArm'].head_local;axis=(w-e).normalized();bins=[]
 for lo,hi in [(-.16,-.10),(-.10,-.05),(-.05,0),(0,.04),(.04,.08)]:
  points=[];weights=[]
  for v in tunic.data.vertices:
   p=tunic.matrix_world@v.co;u=(p-w).dot(axis);r=p-w-axis*u
   if lo<=u<hi and r.length<.20:
    points.append(r.length);weights.append(sum(g.weight for g in v.groups if tunic.vertex_groups[g.group].name.startswith('LeftHand')))
  bins.append({'range':[lo,hi],'count':len(points),'min_radius':min(points) if points else None,'max_radius':max(points) if points else None,'hand_weight_mean':sum(weights)/len(weights) if weights else None})
 rows[slug]={'left_wrist':list(w),'sleeve_bins':bins}
(OUT/'Wrist_Inspection.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows),flush=True)
