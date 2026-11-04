"""Material/normal-only iteration. Never changes accepted vertex positions or rigs."""
import sys, json, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *

OUT = ROOT/'Exports/StyleStudy/2026-11-02/Toon_v2'
SOURCE = OUT.parent/'Highhorn_Commoner_STYLE_TEST.blend'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
rig = bpy.data.objects['Armature']
objects = [bpy.data.objects[n] for n in ['char1','Tunic','Pants','Boots','Shoulders']]
actions = {a.name:action_hash(a) for a in bpy.data.actions}
def geometry_hash(o):
    return hashlib.sha256(repr(([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices], [tuple(f.vertices) for f in o.data.polygons], [[tuple(p.uv) for p in l.data] for l in o.data.uv_layers])).encode()).hexdigest()
before = {o.name:geometry_hash(o) for o in objects}
for o in objects:
    if o.name == 'char1': continue
    o.data = o.data.copy()
    for f in o.data.polygons: f.use_smooth = False
    for i, old in enumerate(o.data.materials):
        mat = old.copy(); o.data.materials[i] = mat
        mat.name = 'Highhorn Toon '+o.name
        mat['highhorn_shading'] = 'four-band-flat-cloth-v2'
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        for socket in ['Normal','Roughness','Metallic']:
            for link in list(bsdf.inputs[socket].links): links.remove(link)
        bsdf.inputs['Roughness'].default_value = 1
        bsdf.inputs['Metallic'].default_value = 0
# glTF carries the unchanged painted base textures and true flat mesh normals.
# Its PBR fallback is deliberate: the companion JS installs the toon shader.
export_glb(OUT/'toon-raw.glb',rig,objects)
package_glb(OUT/'toon-raw.glb',OUT/'commoner-toon.glb',OUT/'TextureCompression')
for o in objects:
    if o.name == 'char1': continue
    for mat in o.data.materials:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        base = bsdf.inputs['Base Color'].links[0].from_socket
        diffuse = nodes.new('ShaderNodeBsdfDiffuse'); diffuse.inputs['Color'].default_value = (1,1,1,1)
        diffuse.label = 'Lighting only; no photographic normal map'
        rgb = nodes.new('ShaderNodeShaderToRGB'); links.new(diffuse.outputs[0],rgb.inputs[0])
        # Map HDR illumination into the ramp domain without clipping bright bands.
        bw = nodes.new('ShaderNodeRGBToBW'); links.new(rgb.outputs['Color'],bw.inputs[0])
        scale = nodes.new('ShaderNodeMath'); scale.operation='MULTIPLY'; scale.inputs[1].default_value=.5
        links.new(bw.outputs[0],scale.inputs[0])
        ramp = nodes.new('ShaderNodeValToRGB'); ramp.label='Four broad light bands'; ramp.color_ramp.interpolation='CONSTANT'
        points=[(0,.28),(.21,.62),(.425,1),(.625,1.4)]
        for i,(position,value) in enumerate(points):
            e=ramp.color_ramp.elements[i] if i<2 else ramp.color_ramp.elements.new(position)
            e.position=position; e.color=(value,value,value,1)
        links.new(scale.outputs[0],ramp.inputs[0])
        mix=nodes.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=1
        links.new(base,mix.inputs[1]); links.new(ramp.outputs[0],mix.inputs[2])
        emission=nodes.new('ShaderNodeEmission'); links.new(mix.outputs[0],emission.inputs['Color'])
        output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
        for link in list(output.inputs['Surface'].links): links.remove(link)
        links.new(emission.outputs[0],output.inputs['Surface'])
        for j,n in enumerate([diffuse,rgb,bw,scale,ramp,mix,emission,output]): n.location=(j*220,0)
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.view_settings.view_transform='Standard'; scene.view_settings.look='None'
scene.view_settings.exposure=0; scene.view_settings.gamma=1
scene.world=scene.world.copy() if scene.world else bpy.data.worlds.new('Toon review world')
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.13,.16,.12,1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.45
for o in scene.objects:
    if o.type=='LIGHT': o.hide_render=True
def sun(name,location,energy,color):
    data=bpy.data.lights.new(name,'SUN'); data.energy=energy; data.angle=.03; data.color=color
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=location
    obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
sun('Toon warm key',(-3,-4,5),2.2,(1,.94,.84))
sun('Toon sky fill',(3,2,3),.45,(.7,.82,1))
rig.data.pose_position='POSE'; rig.animation_data.action=bpy.data.actions['idle']; rig.animation_data.action_slot=rig.animation_data.action.slots[0]
scene.frame_set(0)
# Frame the saved review camera from evaluated character bounds, in Blender space.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
points=[]
for o in objects:
    evaluated=o.evaluated_get(deps); mesh=evaluated.to_mesh()
    points.extend(evaluated.matrix_world@v.co for v in mesh.vertices)
    evaluated.to_mesh_clear()
low=Vector(tuple(min(p[a] for p in points) for a in range(3)))
high=Vector(tuple(max(p[a] for p in points) for a in range(3)))
center=(low+high)*.5; height=high.z-low.z
camera=bpy.data.objects.new('Toon review camera',bpy.data.cameras.new('Toon review camera'))
scene.collection.objects.link(camera); camera.data.type='ORTHO'; camera.data.ortho_scale=height*1.16
camera.location=center+Vector((.8,-3,.35))*height
camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera=camera
scene.render.resolution_x=900; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'Blender_Toon.png')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.shading.use_scene_lights=True
            area.spaces.active.shading.use_scene_world=True
assert before=={o.name:geometry_hash(o) for o in objects}
assert actions=={a.name:action_hash(a) for a in bpy.data.actions}
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Highhorn_Commoner_TOON_v2_TEST.blend'),compress=True)
(OUT/'Build_Report.json').write_text(json.dumps({'source':str(SOURCE),'mesh_hashes':before,'action_hashes':actions,'palette_changed':False,'geometry_positions_uvs_weights_topology_unchanged':True,'clothing_flat_shaded':True,'skin_shading_unchanged':True,'blender_shader':'Eevee Shader to RGB with constant four-band ramp','runtime_shader':'MeshToonMaterial with total-diffuse lighting quantization; companion toon-materials.js required','bands':[.28,.62,1,1.4],'thresholds':[.42,.85,1.25]},indent=2))
print('TOON V2 SAVED',flush=True)
