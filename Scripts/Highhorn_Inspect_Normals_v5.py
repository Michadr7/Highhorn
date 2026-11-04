import bpy,numpy as np,json
bpy.ops.wm.open_mainfile(filepath=r'C:\Users\Michael\Documents\Projects\Highhorn\Exports\StyleStudy\2026-11-03\Toon_v5\Highhorn_Commoner_TOON_v5_TEST.blend')
for name in ['Tunic','Shoulders','Boots','Pants']:
 m=bpy.data.objects[name].data;normals=np.array([n.vector for n in m.corner_normals]);errors=np.array([max(np.linalg.norm(normals[i]-normals[p.loop_start]) for i in p.loop_indices) for p in m.polygons]);print('NORMAL_ERROR',name,np.quantile(errors,[0,.5,.9,.99,1]).tolist(),sum(errors>.002),len(errors),sum(e.use_edge_sharp for e in m.edges),len(m.edges),flush=True)
