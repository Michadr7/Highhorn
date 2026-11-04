import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
SOURCE=ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4/Highhorn_Commoner_TOON_v4_TEST.blend'

def rear_binding(rig,arm_weight):
    o=bpy.data.objects['Shoulders']
    for v,p in zip(o.data.vertices,world_coords(o)):
        side='Left' if p[0]>0 else 'Right'
        # The rear cap overlies the sleeve that folds back during running.
        dist=((abs(p[0])-.22)/.09)**2+((p[1]-.22)/.13)**2+((p[2]-1.32)/.22)**2
        t=float(np.clip(1.6-dist,0,1));t=t*t*(3-2*t)
        if t<=0:continue
        weights={o.vertex_groups[g.group].name:g.weight*(1-t) for g in v.groups}
        weights[side+'Arm']=weights.get(side+'Arm',0)+t*arm_weight
        weights[side+'Shoulder']=weights.get(side+'Shoulder',0)+t*(1-arm_weight)
        assign(o,v.index,weights)
    bpy.context.view_layer.update()

if __name__=='__main__':
    results=[]
    for weight in [.6,.8,1.0]:
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE));rig=bpy.data.objects['Armature']
        rear_binding(rig,weight);rows=checks(rig,16)
        results.append({'arm_weight':weight,'poses':rows})
        print('TRIAL',weight,[(c,max(r['Tunic-Shoulders'] for r in rows if r['clip']==c)) for c in ['idle','walk','run']],flush=True)
    (OUT/'Rear_Binding_Trials.json').write_text(json.dumps(results,indent=2))
