"""Local measured garment fitting; original topology, UVs and rig are retained."""
import math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
import bpy

NAMES=['char1','Tunic','Pants','Boots','Shoulders']

def world_coords(obj):
    return np.array([obj.matrix_world@v.co for v in obj.data.vertices])

def surface(obj):
    e=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh()
    p=[e.matrix_world@v.co for v in m.vertices];faces=[tuple(f.vertices) for f in m.polygons]
    e.to_mesh_clear()
    return p,faces,BVHTree.FromPolygons(p,faces)

def pose(rig,clip,frac):
    a=bpy.data.actions[clip];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
    f=a.frame_range[0]+frac*(a.frame_range[1]-a.frame_range[0]);bpy.context.scene.frame_set(math.floor(f),subframe=f%1)

def intersections():
    result={}
    for a,b in [('Tunic','Shoulders'),('Pants','Boots')]:
        _,_,ta=surface(bpy.data.objects[a]);_,_,tb=surface(bpy.data.objects[b])
        result[a+'-'+b]=len(ta.overlap(tb))
    return result

def fit_legs(rig):
    rig.data.pose_position='REST';bpy.context.view_layer.update()
    report={}
    for name in ['Pants','Boots']:
        o=bpy.data.objects[name];original=world_coords(o);changed=original.copy()
        for side,sign in [('Left',1),('Right',-1)]:
            ankle=np.array(rig.matrix_world@rig.data.bones[side+'Foot'].head_local)
            knee=np.array(rig.matrix_world@rig.data.bones[side+'Leg'].head_local)
            levels=np.arange(.17,.411,.01);centers=[]
            for z in levels:
                s=original[(original[:,0]*sign>0)&(abs(original[:,2]-z)<.018)]
                if len(s):centers.append((z,(s.min(0)+s.max(0))*.5))
            for i,p in enumerate(original):
                if p[0]*sign<=0:continue
                z=p[2]
                if name=='Pants':
                    t=np.clip((.43-z)/.18,0,1)
                else:
                    t=np.clip((z-.15)/.075,0,1)
                t=t*t*(3-2*t)
                if t==0:continue
                center=np.array([np.interp(z,[a for a,_ in centers],[c[k] for _,c in centers]) for k in range(3)])
                axis=ankle+(knee-ankle)*(z-ankle[2])/(knee[2]-ankle[2])
                changed[i,:2]+=(axis[:2]-center[:2])*t
        inv=o.matrix_world.inverted()
        for v,p in zip(o.data.vertices,changed):v.co=inv@Vector(p)
        o.data.update()
        delta=np.linalg.norm(changed-original,axis=1)
        report[name]={'moved_vertices':int((delta>1e-7).sum()),'maximum_m':float(delta.max()),'foot_geometry_below_015m_unchanged':bool(np.all(changed[original[:,2]<.15]==original[original[:,2]<.15]))}
    return report

