"""Apply the measured hand correction to unlock test copies only."""
from pathlib import Path
helper=Path(__file__).with_name('Highhorn_Correct_Roster_v2.py')
exec(compile(helper.read_text().split('\nids=sys.argv')[0],str(helper),'exec'))
for slug in ['viking','armored-knight','wizard','witch','elf','king','queen']:
 dest=OUT/slug;dest.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(BASE/slug/(slug+'_IDLE_TEST.blend')))
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers));rig.data.pose_position='REST';bpy.context.view_layer.update();body.data=body.data.copy();hashes={n:action_hash(bpy.data.actions[n]) for n in ['walk','run']};changed=curl_rigid_hands(rig,body);make_idle(rig,body)
 export_review(slug,dest,rig,body,[body]);assert hashes=={n:action_hash(bpy.data.actions[n]) for n in hashes}
 (dest/'Correction_Report.json').write_text(json.dumps({'id':slug,'source_actions':hashes,'rigid_hand_vertices_curled':changed,'scope':'Native finger bones posed in idle on 54-bone rigs; gentle rest-mesh finger curl on 24-bone rigs. Face/outfit unchanged.'},indent=2));print('UNLOCK HANDS SAVED',slug,flush=True)
