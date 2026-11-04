import bpy
p=r'C:\Users\Michael\Documents\Projects\Highhorn\Exports\MedievalRoster\2026-11-01\Neck_v5\elderly-woman\elderly-woman_NECK_TEST.blend'
bpy.ops.wm.open_mainfile(filepath=p);o=bpy.data.objects['Roster_Body'];i=next(i for i,m in enumerate(o.data.materials) if m.name.startswith('Repaired neck'));fs=[f for f in o.data.polygons if f.material_index==i];print('SKIN FACES',len(fs),'SMOOTH',sum(f.use_smooth for f in fs),'CUSTOM',o.data.has_custom_normals)
