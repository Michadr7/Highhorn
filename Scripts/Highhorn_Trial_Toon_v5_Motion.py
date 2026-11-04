"""Measure separate outfit-run variants without changing source actions."""
import sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Fit_Toon_v5 import *
from mathutils import Quaternion,Matrix
SOURCE=ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4/Highhorn_Commoner_TOON_v4_TEST.blend'

def fitted_run(rig,degrees):
    source=bpy.data.actions.get('Source_ToonV4_run')
    if source is None:source=bpy.data.actions['run'];source.name='Source_ToonV4_run';source.use_fake_user=True
    existing=bpy.data.actions.get('run')
    if existing:bpy.data.actions.remove(existing)
    variant=source.copy();variant.name='run';variant.use_fake_user=True
    start,end=source.frame_range;keys=[]
    for frame in range(math.floor(start),math.ceil(end)+1):
        rig.animation_data.action=source;rig.animation_data.action_slot=source.slots[0]
        bpy.context.scene.frame_set(frame);row={}
        for side,sign in [('Left',-1),('Right',1)]:
            bone=rig.pose.bones[side+'Arm']
            world=rig.matrix_world@bone.matrix
            turn=Quaternion((0,1,0),math.radians(degrees)*sign).to_matrix().to_4x4()
            bone.matrix=rig.matrix_world.inverted()@Matrix.Translation(world.translation)@turn@Matrix.Translation(-world.translation)@world
            bpy.context.view_layer.update();row[bone.name]=bone.rotation_quaternion.copy()
        keys.append((frame,row))
    rig.animation_data.action=variant;rig.animation_data.action_slot=variant.slots[0]
    for frame,row in keys:
        for name,q in row.items():
            rig.pose.bones[name].rotation_quaternion=q
            rig.pose.bones[name].keyframe_insert('rotation_quaternion',frame=frame,group=name)
    return variant

if __name__=='__main__':
    results=[]
    for degrees in [6,10,14,18]:
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE));rig=bpy.data.objects['Armature']
        boot_clearance(rig);fitted_run(rig,degrees)
        rows=checks(rig,16)
        results.append({'arm_degrees':degrees,'poses':rows})
        print('TRIAL',degrees,[(c,max(r['Tunic-Shoulders'] for r in rows if r['clip']==c),max(r['Pants-Boots'] for r in rows if r['clip']==c)) for c in ['idle','walk','run']],flush=True)
    (OUT/'Motion_Trials.json').write_text(json.dumps(results,indent=2))
