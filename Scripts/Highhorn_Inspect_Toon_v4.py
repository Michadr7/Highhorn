"""Measure actual garment geometry before the fourth style-study fit pass."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4'
OUT.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT.parent/'Toon_v3/Highhorn_Commoner_TOON_v3_TEST.blend'))
rig=bpy.data.objects['Armature']; rig.data.pose_position='REST'
bpy.context.view_layer.update()
names=['char1','Tunic','Pants','Boots','Shoulders']
report={'objects':{},'bones':{},'slices':{},'poses':[]}
for b in rig.data.bones:
    report['bones'][b.name]={'head':list(rig.matrix_world@b.head_local),'tail':list(rig.matrix_world@b.tail_local)}
for name in names:
    o=bpy.data.objects[name]; p=np.array([o.matrix_world@v.co for v in o.data.vertices]); edge_count={}
    for f in o.data.polygons:
        ids=list(f.vertices)
        for a,b in zip(ids,ids[1:]+ids[:1]):
            key=tuple(sorted([a,b]));edge_count[key]=edge_count.get(key,0)+1
    boundary=[e for e,n in edge_count.items() if n==1]
    report['objects'][name]={'vertices':len(p),'bounds':[p.min(0).tolist(),p.max(0).tolist()], 'matrix':[list(row) for row in o.matrix_world], 'boundary_edges':len(boundary),'nonmanifold_edges':sum(n>2 for n in edge_count.values()),'modifiers':[(m.name,m.type) for m in o.modifiers]}
    if name in ['Pants','Boots']:
        report['slices'][name]={}
        for z in np.arange(.10,.61,.05):
            s=p[(p[:,0]>0)&(abs(p[:,2]-z)<.015)]
            if len(s):report['slices'][name][round(z,2)]={'count':len(s),'min':s.min(0).tolist(),'max':s.max(0).tolist(),'center':((s.min(0)+s.max(0))/2).tolist()}
    if name=='Shoulders':
        report['objects'][name]['boundary_bounds']=[p[list(set(i for e in boundary for i in e))].min(0).tolist(),p[list(set(i for e in boundary for i in e))].max(0).tolist()] if boundary else []
def evaluated(name):
    o=bpy.data.objects[name].evaluated_get(bpy.context.evaluated_depsgraph_get());m=o.to_mesh()
    p=[o.matrix_world@v.co for v in m.vertices];f=[tuple(f.vertices) for f in m.polygons];o.to_mesh_clear()
    return p,f,BVHTree.FromPolygons(p,f)
rig.data.pose_position='POSE'
for t in rig.animation_data.nla_tracks:t.mute=True
for clip in ['idle','walk','run']:
    a=bpy.data.actions[clip];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
    for frac in [0,.25,.5,.75]:
        frame=a.frame_range[0]+frac*(a.frame_range[1]-a.frame_range[0]);bpy.context.scene.frame_set(int(frame),subframe=frame%1)
        t,tf,tree=evaluated('Tunic');s,sf,stree=evaluated('Shoulders')
        pairs=tree.overlap(stree)
        row={'clip':clip,'fraction':frac,'shoulder_tunic_intersecting_tri_pairs':len(pairs)}
        if pairs:
            ids=set(i for _,fi in pairs for i in sf[fi]);pts=np.array([s[i] for i in ids]);row['intersection_bounds']=[pts.min(0).tolist(),pts.max(0).tolist()]
        report['poses'].append(row)
(OUT/'Inspection_Before.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
