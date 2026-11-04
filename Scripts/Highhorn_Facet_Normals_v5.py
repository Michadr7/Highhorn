"""Broaden normals spatially, assigning one normal to each cloth facet."""
import math
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

def broad_facets(obj,radius):
    mesh=obj.data;mesh.update()
    centers=np.array([obj.matrix_world@p.center for p in mesh.polygons]);normals=np.array([p.normal for p in mesh.polygons]);areas=np.array([p.area for p in mesh.polygons])
    kd=KDTree(len(centers))
    for i,p in enumerate(centers):kd.insert(Vector(p),i)
    kd.balance();result=[];angles=[]
    for i,p in enumerate(centers):
        n=normals[i];total=np.zeros(3)
        for _,j,d in kd.find_range(Vector(p),radius):
            alignment=float(np.dot(n,normals[j]))
            if alignment<.45:continue
            total+=normals[j]*areas[j]*math.exp(-(d/(radius*.6))**2)*alignment**2
        if np.linalg.norm(total)<1e-12:total=n.copy()
        total/=np.linalg.norm(total);result.append(total);angles.append(math.degrees(math.acos(float(np.clip(np.dot(total,n),-1,1)))))
    loops=np.zeros((len(mesh.loops),3),dtype=np.float32)
    for face,n in zip(mesh.polygons,result):
        face.use_smooth=True
        for i in face.loop_indices:loops[i]=n
    for edge in mesh.edges:edge.use_edge_sharp=True
    mesh.normals_split_custom_set(loops.tolist());mesh.update()
    # Near-degenerate source polygons have unstable custom-normal tangent frames.
    # Retain their geometric facet normal instead of an unstable broad normal.
    fallback=[]
    for face in mesh.polygons:
        ns=[Vector(mesh.corner_normals[i].vector) for i in face.loop_indices]
        if max((n-ns[0]).length for n in ns)>.01:
            fallback.append(face.index)
            for i in face.loop_indices:loops[i]=(0,0,0)
    if fallback:
        mesh.normals_split_custom_set(loops.tolist())
        for index in fallback:mesh.polygons[index].use_smooth=False
        mesh.update()
    obj['highhorn_facet_normals']='One spatially averaged normal per polygon; geometric facets retained.'
    return {'geometric_normal_fallback_polygons':fallback,'radius_m':radius,'polygons':len(mesh.polygons),'mean_normal_change_degrees':float(np.mean(angles)),'max_normal_change_degrees':float(max(angles))}
