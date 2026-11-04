"""Reversible V5 binding, clearance and per-face broad normals."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
from Highhorn_Fit_Toon_v4 import world_coords,surface,pose,intersections
from mathutils.kdtree import KDTree

OUT=ROOT/'Exports/StyleStudy/2026-11-03/Toon_v5'

def assign(obj,vi,weights):
    for g in list(obj.data.vertices[vi].groups):obj.vertex_groups[g.group].remove([vi])
    items=sorted(weights.items(),key=lambda x:-x[1])[:4];total=sum(w for _,w in items)
    for name,w in items:
        group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
        if w>1e-7:group.add([vi],float(w/total),'REPLACE')

def rebind(rig):
    rig.data.pose_position='REST';bpy.context.view_layer.update()
    tunic=bpy.data.objects['Tunic'];shoulder=bpy.data.objects['Shoulders'];_,get=tree_and_weights(tunic)
    count=0
    for v,p in zip(shoulder.data.vertices,world_coords(shoulder)):
        assign(shoulder,v.index,get(Vector(p)));count+=1
    pants=bpy.data.objects['Pants'];legcount=0
    for v,p in zip(pants.data.vertices,world_coords(pants)):
        t=float(np.clip((.48-p[2])/.12,0,1));t=t*t*(3-2*t)
        if t<=0:continue
        weights={pants.vertex_groups[g.group].name:g.weight*(1-t) for g in v.groups}
        name=('Left' if p[0]>0 else 'Right')+'Leg';weights[name]=weights.get(name,0)+t
        assign(pants,v.index,weights);legcount+=1
    rig.data.pose_position='POSE';bpy.context.view_layer.update()
    return {'shoulder_vertices':count,'calf_vertices':legcount}

def checks(rig,steps=16):
    rows=[]
    for clip in ['idle','walk','run']:
        for i in range(steps):
            pose(rig,clip,i/steps);rows.append({'clip':clip,'fraction':i/steps,**intersections()})
    return rows

def refine_layers(rig):
    # Solve on the covered inner cloth. Each correction comes from an actual
    # intersecting posed triangle, then returns through its skinning matrix.
    tunic=bpy.data.objects['Tunic'];original=world_coords(tunic);inv=tunic.matrix_world.inverted()
    kd=KDTree(len(original))
    for i,p in enumerate(original):kd.insert(Vector(p),i)
    kd.balance()
    neighbors=[[(j,math.exp(-(d/.016)**2)) for _,j,d in kd.find_range(Vector(p),.032)] for p in original]
    history=[]
    for iteration in range(12):
        delta=np.zeros_like(original);strength=np.zeros(len(original))
        for clip in ['idle','walk','run']:
            for f in [i/16 for i in range(16)]:
                pose(rig,clip,f)
                a,fa,ta=surface(tunic);b,fb,tb=surface(bpy.data.objects['Shoulders']);pairs=ta.overlap(tb)
                if not pairs:continue
                maps={g.index:np.array((rig.matrix_world@rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted()@rig.matrix_world.inverted()).to_3x3()) for g in tunic.vertex_groups if g.name in rig.pose.bones}
                torso=np.array(rig.matrix_world@rig.pose.bones['Spine02'].head)
                for fi,fj in pairs:
                    outer=np.array([b[i] for i in fb[fj]]);center=outer.mean(0)
                    n=np.cross(outer[1]-outer[0],outer[2]-outer[0]);length=np.linalg.norm(n)
                    if length<1e-10:continue
                    n/=length
                    if np.dot(n,center-torso)<0:n=-n
                    for vi in fa[fi]:
                        penetration=np.dot(np.array(a[vi])-center,n)
                        amount=min(.008,max(0,penetration+.003))
                        if amount<=0:continue
                        v=tunic.data.vertices[vi];matrix=sum((maps[g.group]*g.weight for g in v.groups if g.group in maps),np.zeros((3,3)))
                        change=np.linalg.solve(matrix,-n*amount)
                        if amount>strength[vi]:delta[vi]=change;strength[vi]=amount
        expanded=np.zeros_like(delta)
        for i,ns in enumerate(neighbors):
            active=[(j,w) for j,w in ns if strength[j]>0]
            if active:
                total=sum(w for _,w in active);expanded[i]=sum((delta[j]*w for j,w in active),np.zeros(3))/total*min(1,total/4)
        target=world_coords(tunic)+expanded;offset=target-original
        length=np.linalg.norm(offset,axis=1);offset*=np.minimum(1,.025/np.maximum(length,1e-9))[:,None]
        for v,p in zip(tunic.data.vertices,original+offset):v.co=inv@Vector(p)
        tunic.data.update();bpy.context.view_layer.update()
        rows=checks(rig,8);peak=max(r['Tunic-Shoulders'] for r in rows)
        history.append({'iteration':iteration,'shoulder_contact_max':peak,'max_inner_offset':float(np.linalg.norm(offset,axis=1).max())})
        print('INNER FIT',history[-1],flush=True)
        if peak==0:break
    return history

def boot_clearance(rig):
    rig.data.pose_position='REST';bpy.context.view_layer.update()
    o=bpy.data.objects['Boots'];original=world_coords(o);inv=o.matrix_world.inverted();changed=original.copy()
    for i,p in enumerate(original):
        if p[2]<=.16:continue
        side='Left' if p[0]>0 else 'Right';a=np.array(rig.matrix_world@rig.data.bones[side+'Foot'].head_local);b=np.array(rig.matrix_world@rig.data.bones[side+'Leg'].head_local)
        center=a+(b-a)*(p[2]-a[2])/(b[2]-a[2]);t=float(np.clip((p[2]-.16)/.04,0,1));t=t*t*(3-2*t)
        changed[i,:2]=center[:2]+(p[:2]-center[:2])*(1-.18*t)
        if p[2]>.20:changed[i,2]=.20+(p[2]-.20)*.35
    for v,p in zip(o.data.vertices,changed):v.co=inv@Vector(p)
    o.data.update();rig.data.pose_position='POSE';bpy.context.view_layer.update()
    return {'max_offset_m':float(np.linalg.norm(changed-original,axis=1).max())}

def inspect_weights():
    for name in ['Pants','Tunic','Shoulders']:
        o=bpy.data.objects[name];points=world_coords(o);weights={};n=0
        for v,p in zip(o.data.vertices,points):
            if (name=='Pants' and p[2]<.35) or (name!='Pants' and p[1]>.18 and abs(p[0])>.16 and p[2]<1.45):
                n+=1
                for g in v.groups:
                    k=o.vertex_groups[g.group].name;weights[k]=weights.get(k,0)+g.weight
        print('REGION WEIGHTS',name,n,{k:round(w/max(n,1),3) for k,w in weights.items()},flush=True)

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4/Highhorn_Commoner_TOON_v4_TEST.blend'))
    rig=bpy.data.objects['Armature'];inspect_weights();report={'boots':boot_clearance(rig),'inner_fit':refine_layers(rig),'poses':checks(rig)}
    (OUT/'Binding_Trial.json').write_text(json.dumps(report,indent=2))
    print('BINDING TRIAL',[(c,max(r['Tunic-Shoulders'] for r in report['poses'] if r['clip']==c),max(r['Pants-Boots'] for r in report['poses'] if r['clip']==c)) for c in ['idle','walk','run']],flush=True)
    pose(rig,'idle',0);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Binding_Trial.blend'),compress=True)
