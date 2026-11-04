import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/FemaleCommoner';OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'Models/CommonerSources/woman-base-character-rigged.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.data.pose_position='REST';bpy.context.view_layer.update()
body=next(o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
pts=[body.matrix_world@v.co for v in body.data.vertices]
def bounds(ps):return {'min':[min(p[i] for p in ps) for i in range(3)],'max':[max(p[i] for p in ps) for i in range(3)]}
report={'body':body.name,'rig':rig.name,'bounds':bounds(pts),'vertices':len(pts),'bones':{b.name:list(rig.matrix_world@b.head_local) for b in rig.data.bones},'clips':[a.name for a in bpy.data.actions],'cross_sections':{}}
for height in [.05,.1,.3,.6,.8,.9,1.,1.1,1.2,1.3,1.4,1.5]:
 ps=[p for p in pts if abs(p.z-height)<.015 and abs(p.x)<.23]
 if ps:report['cross_sections'][str(height)]=bounds(ps)
(OUT/'Source_Inspection.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
