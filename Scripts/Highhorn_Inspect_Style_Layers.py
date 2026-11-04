import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/StyleStudy/2026-11-02/Highhorn_Commoner_STYLE_TEST.blend'));r=bpy.data.objects['Armature'];r.animation_data.action=bpy.data.actions['idle'];r.animation_data.action_slot=r.animation_data.action.slots[0];bpy.context.scene.frame_set(0);deps=bpy.context.evaluated_depsgraph_get();t=bpy.data.objects['Tunic'].evaluated_get(deps);tm=t.to_mesh();tree=BVHTree.FromPolygons([t.matrix_world@v.co for v in tm.vertices],[tuple(f.vertices) for f in tm.polygons]);s=bpy.data.objects['Shoulders'].evaluated_get(deps);sm=s.to_mesh();dist=[tree.find_nearest(s.matrix_world@v.co)[3] for v in sm.vertices];print('LAYER DISTANCES',len(dist),np.quantile(dist,[0,.1,.25,.5,.75,1]).tolist(),sum(d<.0001 for d in dist),sum(d<.002 for d in dist),flush=True)
