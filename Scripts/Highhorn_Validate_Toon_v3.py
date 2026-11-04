"""Reopen the style file and compare its preserved data and animated export."""
import sys, json, hashlib, struct, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *

OUT = ROOT / 'Exports/StyleStudy/2026-11-02/Toon_v3'
build = json.loads((OUT / 'Build_Report.json').read_text())
NAMES = ['char1', 'Tunic', 'Pants', 'Boots', 'Shoulders']

def sha(data):
    return hashlib.sha256(data).hexdigest()

def geometry(obj):
    mesh = obj.data
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get('co', positions)
    return {
        'positions': positions.reshape(-1, 3),
        'uv': sha(repr([[tuple(p.uv) for p in layer.data] for layer in mesh.uv_layers]).encode()),
        'weights': sha(repr([[(obj.vertex_groups[g.group].name, g.weight) for g in v.groups] for v in mesh.vertices]).encode()),
        'topology': sha(repr([tuple(f.vertices) for f in mesh.polygons]).encode()),
        'matrix': [list(row) for row in obj.matrix_world],
        'smooth_flags': [f.use_smooth for f in mesh.polygons],
    }

def skin_images():
    result = {}
    for mat in bpy.data.objects['char1'].data.materials:
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                image = node.image
                pixels = np.empty(len(image.pixels), dtype=np.float32)
                image.pixels.foreach_get(pixels)
                result[image.name] = sha(pixels.tobytes())
    return result

def skeleton(rig):
    return repr([(b.name, b.parent.name if b.parent else None,
                  [list(row) for row in b.matrix_local]) for b in rig.data.bones])

