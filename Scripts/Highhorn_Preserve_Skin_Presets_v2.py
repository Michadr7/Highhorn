"""Reuse accepted skin textures on corrected test meshes without recoloring."""
from pathlib import Path
helper=Path(__file__).with_name('Highhorn_Correct_Roster_v2.py')
exec(compile(helper.read_text().split('\nids=sys.argv')[0],str(helper),'exec'))
for slug in STARTERS:
 for variant in ['warm-medium','deep-warm']:
  source=BASE/slug/'Appearance'/variant;old=next(source.glob('*.blend'));dest=OUT/slug/'Appearance'/variant;dest.mkdir(parents=True,exist_ok=True)
  bpy.ops.wm.open_mainfile(filepath=str(OUT/slug/(slug+'_CORRECTED_TEST.blend')));body=bpy.data.objects['Roster_Body'];rig=bpy.data.objects['Roster_Armature']
  with bpy.data.libraries.load(str(old),link=False) as (available,loaded):loaded.objects=['Roster_Body']
  prior=loaded.objects[0];assert prior is not None;skin=prior.data.materials[0];body.data.materials[0]=skin
  meshes=[body]+[bpy.data.objects[n] for n in ['Tunic','Pants','Boots','Shoulders']]
  scene=bpy.context.scene;rig.animation_data.action=bpy.data.actions['idle'];rig.animation_data.action_slot=rig.animation_data.action.slots[0];scene.frame_set(0)
  bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest/(slug+'_'+variant+'_CORRECTED_TEST.blend')),compress=True)
  export_glb(dest/'raw.glb',rig,meshes);package_glb(dest/'raw.glb',dest/'preview.glb',dest/'TextureCompression');scene.render.filepath=str(dest/'Preview.png');bpy.ops.render.render(write_still=True)
  (dest/'Skin_Preservation.json').write_text(json.dumps({'id':slug,'appearance':variant,'accepted_texture_reused':True,'source':str(old.relative_to(ROOT)),'hair_uses_original_material':slug=='woman'},indent=2));print('ACCEPTED SKIN RETAINED',slug,variant,flush=True)
