import bpy,json,numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
rows={}
for slug in ['man','businessman','woman','elderly-man','elderly-woman']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'Exports/MedievalRoster/2026-11-01/{slug}/{slug}_MEDIEVAL_TEST.blend'))
 rig=bpy.data.objects['Roster_Armature'];rig.data.pose_position='REST';body=bpy.data.objects['Roster_Body'];source=next(o for o in bpy.context.scene.objects if o.name.startswith('SOURCE - complete'));bpy.context.view_layer.update()
 row={}
 for name in ['LeftHand','LeftFoot','LeftToeBase','Head']:
  group=source.vertex_groups.get(name);points=np.array([tuple(source.matrix_world@v.co) for v in source.data.vertices if group and any(g.group==group.index and g.weight>.7 for g in v.groups)])
  row[name]={'bounds':[[float(points[:,i].min()),float(points[:,i].max())] for i in range(3)],'count':len(points)} if len(points) else {}
 row['fingers']=[b.name for b in rig.data.bones if b.name.startswith('LeftHand')]
 rows[slug]=row
(ROOT/'Exports/MedievalRoster/2026-11-01/Hand_Feet_Inspection.json').write_text(json.dumps(rows,indent=2))
