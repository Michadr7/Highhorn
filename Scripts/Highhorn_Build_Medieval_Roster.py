"""Fit real long-sleeved medieval garments to five whole modern characters."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
CONFIG={'man':('Villager','male'),'businessman':('Townsman','male'),'woman':('Townswoman','female'),'elderly-man':('Village Elder (Male)','male'),'elderly-woman':('Village Elder (Female)','female')}
OUT=ROOT/'Exports/MedievalRoster/2026-11-01';OUT.mkdir(parents=True,exist_ok=True)
ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(CONFIG)
for slug in ids:
 label,sex=CONFIG[slug];dest=OUT/slug;dest.mkdir(exist_ok=True)
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/GameReady/Highhorn_Male_Commoner_EXPORT.blend'))
 scene=bpy.context.scene;oldrig=bpy.data.objects['Armature'];oldrig.data.pose_position='REST';garments=[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']]
 male_neck=(oldrig.matrix_world@oldrig.data.bones['neck'].head_local).z;male_hip_y=(oldrig.matrix_world@oldrig.data.bones['Hips'].head_local).y
 male_span=(oldrig.matrix_world@oldrig.data.bones['LeftArm'].head_local).x-(oldrig.matrix_world@oldrig.data.bones['RightArm'].head_local).x
 source_arms={side:((oldrig.matrix_world@oldrig.data.bones[side+'Arm'].head_local),(oldrig.matrix_world@oldrig.data.bones[side+'ForeArm'].head_local)) for side in ['Left','Right']}
 for o in scene.objects:o.hide_render=True;o.hide_set(True)
 old_objects=set(bpy.data.objects);old_actions=set(bpy.data.actions)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'Models/AssetSweepSources/2026-11-01/{slug}/{slug}-rigged.glb'))
 new=set(bpy.data.objects)-old_objects;rig=next(o for o in new if o.type=='ARMATURE');body=next(o for o in new if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));rig.name='Roster_Armature';body.name='Roster_Body';rig.data.pose_position='REST'
 actions={a.name.split('.')[0]:a for a in set(bpy.data.actions)-old_actions}
 for a in old_actions:a.name='Reference_'+a.name
 for name,a in actions.items():a.name=name;a.use_fake_user=True
 hashes={n:action_hash(a) for n,a in actions.items()}
 for o in new:
  if o not in [rig,body]:o.hide_render=True
 body.hide_render=False;rig.hide_render=True;bpy.context.view_layer.update()
 neck=(rig.matrix_world@rig.data.bones['neck'].head_local).z;ratio=neck/male_neck
 span=(rig.matrix_world@rig.data.bones['LeftArm'].head_local).x-(rig.matrix_world@rig.data.bones['RightArm'].head_local).x;xratio=span/male_span;dy=(rig.matrix_world@rig.data.bones['Hips'].head_local).y-male_hip_y*ratio
 target_arms={side:[rig.matrix_world@rig.data.bones[side+n].head_local for n in ['Arm','ForeArm','Hand']] for side in ['Left','Right']}
 tree,at=tree_and_weights(body)
 # Preserve the medieval garment silhouette. The source torso/limb clothing is
 # removed from the visible export, so projecting to jacket pockets/buttons would
 # unnecessarily reproduce those modern shapes in the replacement cloth.
 report={'id':slug,'label':label,'sex':sex,'neck_height_ratio':ratio,'shoulder_span_ratio':xratio,'source_actions':hashes,'garments':{}}
 for o in garments:
  o.hide_set(False);o.hide_render=False;o.data=o.data.copy();world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
  for mod in list(o.modifiers):o.modifiers.remove(mod)
  original_points=[o.matrix_world@v.co for v in o.data.vertices];inv=o.matrix_world.inverted()
  limits={}
  if o.name=='Tunic':
   for side,sign in [('Left',1),('Right',-1)]:
    a,b=source_arms[side];direction=(b-a).normalized();limits[side]=max((p-a).dot(direction) for p in original_points if p.x*sign>.28 and p.z>1.05)
  for v,original in zip(o.data.vertices,original_points):
   p=original.copy();blend=max(0,min(1,(p.z-.85)/.40));width=(.98*(1-blend)+xratio*blend) if o.name in ['Tunic','Shoulders'] else max(.8,min(1.15,xratio*.7+.3))
   p.x*=width;p.y=p.y*ratio+dy;p.z*=ratio
   if o.name=='Tunic' and abs(original.x)>.20 and original.z>1.05:
    side='Left' if original.x>0 else 'Right';a,b=source_arms[side];direction=(b-a).normalized();t=(original-a).dot(direction);A,B,C=target_arms[side];upper=(B-A).length;fore=(C-B).length
    fraction=max(0,min(1,t/limits[side]));distance=fraction*(upper+fore+.035)
    if distance<=upper:newcenter=A+(B-A).normalized()*distance;newdirection=(B-A).normalized()
    else:newcenter=B+(C-B).normalized()*(distance-upper);newdirection=(C-B).normalized()
    offset=original-(a+direction*t);turn=direction.rotation_difference(newdirection);sleeve=newcenter+(turn@offset)*(1-.26*fraction)
    influence=max(0,min(1,(abs(original.x)-.20)/.065));p=p.lerp(sleeve,influence)
   v.co=inv@p
  o.data.update();transfer(o,rig,at);report['garments'][o.name]={'vertices':len(o.data.vertices),'uv_layers':len(o.data.uv_layers)}
 # Keep a full original-body reference hidden; visible export uses original face,
 # neck and hands only. Long medieval sleeves cover the source jacket-arm region.
 backup=body.copy();backup.data=body.data;backup.name='SOURCE - complete '+label;scene.collection.objects.link(backup);backup.hide_render=True;backup.hide_set(True)
 body.data=body.data.copy();groups={g.index:g.name for g in body.vertex_groups};keep=set()
 for v in body.data.vertices:
  p=body.matrix_world@v.co
  hand=sum(g.weight for g in v.groups if groups[g.group].startswith(('LeftHand','RightHand')))
  if p.z>neck-.035 or hand>.45:keep.add(v.index)
 # Reject modern white collars, ties/bowties and shirt cuffs that would otherwise
 # be retained with the neck/hand skin. The face above this small neck band,
 # all distal fingers and the original facial hair remain untouched.
 texture=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'basecolor' in n.image.name.lower());pixels=list(texture.pixels);iw,ih=texture.size;uv=body.data.uv_layers.active.data
 hand_heads={side:rig.matrix_world@rig.data.bones[side+'Hand'].head_local for side in ['Left','Right']}
 def pigment(poly):
  coords=[uv[i].uv for i in poly.loop_indices];u=sum(v.x for v in coords)/len(coords);v=sum(v.y for v in coords)/len(coords);i=(int(v%1*(ih-1))*iw+int(u%1*(iw-1)))*4;return pixels[i:i+3]
 remove_ids=set()
 for poly in body.data.polygons:
  if not all(i in keep for i in poly.vertices):remove_ids.add(poly.index);continue
  p=sum((body.matrix_world@body.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
  neck_band=neck-.04<p.z<neck+.10
  wrist=any((p-wrist).length<.09 for wrist in hand_heads.values())
  if neck_band or wrist:
   r,g,b=pigment(poly);skin=r>g*1.045 and r>b*1.12 and b>r*.28
   head_weight=sum(sum(g.weight for g in body.data.vertices[i].groups if groups[g.group]=='Head') for i in poly.vertices)/len(poly.vertices)
   dark_beard=neck_band and p.z>neck+.025 and r<.18 and g<.14 and b>r*.16 and head_weight>.85
   if not skin and not dark_beard:remove_ids.add(poly.index)
 bm=bmesh.new();bm.from_mesh(body.data);remove=[f for f in bm.faces if f.index in remove_ids];report['covered_source_faces_removed_export_copy']=len(remove);bmesh.ops.delete(bm,geom=remove,context='FACES');loose=[v for v in bm.verts if not v.link_faces]
 if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
 bm.to_mesh(body.data);bm.free();body.data.update()
 # Measure palms using the full untouched skin/garment source, not the trimmed copy.
 idle=relaxed_idle(rig,backup,spread=.43)
 assert hashes=={n:action_hash(a) for n,a in actions.items()}
 scene.name=label+' - medieval fit';scene.frame_start=0;scene.frame_end=96;scene.frame_set(0)
 for o in scene.objects:
  if o.type=='LIGHT':o.hide_render=False;o.hide_set(False)
 scene.camera=bpy.data.objects['Fit review ThreeQuarter'];scene.render.resolution_percentage=100
 scene['Highhorn_Roster_Status']='Medieval long-sleeve fitting test; appearance variants pending';scene['Highhorn_Source_Id']=slug
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_MEDIEVAL_TEST.blend')),compress=True)
 export_glb(dest/'raw.glb',rig,[body]+garments);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression')
 for clip,frames in [('idle',[0]),('walk',[0,6,12,18]),('run',[0,4,8,12])]:
  a=idle if clip=='idle' else actions[clip];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
  for frame in frames:
   scene.frame_set(frame)
   for angle in (['ThreeQuarter','Side','Back'] if frame==0 else ['ThreeQuarter']):
    scene.camera=bpy.data.objects['Fit review '+angle];scene.render.filepath=str(dest/f'{clip}_{frame}_{angle}.png');bpy.ops.render.render(write_still=True)
 report['preview_bytes']=(dest/'preview.glb').stat().st_size;(dest/'Fit_Report.json').write_text(json.dumps(report,indent=2));print('ROSTER FIT SAVED',slug,json.dumps(report),flush=True)
