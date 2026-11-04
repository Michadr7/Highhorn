"""Polish the accepted toon study: soft skin bands, ochre cloth, crisp shadows."""
import sys, json, struct, hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/StyleStudy/2026-11-02/Toon_v3'
SOURCE=OUT.parent/'Toon_v2/Highhorn_Commoner_TOON_v2_TEST.blend'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene; rig=bpy.data.objects['Armature']
objects=[bpy.data.objects[n] for n in ['char1','Tunic','Pants','Boots','Shoulders']]
def digest(o):
    return hashlib.sha256(repr(([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices],[tuple(f.vertices) for f in o.data.polygons],[[tuple(v.uv) for v in l.data] for l in o.data.uv_layers])).encode()).hexdigest()
before={o.name:digest(o) for o in objects}
actions={a.name:action_hash(a) for a in bpy.data.actions}
def linear(hexcolor):
    values=[int(hexcolor[i:i+2],16)/255 for i in [1,3,5]]
    return np.array([v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values])
factor=(linear('#ad9568')/linear('#b4aa80')).tolist()
# Export standard glTF material fallbacks first. The textures themselves stay intact.
for obj in objects:
    for i,old in enumerate(obj.data.materials):
        mat=old.copy(); obj.data.materials[i]=mat; mat.name='Highhorn v3 '+obj.name
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        for link in list(output.inputs['Surface'].links): links.remove(link)
        links.new(bsdf.outputs[0],output.inputs['Surface'])
export_glb(OUT/'toon-raw.glb',rig,objects)
package_glb(OUT/'toon-raw.glb',OUT/'commoner-toon.glb',OUT/'TextureCompression')
# Encode the tunic tint as a glTF baseColorFactor, so even generic viewers retain it.
path=OUT/'commoner-toon.glb'; data=path.read_bytes(); size=struct.unpack_from('<I',data,12)[0]
doc=json.loads(data[20:20+size]); binary_chunk=data[20+size:]
tunic_materials=[m for m in doc['materials'] if m['name']=='Highhorn v3 Tunic']
assert len(tunic_materials)==1
tunic_materials[0]['pbrMetallicRoughness']['baseColorFactor']=factor+[1]
encoded=json.dumps(doc,separators=(',',':')).encode(); encoded+=b' '*(-len(encoded)%4)
path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(encoded)+len(binary_chunk))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+binary_chunk)
for obj in objects:
    skin=obj.name=='char1'
    for mat in obj.data.materials:
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        base=bsdf.inputs['Base Color'].links[0].from_socket
        # Remove obsolete connected lighting helpers, retaining the original
        # texture/normal nodes and PBR fallback for inspection and future export.
        for node in list(nodes):
            if node.type in {'BSDF_DIFFUSE','SHADERINFO','RGBTOBW','VALTORGB','EMISSION'} or node.bl_idname=='ShaderNodeShaderToRGB':
                nodes.remove(node)
        diffuse=nodes.new('ShaderNodeBsdfDiffuse'); diffuse.inputs['Color'].default_value=(1,1,1,1)
        rgb=nodes.new('ShaderNodeShaderToRGB'); links.new(diffuse.outputs[0],rgb.inputs[0])
        bw=nodes.new('ShaderNodeRGBToBW'); links.new(rgb.outputs[0],bw.inputs[0])
        scale=nodes.new('ShaderNodeMath'); scale.operation='MULTIPLY'; scale.inputs[1].default_value=.5; links.new(bw.outputs[0],scale.inputs[0])
        ramp=nodes.new('ShaderNodeValToRGB'); ramp.name='TOON_V3_LIGHT_BANDS'
        ramp.label='Soft skin lighting' if skin else 'Hard clothing shadow bands'
        ramp.color_ramp.interpolation='EASE' if skin else 'CONSTANT'
        points=[(0,.52),(.23,.52),(.32,.85),(.43,.85),(.52,1.18),(1,1.18)] if skin else [(0,.20),(.21,.50),(.425,.92),(.625,1.38)]
        for i,(position,value) in enumerate(points):
            e=ramp.color_ramp.elements[i] if i<2 else ramp.color_ramp.elements.new(position)
            e.position=position; e.color=(value,value,value,1)
        links.new(scale.outputs[0],ramp.inputs[0])
        if obj.name=='Tunic':
            tint=nodes.new('ShaderNodeMixRGB'); tint.name='TOON_V3_OCHRE_TINT'; tint.blend_type='MULTIPLY'; tint.inputs[0].default_value=1
            links.new(base,tint.inputs[1]); tint.inputs[2].default_value=factor+[1]; base=tint.outputs[0]
        mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
        links.new(base,mix.inputs[1]); links.new(ramp.outputs[0],mix.inputs[2])
        emission=nodes.new('ShaderNodeEmission'); links.new(mix.outputs[0],emission.inputs['Color'])
        output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        for link in list(output.inputs['Surface'].links): links.remove(link)
        links.new(emission.outputs[0],output.inputs['Surface'])
        mat['highhorn_shading']='soft-toon-smooth-skin-v3' if skin else 'hard-toon-flat-cloth-v3'
        for j,n in enumerate([diffuse,rgb,bw,scale,ramp,mix,emission,output]): n.location=(j*220,0)
scene.render.filepath=str(OUT/'Blender_Toon_')
scene.render.engine='BLENDER_EEVEE_NEXT'
rig.animation_data.action=bpy.data.actions['idle']; rig.animation_data.action_slot=rig.animation_data.action.slots[0]; scene.frame_set(0)
assert before=={o.name:digest(o) for o in objects}
assert actions=={a.name:action_hash(a) for a in bpy.data.actions}
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Commoner_TOON_v3_TEST.blend'),compress=True)
(OUT/'Build_Report.json').write_text(json.dumps({'source':str(SOURCE),'mesh_hashes':before,'action_hashes':actions,'tunic_palette_from':'#b4aa80','tunic_palette_to':'#ad9568','tunic_linear_factor':factor,'geometry_unchanged':True,'original_texture_pixels_preserved':True,'cloth_bands':[.20,.50,.92,1.38],'cloth_thresholds':[.42,.85,1.25],'skin_bands':[.52,.85,1.18],'skin_thresholds':[.55,.95],'skin_transition_halfwidth':.09,'scope':'Whole original char1 mesh (skin, face, hair and eyes) shares the soft toon lighting; no geometry or UV segmentation.'},indent=2))
print('TOON V3 SAVED',flush=True)
