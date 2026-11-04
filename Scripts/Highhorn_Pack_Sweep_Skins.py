"""Retain skin reference images in the appearance library without assigning them to heads."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';target=OUT/'Highhorn_Appearance_Sweep_TEST.blend'
bpy.ops.wm.open_mainfile(filepath=str(target))
for row in json.loads((OUT/'Appearance_Inspection.json').read_text())['skin_materials']:
 image=bpy.data.images.load(str(ROOT/row['diffuse']),check_existing=True);image.use_fake_user=True
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
