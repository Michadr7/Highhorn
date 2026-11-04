"""HIGHHORN - Male Commoner outfit source setup (non-destructive).
Run in Blender's Scripting workspace, Text > Open > Run Script (Alt+P).
Imports real Grab3D male and medieval peasant FBX; sets up editable fitting pivots.
NO automatic skinning, body clipping removal, or finalized wearable export is claimed.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

# Set this to your existing Highhorn folder if auto-detection fails.
PROJECT_ROOT = Path.home() / "Documents" / "Projects" / "Highhorn"

# Try both possible spellings of the folder seen in the user's screenshot.
def find_root():
    options = [PROJECT_ROOT]
    try:
        options.append(Path(bpy.path.abspath("//")))
    except Exception:
        pass
    for p in options:
        if (p / 'Models' / 'CommonerSources' / 'man-base-character-rigged.glb').is_file():
            return p
    raise FileNotFoundError('Cannot find source GLB. Change PROJECT_ROOT at the top of the script. Tried: ' + ', '.join(map(str,options)))

ROOT = find_root()
BASE = ROOT / 'Models' / 'CommonerSources' / 'man-base-character-rigged.glb'
CLOTH_DIR = next((ROOT / name / 'PeasantOutfit' for name in ('Cloting','Clothing') if (ROOT / name / 'PeasantOutfit' / 'source' / 'All.fbx').is_file()), None)
if CLOTH_DIR is None:
    raise FileNotFoundError('Cannot locate Cloting/PeasantOutfit/source/All.fbx in your Highhorn folder')
FBX = CLOTH_DIR / 'source' / 'All.fbx'
OUT = ROOT / 'Exports'
OUT.mkdir(exist_ok=True)

# Make a NEW scene, leaving other .blend files and existing game files alone.
scene=bpy.data.scenes.new('Highhorn Dimension Test')
bpy.context.window.scene=scene

def collection(name):
    c=bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

def put_in_collection(obj, c):
    for old in tuple(obj.users_collection):
        old.objects.unlink(obj)
    c.objects.link(obj)

def bbox(objs):
    coords=[]
    bpy.context.view_layer.update()
    for ob in objs:
        if ob.type!='MESH': continue
        for v in ob.data.vertices:
            coords.append(ob.matrix_world @ v.co)
    if not coords: raise RuntimeError('Mesh bounding box missing')
    low=Vector([min(v[i] for v in coords) for i in range(3)])
    high=Vector([max(v[i] for v in coords) for i in range(3)])
    return low,high

def move_roots(roots, translation=None, scale=None):
    if translation is not None:
        for ob in roots: ob.location += translation
    if scale is not None:
        for ob in roots: ob.scale *= scale
    bpy.context.view_layer.update()

body_col=collection('01 - Grab3D ORIGINAL Male (preserved)')
pre=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(BASE))
body_new=[o for o in bpy.data.objects if o not in pre]
rigs=[o for o in body_new if o.type=='ARMATURE']
custom_shapes={b.custom_shape for rig in rigs for b in rig.pose.bones if b.custom_shape}
body_mesh=[o for o in body_new if o.type=='MESH' and o not in custom_shapes]
# Display rest geometry while retaining animation data and pose channels.
for rig in rigs: rig.data.pose_position='REST'
if not body_mesh: raise RuntimeError('Grab3D GLB imported without a body mesh')
for o in body_new: put_in_collection(o,body_col)
for helper in custom_shapes:
    helper.hide_set(True)
    helper.hide_render=True
body_lo,body_hi=bbox(body_mesh)
body_height=body_hi.z-body_lo.z
if body_height<0.1: raise RuntimeError('Unexpected body size')
# Display original at its original local transform (do not shift or change its rig).

cloth_col=collection('02 - REAL Peasant outfit (STATIC, unrigged)')
pre=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(FBX), use_image_search=True)
cloth_new=[o for o in bpy.data.objects if o not in pre]
cloth_mesh=[o for o in cloth_new if o.type=='MESH']
if not cloth_mesh: raise RuntimeError('Outfit FBX imported without meshes')
for o in cloth_new: put_in_collection(o,cloth_col)

# Material texture fallback. FBX imports may already have valid material links.
# If not, repoint matching textures by part name and reconnect common PBR channels.
texture_dir=CLOTH_DIR/'textures'
for obj in cloth_mesh:
    n=obj.name.lower()
    part = ('Tunic' if 'tunic' in n else 'Shoulders' if 'shoulder' in n else 'Boots' if 'boot' in n else 'LP')
    for slot in obj.material_slots:
        m=slot.material
        if not m: continue
        m.use_nodes=True
        nodes=m.node_tree.nodes; links=m.node_tree.links
        bsdf=next((x for x in nodes if x.type=='BSDF_PRINCIPLED'),None)
        if not bsdf: continue
        for kind,socket in [('BaseColor','Base Color'),('Roughness','Roughness')]:
            path=texture_dir / (('LP_DefaultMaterial' if part=='LP' else f'{part}_LP_DefaultMaterial')+f'_{kind}.png')
            if not path.is_file(): continue
            dest=bsdf.inputs.get(socket)
            if dest is None:continue
            # Use the imported material's existing texture links if they're already functional.
            existing=[link for link in dest.links if link.from_node.type=='TEX_IMAGE' and link.from_node.image and Path(bpy.path.abspath(link.from_node.image.filepath)).exists()]
            if existing: continue
            for link in list(dest.links):links.remove(link)
            tex=nodes.new('ShaderNodeTexImage');tex.label=f'{part} {kind}'
            tex.image=bpy.data.images.load(str(path),check_existing=True)
            if kind!='BaseColor':tex.image.colorspace_settings.name='Non-Color'
            links.new(tex.outputs['Color'],dest)
        m.diffuse_color = (.52,.36,.20,1) if part=='LP' else (.55,.40,.25,1)

# Each garment receives a separate EMPTY pivot; meshes keep their actual FBX geometry.
# Fit by matching source outfit height against body height, then align ground/center.
# This is INITIAL placement only, not finished skinning or deformation.
cloth_lo,cloth_hi=bbox(cloth_mesh)
cloth_h=cloth_hi.z-cloth_lo.z
if cloth_h<.001: raise RuntimeError('Outfit has unexpected near-zero Z height; inspect FBX axis conversion')
rig=rigs[0]
neck=rig.data.bones.get('neck')
if neck is None: raise RuntimeError('Missing neck landmark')
neck_z=(rig.matrix_world @ neck.head_local).z
tunic=next(o for o in cloth_mesh if 'tunic' in o.name.lower())
_,tunic_hi=bbox([tunic])
ratio=(neck_z-body_lo.z)/(tunic_hi.z-cloth_lo.z)
print('DIMENSION FIT',tuple(body_lo),tuple(body_hi),'neck',neck_z,'cloth',tuple(cloth_lo),tuple(cloth_hi),'ratio',ratio)
cloth_center=Vector(((cloth_lo.x+cloth_hi.x)/2,(cloth_lo.y+cloth_hi.y)/2,cloth_lo.z))
body_center=Vector(((body_lo.x+body_hi.x)/2,(body_lo.y+body_hi.y)/2,body_lo.z))
# Keep imported FBX hierarchy by creating a master root, parenting each unparented object.
master=bpy.data.objects.new('FIT_MASTER - scale and initial alignment',None)
cloth_col.objects.link(master)
roots=[o for o in cloth_new if o.parent is None]
for ob in roots:
    mw=ob.matrix_world.copy();ob.parent=master;ob.matrix_world=mw
master.scale=(ratio,ratio,ratio)
master.location=body_center - cloth_center*ratio
# IMPORTANT: browser Z depth does NOT map directly to Blender local Y in all files;
# user screenshots inform the alignment, but do not blindly apply -0.03 to the wrong axis.
bpy.context.view_layer.update()

# Create named selection groups for editing and material inspection.
for ob in cloth_mesh:
    n=ob.name.lower()
    part = 'TUNIC' if 'tunic' in n else 'TROUSERS' if 'pant' in n or 'trouser' in n or 'default' in n else 'BOOTS' if 'boot' in n else 'SHOULDERS' if 'shoulder' in n else 'OTHER'
    ob['Highhorn_Piece']=part
    ob['Highhorn_Rigged']=False
    ob.show_name=True

# Add a lightweight neutral reference floor, outside imported body/outfit mesh sets.
stage=collection('03 - Studio helpers (not part of character)')
bpy.ops.mesh.primitive_plane_add(size=2.5, location=(body_center.x,body_center.y,body_lo.z-0.02))
floor=bpy.context.object;floor.name='VIEW_ONLY - Ground';put_in_collection(floor,stage)
mat=bpy.data.materials.new('Studio Ground');mat.diffuse_color=(.22,.27,.22,1);floor.data.materials.append(mat)
floor.hide_render=True

# Frame imported model in viewport; set material preview and selected master pivot.
for obj in bpy.context.selected_objects:obj.select_set(False)
master.empty_display_size=body_height*.12
master.select_set(True);bpy.context.view_layer.objects.active=master
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            sp=area.spaces.active
            sp.shading.type='MATERIAL'
            from mathutils import Quaternion
            sp.region_3d.view_rotation=Quaternion((1,0,0), math.radians(90))
            sp.region_3d.view_perspective='ORTHO'
            sp.region_3d.view_location=(body_center.x,body_center.y,body_lo.z+body_height*.54)
            sp.region_3d.view_distance=max(2.8,body_height*2.2)

output=OUT / 'Highhorn_Male_Commoner_Dimension_Test.blend'
for image in bpy.data.images:
    candidate=texture_dir / Path(image.filepath.replace(chr(92),'/')).name
    if candidate.is_file() and not image.packed_file: image.filepath=str(candidate)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print('===============================================')
print('HIGHHORN: Real clothing import complete')
print('Saved Blender project:',output)
print('Original Grab3D model is untouched on disk.')
print('Imported clothing is STATIC (not yet rigged).')
print('Body height:',round(body_height,3),'Outfit height:',round(cloth_h,3))
print('Alignment ratio:',round(ratio,4))
print('Clothing pieces:',[(o.name,o.get('Highhorn_Piece')) for o in cloth_mesh])
print('NEXT: inspect fit in viewport, then rig and fix base intersections.')
print('===============================================')
