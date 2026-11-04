"""Resize original garment meshes only; preserve base, UVs, materials and actions."""
import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'Exports/Highhorn_Male_Commoner_Dimension_Test.blend'))
scene=bpy.context.scene
body=bpy.data.objects['char1'];rig=bpy.data.objects['Armature']
def signature():
 return (hashlib.sha256(b''.join(__import__('struct').pack('fff',*v.co) for v in body.data.vertices)).hexdigest(),[tuple(row) for row in body.matrix_world],len(rig.data.bones),[(a.name,tuple(a.frame_range)) for a in bpy.data.actions], [m.name for m in body.data.materials])
before=signature()
# Local copies retain every face, UV coordinate, material slot and texture.
report={}
for name in ['Tunic','Shoulders','Pants','Boots']:
 o=bpy.data.objects[name];o.data=o.data.copy();inv=o.matrix_world.inverted()
 points=[o.matrix_world@v.co for v in o.data.vertices]
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
 for v,p in zip(o.data.vertices,points):
  if name=='Pants':
   p.z=.19+(p.z-lo.z)/(hi.z-lo.z)*(.03+1-.19)
   p.x*=1.14;p.y=.04+(p.y-.04)*1.28
  elif name=='Boots':
   p.z=(p.z-lo.z)/(hi.z-lo.z)*.32
   center=.163 if p.x>0 else -.163
   p.x=center+(p.x-(.179 if p.x>0 else -.179))*1.22
   p.y=.04+(p.y-.015)*1.22
   p.z-=.008
  elif name=='Tunic':
   # Lift the low-hanging source sleeves toward the Grab3D upper arms.
   sleeve=max(0,min(1,(abs(p.x)-.17)/.12))
   p.z+=.115*sleeve
   p.x*=1.13;p.y=.04+(p.y-.04)*1.30
  else:
   p.x*=1.10;p.y=.045+(p.y-.045)*1.24;p.z+=.025
  v.co=inv@p
 o.data.update()
 report[name]={'before_bounds':[list(lo),list(hi)],'vertices':len(o.data.vertices),'faces':len(o.data.polygons),'uv_layers':len(o.data.uv_layers)}
# Push only penetrated vertices to the preserved base surface, with a small margin.
# This is static mesh fitting, not skinning or a change to the character.
pts=[body.matrix_world@v.co for v in body.data.vertices]
polys=[tuple(p.vertices) for p in body.data.polygons]
bvh=BVHTree.FromPolygons(pts,polys)
for name in ['Pants','Boots','Tunic','Shoulders']:
 o=bpy.data.objects[name]
 # Subdivide the existing cloth surface to resolve face interiors against the body.
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Fit surface resolution','SUBSURF');mod.subdivision_type='SIMPLE';mod.levels=2
 bpy.ops.object.modifier_apply(modifier=mod.name)
 inv=o.matrix_world.inverted();count=0
 if name=='Shoulders':
  tunic=bpy.data.objects['Tunic'];extra=[tunic.matrix_world@v.co for v in tunic.data.vertices]
  layered=BVHTree.FromPolygons(pts+extra,polys+[tuple(len(pts)+i for i in p.vertices) for p in tunic.data.polygons])
 else: layered=bvh
 for v in o.data.vertices:
  p=o.matrix_world@v.co
  q,n,idx,d=layered.find_nearest(p)
  if q is not None and (p-q).dot(n)<.008:
   p=q+n*.012;v.co=inv@p;count+=1
 if name=='Boots':
  for v in o.data.vertices:
   p=o.matrix_world@v.co
   if p.z<.15:
    c=.163 if p.x>0 else -.163
    p.x=c+(p.x-c)*1.12
    p.y=.04+(p.y-.04)*1.08
    if p.z>.015: p.z+=.018*(1-min(1,p.z/.15))
    v.co=inv@p
 o.data.update()
 report[name]['surface_clearance_adjustments']=count
 report[name]['fitted_vertices']=len(o.data.vertices)
assert signature()==before,'Base character data changed'
# Store readable fitting provenance on the review file.
scene['Highhorn_Fit_Status']='Static resized original clothing; unrigged. Base preserved.'
scene['Highhorn_Fit_Report']=json.dumps(report)
for o in scene.objects:
 if o.type=='ARMATURE': o.hide_render=True
# Add review cameras; save front view selected in the file.
for label,position in [('Front',(0,-5,1.1)),('Side',(5,0,1.1)),('Back',(0,5,1.1)),('ThreeQuarter',(2,-5,2.1))]:
 data=bpy.data.cameras.new('Fit review '+label);cam=bpy.data.objects.new(data.name,data);scene.collection.objects.link(cam)
 cam.location=position;cam.rotation_euler=(Vector((0,.03,.9))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=2.12
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='TEXTURE'
scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.camera=bpy.data.objects['Fit review Front']
output=ROOT/'Exports/Highhorn_Male_Commoner_Resized_Test.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(output))
for label in ['Front','Side','Back','ThreeQuarter']:
 scene.camera=bpy.data.objects['Fit review '+label]
 scene.render.filepath=str(ROOT/('Exports/Highhorn_Resized_'+label+'.png'));bpy.ops.render.render(write_still=True)
(ROOT/'Exports/Highhorn_Resized_Report.json').write_text(json.dumps(report,indent=2))
print('VALIDATED base geometry, transform, skeleton count, actions and material slots unchanged')
