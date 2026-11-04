import bpy
m=bpy.data.objects.new('probe',bpy.data.meshes.new('probe'));bpy.context.scene.collection.objects.link(m)
x=m.modifiers.new('probe','SHRINKWRAP')
for p in ['wrap_mode','wrap_method']:
 print(p,[(v.identifier,v.description) for v in x.bl_rna.properties[p].enum_items])
