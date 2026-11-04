import bpy,json
from pathlib import Path
root=Path.cwd()
for filename in ['Highhorn_Male_Commoner_Dimension_Test.blend','Highhorn_Male_Commoner_Resized_Test.blend']:
 bpy.ops.wm.open_mainfile(filepath=str(root/'Exports'/filename))
 print('FILE',filename,'ACTIVE',bpy.context.scene.name,'WINDOWS',[(w.scene.name,w.workspace.name) for w in bpy.context.window_manager.windows])
 print('SCENES',[(s.name,len(s.objects)) for s in bpy.data.scenes])
 for n in ['Tunic','Pants','Boots','Shoulders']:
  o=bpy.data.objects.get(n);print(n,len(o.data.vertices),'visible',o.visible_get(),'dims',tuple(o.dimensions))
 for screen in bpy.data.screens:
  print('SCREEN',screen.name,[(a.type, a.spaces.active.shading.type if a.type=='VIEW_3D' else '') for a in screen.areas])
 if 'Resized' in filename:
  bpy.context.scene.camera=bpy.data.objects['Fit review ThreeQuarter']
  bpy.context.scene.render.filepath=str(root/'Exports/Highhorn_Resized_Reopened.png')
  bpy.ops.render.render(write_still=True)