def sample_poses(rig):
    poses = {}
    rig.data.pose_position = 'POSE'
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    for clip in ['idle', 'walk', 'run']:
        action = bpy.data.actions[clip]
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        start, end = action.frame_range
        for progress in [0, .25, .5, .75, .999]:
            frame = start + (end - start) * progress
            bpy.context.scene.frame_set(math.floor(frame), subframe=frame % 1)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            row = {}
            for name in NAMES:
                evaluated = bpy.data.objects[name].evaluated_get(depsgraph)
                mesh = evaluated.to_mesh()
                coords = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
                mesh.vertices.foreach_get('co', coords)
                assert np.isfinite(coords).all(), (name, clip, progress)
                coords = coords.reshape(-1, 3)[::max(1, len(mesh.vertices) // 500)]
                matrix = np.array(evaluated.matrix_world)
                row[name] = coords @ matrix[:3, :3].T + matrix[:3, 3]
                evaluated.to_mesh_clear()
            poses[(clip, progress)] = row
    return poses

bpy.ops.wm.open_mainfile(filepath=build['source'])
rig = bpy.data.objects['Armature']
source = {name: geometry(bpy.data.objects[name]) for name in NAMES}
original_images = skin_images()
original_bones = skeleton(rig)
original_actions = {a.name: action_hash(a) for a in bpy.data.actions}
original_poses = sample_poses(rig)

bpy.ops.wm.open_mainfile(filepath=str(OUT / 'Highhorn_Commoner_TOON_v3_TEST.blend'))
rig = bpy.data.objects['Armature']
assert skeleton(rig) == original_bones
assert len(rig.data.bones) == 24
assert {a.name: action_hash(a) for a in bpy.data.actions} == original_actions
assert skin_images() == original_images, 'The source face/skin images changed'
mesh_changes = {}
for name in NAMES:
    styled = geometry(bpy.data.objects[name])
    for key in ['uv', 'weights', 'topology', 'matrix', 'smooth_flags']:
        assert styled[key] == source[name][key], (name, key)
    matrix = np.array(styled['matrix'])
    delta = np.linalg.norm((styled['positions'] - source[name]['positions']) @ matrix[:3, :3].T, axis=1)
    maximum = float(delta.max())
    assert maximum <= .000001, (name, maximum)
    mesh_changes[name] = {'vertices': len(delta), 'changed': int((delta > 1e-7).sum()), 'max_world_offset_m': maximum}
    for mat in bpy.data.objects[name].data.materials:
        shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        assert shader.inputs['Metallic'].default_value == 0
        assert shader.inputs['Roughness'].default_value >= .8
        if name == 'char1':
            ramp=mat.node_tree.nodes['TOON_V3_LIGHT_BANDS']
            assert ramp.color_ramp.interpolation=='EASE' and len(ramp.color_ramp.elements)==6
        if name != 'char1':
            assert not any(f.use_smooth for f in bpy.data.objects[name].data.polygons)
            ramp=next(n for n in mat.node_tree.nodes if n.type=='VALTORGB')
            assert ramp.color_ramp.interpolation=='CONSTANT' and len(ramp.color_ramp.elements)==4
            assert any(n.bl_idname=='ShaderNodeShaderToRGB' for n in mat.node_tree.nodes)
            image = shader.inputs['Base Color'].links[0].from_node.image
            assert tuple(image.size) == (1024, 1024) and image.packed_file

styled_poses = sample_poses(rig)
deformation = []
for pose, original in original_poses.items():
    maxima = {}
    for name in NAMES:
        maximum = float(np.linalg.norm(styled_poses[pose][name] - original[name], axis=1).max())
        assert maximum <= .000002, (name, pose, maximum)
        maxima[name] = maximum
    deformation.append({'clip': pose[0], 'progress': pose[1], 'maximum_difference_m': maxima})

def glb(path):
    data = path.read_bytes()
    assert struct.unpack_from('<III', data) == (0x46546c67, 2, len(data))
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    binary = data[28 + size:]
    def view(index):
        v = doc['bufferViews'][index]
        start = v.get('byteOffset', 0)
        return binary[start:start + v['byteLength']]
    def accessor(index):
        a = doc['accessors'][index]
        v = doc['bufferViews'][a['bufferView']]
        code = {5121:'B', 5123:'H', 5125:'I', 5126:'f'}[a['componentType']]
        width = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4, 'MAT4':16}[a['type']]
        stride = v.get('byteStride', struct.calcsize(code) * width)
        buf = view(a['bufferView'])
        return [struct.unpack_from('<' + code * width, buf, a.get('byteOffset', 0) + j * stride) for j in range(a['count'])]
    images = {im['name']: sha(view(im['bufferView'])) for im in doc['images']}
    for im in doc['images']:
        signature = b'\xff\xd8' if im['mimeType'] == 'image/jpeg' else b'\x89PNG'
        assert view(im['bufferView']).startswith(signature)
    triangles = 0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            attrs = primitive['attributes']
            assert not any(k.startswith('COLOR_') for k in attrs)
            assert all(math.isfinite(x) for row in accessor(attrs['POSITION']) for x in row)
            assert all(abs(sum(row) - 1) < .002 for row in accessor(attrs['WEIGHTS_0']))
            triangles += doc['accessors'][primitive['indices']]['count'] // 3
    animations = {}
    for animation in doc['animations']:
        channels = {}
        for channel in animation['channels']:
            target = channel['target']
            sampler = animation['samplers'][channel['sampler']]
            values = [accessor(sampler[key]) for key in ['input', 'output']]
            assert all(math.isfinite(x) for rows in values for row in rows for x in row)
            channels[(doc['nodes'][target['node']]['name'], target['path'])] = sha(repr(values).encode())
        animations[animation['name']] = channels
    assert set(animations) == {'idle', 'walk', 'run'}
    return doc, images, animations, triangles

config = json.loads((OUT / 'study.json').read_text())
source_doc, source_images, source_clips, source_tris = glb(ROOT / config['source'].lstrip('/'))
style_doc, style_images, style_clips, style_tris = glb(OUT / 'commoner-toon.glb')
assert source_clips == style_clips, 'Runtime animation channels changed'
assert source_tris == style_tris == 175969
assert len(source_doc['meshes']) == len(style_doc['meshes']) == 5
for name, digest in source_images.items():
    if name in {'rig_basecolor', 'rig_normal'}:
        assert style_images[name] == digest, name

tunic=next(m for m in style_doc['materials'] if m['name']=='Highhorn v3 Tunic')
assert np.allclose(tunic['pbrMetallicRoughness']['baseColorFactor'][:3], build['tunic_linear_factor'])
assert all(0 < v < 1 for v in build['tunic_linear_factor'])
production = json.loads((OUT / 'Production_Before.json').read_text())
assert all(sha((ROOT / name).read_bytes()) == digest for name, digest in production.items())
report = {
    'passed': True, 'mesh_changes': mesh_changes, 'poses': deformation,
    'bones': 24, 'triangles': style_tris, 'runtime_clips_identical': True,
    'skin_image_pixels_and_runtime_color_normal_payloads_identical': True,
    'uv_weights_topology_and_object_transforms_identical': True,
    'production_files_unchanged': len(production),
    'scope': 'Reopened Blender data/material/image checks; fifteen finite animated poses and zero geometric changes and four-band Eevee nodes; GLB data, normalized weights and exact animation channels; production hash guard. No continuous collision certification or interactive Blender GUI inspection.'
}
(OUT / 'Validation.json').write_text(json.dumps(report, indent=2))
print('STYLE VALIDATION PASSED', json.dumps(mesh_changes), flush=True)
