import bpy,runpy
from pathlib import Path
root=Path(r'C:\Users\Michael\Documents\Projects\Highhorn')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'Models/CommonerSources/man-base-character-rigged.glb'))
bpy.ops.import_scene.fbx(filepath=str(root/'Cloting/PeasantOutfit/source/All.fbx'))
bpy.context.view_layer.update()
runpy.run_path(str(root/'Scripts/Highhorn_Inspect_Fit.py'))