def fit_shoulders(rig):
    o=bpy.data.objects['Shoulders'];original=world_coords(o);offset=np.zeros_like(original)
    rig.data.pose_position='REST';bpy.context.view_layer.update()
    tunic=bpy.data.objects['Tunic'];tunic.data.calc_loop_triangles()
    tp=[tunic.matrix_world@v.co for v in tunic.data.vertices]
    triangles=[tuple(t.vertices) for t in tunic.data.loop_triangles]
    tree=BVHTree.FromPolygons(tp,triangles,all_triangles=True)
    reweighted=0
    for v,p in zip(o.data.vertices,original):
        q,normal,fi,d=tree.find_nearest(Vector(p))
        if d>.065:continue
        ids=triangles[fi];a,b,c=[np.array(tp[i]) for i in ids]
        uv=np.linalg.lstsq(np.column_stack([b-a,c-a]),np.array(q)-a,rcond=None)[0]
        bary=np.maximum([1-uv.sum(),uv[0],uv[1]],0);bary/=sum(bary)
        weights={}
        for vi,w in zip(ids,bary):
            for g in tunic.data.vertices[vi].groups:
                name=tunic.vertex_groups[g.group].name;weights[name]=weights.get(name,0)+g.weight*w
        for g in list(v.groups):o.vertex_groups[g.group].remove([v.index])
        strongest=sorted(weights.items(),key=lambda a:-a[1])[:4];total=sum(w for _,w in strongest)
        for name,w in strongest:
            group=o.vertex_groups.get(name) or o.vertex_groups.new(name=name)
            group.add([v.index],float(w/total),'REPLACE')
        reweighted+=1
    inv=o.matrix_world.inverted();neighbors=[set() for _ in original]
    for e in o.data.edges:
        a,b=e.vertices;neighbors[a].add(b);neighbors[b].add(a)
    kd=KDTree(len(original))
    for i,p in enumerate(original):kd.insert(Vector(p),i)
    kd.balance()
    spatial=[[(j,math.exp(-(d/.018)**2)) for _,j,d in kd.find_range(Vector(p),.035)] for p in original]
    rig.data.pose_position='POSE'
    for t in rig.animation_data.nla_tracks:t.mute=True
    samples=[(clip,f) for clip in ['idle','walk'] for f in [0,.125,.25,.375,.5,.625,.75,.875]]
    # Use the actual torso/upper-arm axes to find the outer cloth envelope.
    # Fold normals can face inward; moving along them creates local spikes.
    axes=[]
    for a,b in [('Spine01','neck'),('LeftArm','LeftForeArm'),('RightArm','RightForeArm')]:
        axes.append((np.array(rig.matrix_world@rig.data.bones[a].head_local),np.array(rig.matrix_world@rig.data.bones[b].head_local)))
    directions=[]
    for p in original:
        candidates=[]
        for a,b in axes:
            t=np.clip(np.dot(p-a,b-a)/np.dot(b-a,b-a),0,1);candidates.append(a+t*(b-a))
        center=min(candidates,key=lambda q:np.linalg.norm(p-q));d=p-center;directions.append(d/np.linalg.norm(d))
    directions=np.array(directions)
    directions=np.array([sum((directions[j]*w for j,w in ns),np.zeros(3))/sum(w for _,w in ns) for ns in spatial])
    directions/=np.linalg.norm(directions,axis=1)[:,None]
    scalar=np.zeros(len(original));history=[]
    for iteration in range(5):
        required=np.zeros(len(original))
        for clip,f in samples:
            pose(rig,clip,f)
            points,_,_=surface(o);_,_,tree=surface(bpy.data.objects['Tunic'])
            bone_maps={g.index:(rig.matrix_world@(rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted())@rig.matrix_world.inverted()).to_3x3() for g in o.vertex_groups if g.name in rig.pose.bones}
            for i,v in enumerate(o.data.vertices):
                direction=Vector((0,0,0))
                for g in v.groups:
                    if g.group in bone_maps:direction+=(bone_maps[g.group]@Vector(directions[i]))*g.weight
                scale=direction.length;direction.normalize();start=points[i]-direction*.055;traveled=0;outer=-1
                for _ in range(12):
                    q,n,fi,d=tree.ray_cast(start,direction,.1-traveled)
                    if q is None:break
                    traveled+=d;outer=max(outer,traveled);start=q+direction*.0001;traveled+=.0001
                    if traveled>=.1:break
                if outer>=0:required[i]=max(required[i],(outer-.055+.008)/scale)
        grown=np.array([max((required[j]*math.exp(-(d/.016)**2) for _,j,d in kd.find_range(Vector(p),.025)),default=0) for p in original])
        # Blur the increment, not accumulated clearance. Recheck all samples
        # after each iteration to satisfy local envelopes without sharp peaks.
        grown=np.array([sum(grown[j]*w for j,w in ns)/sum(w for _,w in ns) for ns in spatial])
        scalar=np.minimum(.03,scalar+np.maximum(grown,0))
        offset=directions*scalar[:,None]
        for v,p in zip(o.data.vertices,original+offset):v.co=inv@Vector(p)
        o.data.update();bpy.context.view_layer.update()
        pose(rig,'idle',0);history.append({'iteration':iteration,'intersections':intersections()})
        print('FIT ITERATION',history[-1],flush=True)
    final=world_coords(o)-original
    return {'history':history,'reweighted_vertices':reweighted,'changed_vertices':int((np.linalg.norm(final,axis=1)>1e-7).sum()),'max_offset_m':float(np.linalg.norm(final,axis=1).max()),'fit_scope':'Idle/walk envelope with 3 cm limit to preserve silhouette; run evaluated separately, not forced into a bulky static fit.'}

def fit(rig):
    result={'legs':fit_legs(rig)}
    # The shaft is an inner layer: fit its actual surface inside the trouser
    # envelope at each height, leaving the measured shoe footprint intact.
    boot=bpy.data.objects['Boots'];pants=bpy.data.objects['Pants']
    _,_,ptree=surface(pants);original=world_coords(boot);inv=boot.matrix_world.inverted();count=0
    for v,p in zip(boot.data.vertices,original):
        if p[2]<.175:continue
        side='Left' if p[0]>0 else 'Right'
        a=np.array(rig.matrix_world@rig.data.bones[side+'Foot'].head_local)
        b=np.array(rig.matrix_world@rig.data.bones[side+'Leg'].head_local)
        center=a+(b-a)*(p[2]-a[2])/(b[2]-a[2]);direction=p-center;direction[2]=0
        radius=np.linalg.norm(direction)
        if radius<1e-6:continue
        direction/=radius
        hit,_,_,distance=ptree.ray_cast(Vector(center),Vector(direction),.3)
        if hit is not None and radius>distance-.014:
            v.co=inv@Vector(center+direction*max(.02,distance-.014));count+=1
    boot.data.update();bpy.context.view_layer.update();result['boot_shaft_clearance_vertices']=count
    result.update(shoulders=fit_shoulders(rig),poses=[])
    for clip in ['idle','walk','run']:
        for f in [0,.125,.25,.375,.5,.625,.75,.875]:
            pose(rig,clip,f);result['poses'].append({'clip':clip,'fraction':f,**intersections()})
    pose(rig,'idle',0)
    return result
