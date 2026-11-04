import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';report={}
for filename,property_name,expected in [('Highhorn_Asset_Sweep_TEST.blend','Highhorn_Source_Asset',12),('Highhorn_Appearance_Sweep_TEST.blend','Highhorn_Appearance_Status',30)]:
 bpy.ops.wm.open_mainfile(filepath=str(OUT/filename));scenes=[s for s in bpy.data.scenes if property_name in s];assert len(scenes)==expected,(filename,len(scenes))
 assert all(s.camera for s in scenes)
 if expected==12:
  for scene in scenes:
   rig=next(o for o in scene.objects if o.type=='ARMATURE');assert rig.animation_data.action and 'walk' in rig.animation_data.action.name
 report[filename]={'bytes':(OUT/filename).stat().st_size,'review_scenes':len(scenes),'active_scene':bpy.context.scene.name,'packed_images':sum(bool(i.packed_file) for i in bpy.data.images),'reopened_successfully':True}
(OUT/'Saved_File_Validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
