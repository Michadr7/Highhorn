import bpy,json
from mathutils import Vector
from pathlib import Path
rows=[]
for o in bpy.context.scene.objects:
    r=dict(name=o.name,type=o.type,parent=o.parent.name if o.parent else None,location=list(o.location),scale=list(o.scale),dimensions=list(o.dimensions),hide=o.hide_viewport)
    if o.type=='MESH':
        pts=[o.matrix_world @ Vector(v) for v in o.bound_box]
        r['bounds']=[[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]]
        r['vertices']=len(o.data.vertices)
    rows.append(r)
Path(globals().get('REPORT_PATH', str(Path(bpy.data.filepath).with_suffix('.inspection.json')) if bpy.data.filepath else 'Exports/FreshImports.inspection.json')).write_text(json.dumps(rows,indent=2))
print(json.dumps(rows,indent=2))
