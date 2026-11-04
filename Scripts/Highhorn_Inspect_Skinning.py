import bpy
from pathlib import Path
bpy.ops.wm.open_mainfile(filepath=str(Path.cwd()/'Exports/Highhorn_Male_Commoner_RESIZED_READY.blend'))
r=bpy.data.objects['Armature'];o=bpy.data.objects['char1']
print('RIG',r.animation_data.action.name if r.animation_data.action else None,'NLA',[(t.name,[(s.name,s.action.name) for s in t.strips]) for t in r.animation_data.nla_tracks])
print('MODS',[(m.name,m.type,m.object.name if m.type=='ARMATURE' else '') for m in o.modifiers])
print('GROUPS',[(g.index,g.name) for g in o.vertex_groups])
for a in bpy.data.actions:print('ACTION',a.name,list(a.frame_range),'slots',[(s.identifier,s.target_id_type) for s in a.slots])
