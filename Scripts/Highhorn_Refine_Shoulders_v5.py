"""Pose-driven shoulder cloth clearance, retaining all bone animation keys."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *

def activity(rig,side):
    a=rig.matrix_world@rig.pose.bones[side+'Arm'].head;b=rig.matrix_world@rig.pose.bones[side+'ForeArm'].head
    t=float(np.clip((b.y-a.y-.10)/.12,0,1))
    return t*t*(3-2*t)

def set_values(rig):
    keys=bpy.data.objects['Shoulders'].data.shape_keys.key_blocks
    for side in ['Left','Right']:keys[side+' backswing clearance'].value=activity(rig,side)
    bpy.context.view_layer.update()

def correctives(rig):
    o=bpy.data.objects['Shoulders'];original=world_coords(o);inv=o.matrix_world.inverted()
    keys={side:o.data.shape_keys.key_blocks[side+' backswing clearance'] for side in ['Left','Right']}
    for key in keys.values():key.driver_remove('value')
    kd=KDTree(len(original))
    for i,p in enumerate(original):kd.insert(Vector(p),i)
    kd.balance()
    ns=[[(j,math.exp(-(d/.018)**2)) for _,j,d in kd.find_range(Vector(p),.036)] for p in original]
    support=np.array([float(np.clip((p[1]-.09)/.06,0,1))*float(np.clip((abs(p[0])-.08)/.07,0,1)) for p in original])
    offsets={side:np.array([o.matrix_world@v.co for v in key.data])-original for side,key in keys.items()};history=[]
    for it in range(10):
        changes={side:np.zeros_like(original) for side in keys};sizes={side:np.zeros(len(original)) for side in keys}
        for f in sorted(set([i/32 for i in range(32)]+[8/96,16/96,34/96,35/96,82/96])):
            pose(rig,'run',f);set_values(rig);points,outer_faces,outer_tree=surface(o);inner,inner_faces,tree=surface(bpy.data.objects['Tunic'])
            maps={g.index:np.array((rig.matrix_world@rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted()@rig.matrix_world.inverted()).to_3x3()) for g in o.vertex_groups if g.name in rig.pose.bones}
            axes=[]
            for a,b in [('Spine01','neck'),('LeftArm','LeftForeArm'),('RightArm','RightForeArm')]:axes.append((np.array(rig.matrix_world@rig.pose.bones[a].head),np.array(rig.matrix_world@rig.pose.bones[b].head)))
            for i,v in enumerate(o.data.vertices):
                side='Left' if original[i,0]>0 else 'Right';weight=keys[side].value
                if support[i]<.001 or weight<.05:continue
                p=np.array(points[i]);centers=[a+np.clip(np.dot(p-a,b-a)/np.dot(b-a,b-a),0,1)*(b-a) for a,b in axes]
                center=min(centers,key=lambda c:np.linalg.norm(p-c));direction=Vector(p-center).normalized()
                start=points[i]-direction*.08;traveled=0;outer=-1
                for _ in range(16):
                    q,n,fi,d=tree.ray_cast(start,direction,.18-traveled)
                    if q is None:break
                    traveled+=d;outer=max(outer,traveled);start=q+direction*.0001;traveled+=.0001
                    if traveled>=.18:break
                amount=max(0,outer-.08+.007) if outer>=0 else 0
                if amount<=0:continue
                matrix=sum((maps[g.group]*g.weight for g in v.groups if g.group in maps),np.zeros((3,3)))
                change=np.linalg.solve(matrix,np.array(direction)*min(.012,amount))/max(.15,weight)
                size=np.linalg.norm(change)
                if size>sizes[side][i]:changes[side][i]=change;sizes[side][i]=size
            # Vertex rays miss crossings through a triangle's interior. Add
            # contact-plane constraints for those remaining intersecting faces.
            for fi,fj in tree.overlap(outer_tree):
                tri=np.array([inner[i] for i in inner_faces[fi]]);center=tri.mean(0)
                n=np.cross(tri[1]-tri[0],tri[2]-tri[0]);length=np.linalg.norm(n)
                if length<1e-10:continue
                n/=length
                centers=[a+np.clip(np.dot(center-a,b-a)/np.dot(b-a,b-a),0,1)*(b-a) for a,b in axes]
                axis=min(centers,key=lambda c:np.linalg.norm(center-c))
                if np.dot(n,center-axis)<0:n=-n
                # Avoid a sharp fold normal pointing tangentially across cloth.
                radial=center-axis;radial/=np.linalg.norm(radial);n=n*.5+radial*.5;n/=np.linalg.norm(n)
                for i in outer_faces[fj]:
                    side='Left' if original[i,0]>0 else 'Right';weight=keys[side].value
                    if weight<.05 or support[i]<.001:continue
                    depth=.008-np.dot(np.array(points[i])-center,n)
                    if depth<=0:continue
                    v=o.data.vertices[i];matrix=sum((maps[g.group]*g.weight for g in v.groups if g.group in maps),np.zeros((3,3)))
                    change=np.linalg.solve(matrix,n*min(.009,depth))/max(.15,weight);size=np.linalg.norm(change)
                    if size>sizes[side][i]:changes[side][i]=change;sizes[side][i]=size
        for side,key in keys.items():
            change=changes[side]
            smooth=np.array([sum((change[j]*w for j,w in near),np.zeros(3))/sum(w for _,w in near) for near in ns])
            offsets[side]+=smooth*support[:,None]
            length=np.linalg.norm(offsets[side],axis=1);offsets[side]*=np.minimum(1,.10/np.maximum(length,1e-9))[:,None]
            for v,p in zip(key.data,original+offsets[side]):v.co=inv@Vector(p)
        o.data.update();bpy.context.view_layer.update();rows=[]
        for f in sorted(set([i/32 for i in range(32)]+[8/96,16/96,34/96,35/96,82/96])):
            pose(rig,'run',f);set_values(rig);rows.append(intersections())
        peak=max(r['Tunic-Shoulders'] for r in rows);history.append({'iteration':it,'shoulder_contact_max':peak,'offset_max_m':max(float(np.linalg.norm(d,axis=1).max()) for d in offsets.values())})
        print('CORRECTIVE',history[-1],flush=True)
        if peak==0:break
    # Transform variables use the actual upper-arm displacement in world units.
    for side,key in keys.items():
        driver=key.driver_add('value').driver
        for name,bone in [('a',side+'Arm'),('b',side+'ForeArm')]:
            var=driver.variables.new();var.name=name;var.type='TRANSFORMS';target=var.targets[0];target.id=rig;target.bone_target=bone;target.transform_type='LOC_Y';target.transform_space='WORLD_SPACE'
        t='min(1,max(0,(b-a-0.10)/0.12))';driver.expression=f'({t})*({t})*(3-2*({t}))'
    return history

if __name__=='__main__':
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'Knee_Fold_Trial.blend'))
    rig=bpy.data.objects['Armature'];report={'refinement':correctives(rig),'poses':checks(rig,96)}
    (OUT/'Final_Fit.json').write_text(json.dumps(report,indent=2));pose(rig,'idle',0)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Final_Fit.blend'),compress=True)
