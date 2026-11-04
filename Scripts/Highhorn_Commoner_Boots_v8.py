"""Resize real Commoner boot meshes from measured ankle/toe landmarks."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
BASE=ROOT/'Exports/MedievalRoster/2026-11-01';OUT=BASE/'CommonerBoots_v8';OUT.mkdir(exist_ok=True)
SOURCES={'approved-male':ROOT/'Exports/HeroPhase2/ClippingFix/Highhorn_Commoner_IDLE_CLEARANCE_TEST.blend','approved-female':ROOT/'Exports/FemaleCommoner/Highhorn_Female_Commoner_TEST.blend'}

def fit(rig,boot):
 rig.data.pose_position='REST';bpy.context.view_layer.update();boot.data=boot.data.copy();old=[boot.matrix_world@v.co for v in boot.data.vertices];inv=boot.matrix_world.inverted();up=Vector((0,0,1));landmarks={};rows={}
 for side,sign in [('Left',1),('Right',-1)]:
  ankle=rig.matrix_world@rig.data.bones[side+'Foot'].head_local;toe=rig.matrix_world@rig.data.bones[side+'ToeBase'].head_local;direction=toe-ankle;direction.z=0;landmarks[side]=(sign,ankle,direction.normalized(),direction.length)
 length=sum(row[3] for row in landmarks.values())/2+.150;width=length*.44
 for side,(sign,ankle,forward,span) in landmarks.items():
  ids=[i for i,p in enumerate(old) if p.x*sign>0 and p.z<ankle.z+.035];lo=Vector([min(old[i][a] for i in ids) for a in range(3)]);hi=Vector([max(old[i][a] for i in ids) for a in range(3)]);center=(lo+hi)*.5;target=ankle+forward*(length*.5-.055);right=up.cross(forward).normalized();changed=0
  for v,p in zip(boot.data.vertices,old):
   if p.x*sign<=0:continue
   t=max(0,min(1,(ankle.z+.140-p.z)/.105));blend=t*t*(3-2*t)
   if blend==0:continue
   q=target+right*((p.x-center.x)*width/(hi.x-lo.x))-forward*((p.y-center.y)*length/(hi.y-lo.y));q.z=p.z;v.co=inv@p.lerp(q,blend);changed+=1
  rows[side]={'ankle_world':list(ankle),'toe_joint_world':list(ankle+forward*span),'ankle_to_toe_joint_m':span,'old_sole_length_m':hi.y-lo.y,'old_sole_width_m':hi.x-lo.x,'target_sole_length_m':length,'target_sole_width_m':width,'modified_vertices':changed,'upper_shaft_unchanged_above_z':ankle.z+.140}
 boot.data.update();return rows

ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SOURCES)
for slug in ids:
 for variant in ['original','warm-medium','deep-warm']:
  source=SOURCES[slug] if variant=='original' else BASE/slug/'Appearance'/variant/(slug+'_'+variant+'_TEST.blend');rel=Path(slug) if variant=='original' else Path(slug)/'Appearance'/variant;dest=OUT/rel;dest.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(source));boot=bpy.data.objects['Boots'];rig=next(m.object for m in boot.modifiers if m.type=='ARMATURE');hashes={n:action_hash(bpy.data.actions[n]) for n in ['idle','walk','run']};report={'id':slug,'tone':variant,'source_blend':str(source),'boots':fit(rig,boot),'actions_unchanged':hashes};rig.data.pose_position='POSE';rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];bpy.context.scene.frame_set(0);body=bpy.data.objects.get('Female_Body') or bpy.data.objects.get('char1');assert body
  meshes=[body]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']];bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_BOOTS_TEST.blend')),compress=True);export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression');assert hashes=={n:action_hash(bpy.data.actions[n]) for n in hashes};(dest/'Fit_Report.json').write_text(json.dumps(report,indent=2));print('BOOT FIT SAVED',slug,variant,flush=True)
