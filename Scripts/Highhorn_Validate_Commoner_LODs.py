"""Reopen the LODs, verify preserved animation and measure simplification error."""
import sys,json,hashlib,struct,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Optimize_Commoners import *

def skeleton(rig):
 return repr([(b.name,b.parent.name if b.parent else None,[list(r) for r in b.matrix_local]) for b in rig.data.bones])

def retained_cloth(obj):
 m=obj.data;keys=m.shape_keys
 return hashlib.sha256(repr(([(tuple(v.co),[(g.group,g.weight) for g in v.groups]) for v in m.vertices],[tuple(p.vertices) for p in m.polygons],[[tuple(v.uv) for v in layer.data] for layer in m.uv_layers],[(k.name,[tuple(v.co) for v in k.data]) for k in keys.key_blocks] if keys else [])).encode()).hexdigest()

def glb(path):
 data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+size]);binary=data[28+size:]
 def read(index):
  a=doc['accessors'][index]
  dtype={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  result=np.zeros((a['count'],width),dtype=dtype)
  if 'bufferView' in a:
   v=doc['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
   if 'byteStride' in v:result=np.array([np.frombuffer(binary,dtype=dtype,count=width,offset=start+i*v['byteStride']) for i in range(a['count'])])
   else:result=np.frombuffer(binary,dtype=dtype,count=a['count']*width,offset=start).reshape(-1,width).copy()
  if 'sparse' in a:
   sparse=a['sparse'];indices=sparse['indices'];values=sparse['values'];iv=doc['bufferViews'][indices['bufferView']];vv=doc['bufferViews'][values['bufferView']]
   ids=np.frombuffer(binary,dtype={5121:np.uint8,5123:np.uint16,5125:np.uint32}[indices['componentType']],count=sparse['count'],offset=iv.get('byteOffset',0)+indices.get('byteOffset',0))
   result[ids]=np.frombuffer(binary,dtype=dtype,count=sparse['count']*width,offset=vv.get('byteOffset',0)+values.get('byteOffset',0)).reshape(-1,width)
  return result
 clips={}
 for a in doc['animations']:
  channels={}
  for c in a['channels']:
   t=c['target'];s=a['samplers'][c['sampler']];values=(read(s['input']),read(s['output']));assert all(np.isfinite(v).all() for v in values)
   channels[(doc['nodes'][t['node']]['name'],t['path'])]=hashlib.sha256(b''.join(v.tobytes() for v in values)).hexdigest()
  clips[a['name']]=channels
 assert set(clips)=={'idle','walk','run'}
 for m in doc['meshes']:
  for p in m['primitives']:
   attrs=p['attributes'];assert np.isfinite(read(attrs['POSITION'])).all();assert np.isfinite(read(attrs['NORMAL'])).all()
   assert np.max(abs(read(attrs['WEIGHTS_0']).sum(1)-1))<.002
   for t in p.get('targets',[]):assert all(np.isfinite(read(i)).all() for i in t.values())
 return doc,clips

results=[]
for gender,(source,original_glb,rigname,body) in SOURCES.items():
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/source));rig=bpy.data.objects[rigname];names=[body,'Tunic','Pants','Boots','Shoulders']
 original_bones=skeleton(rig);original_actions={a.name:action_hash(a) for a in bpy.data.actions};reference={};reference_points={};skin_uv=bpy.data.objects[body].data.uv_layers.active is not None
 cloth_hashes={name:retained_cloth(bpy.data.objects[name]) for name in ['Tunic','Shoulders']}
 for clip in ['idle','walk','run']:
  for f in [0,.375,.75]:
   pose(rig,clip,f);reference[(clip,f)]={};reference_points[(clip,f)]={}
   for name in names:
    points,_,tree=surface(bpy.data.objects[name]);reference[(clip,f)][name]=tree;reference_points[(clip,f)][name]=points[::max(1,len(points)//1000)]
 _,source_clips=glb(ROOT/original_glb)
 for level in ['hero','board']:
  dest=OUT/gender/level;bpy.ops.wm.open_mainfile(filepath=str(dest/'Highhorn_Commoner_LOD_TEST.blend'));rig=bpy.data.objects[rigname]
  assert skeleton(rig)==original_bones and len(rig.data.bones)==24
  assert original_actions=={a.name:action_hash(a) for a in bpy.data.actions}
  assert cloth_hashes=={name:retained_cloth(bpy.data.objects[name]) for name in cloth_hashes},'Tunic silhouette or shoulder correction changed'
  for name in names:
   obj=bpy.data.objects[name];assert obj.data.uv_layers.active is not None
   for v in obj.data.vertices:assert abs(sum(g.weight for g in v.groups)-1)<.002
  rows=[]
  for (clip,f),trees in reference.items():
   pose(rig,clip,f);errors={}
   for name in names:
    points,faces,tree=surface(bpy.data.objects[name]);ds=[trees[name].find_nearest(p)[3] for p in points[::max(1,len(points)//1000)]]
    errors[name]={'max_m':float(max(ds)),'p95_m':float(np.quantile(ds,.95))}
    reciprocal=[tree.find_nearest(p)[3] for p in reference_points[(clip,f)][name]]
    errors[name]['source_coverage_max_m']=float(max(reciprocal));assert max(reciprocal)<(.04 if level=='hero' else .06),(gender,level,name,'source coverage')
    assert errors[name]['p95_m']<(.012 if level=='hero' else .025),(gender,level,name,clip,f,errors[name])
   rows.append({'clip':clip,'fraction':f,'surface_error':errors})
  contacts=[]
  for clip in ['idle','walk','run']:
   for i in range(96):
    pose(rig,clip,i/96);trees={n:surface(bpy.data.objects[n])[2] for n in ['Tunic','Shoulders','Pants','Boots']}
    contacts.append({'clip':clip,'fraction':i/96,'shoulder_pairs':len(trees['Tunic'].overlap(trees['Shoulders'])),'boot_pairs':len(trees['Pants'].overlap(trees['Boots']))})
  assert all(max(r[k] for r in contacts)==0 for k in ['shoulder_pairs','boot_pairs']), (gender,level,'clearance regression')
  doc,clips=glb(dest/'commoner.glb');assert len(doc['meshes'])==5,'Unrelated object exported'
  assert clips==source_clips,'Runtime bone/morph animation changed'
  assert all(m.get('alphaMode','OPAQUE')=='OPAQUE' for m in doc['materials'])
  builds=json.loads((dest/'Build.json').read_text());row={'gender':gender,'level':level,'passed':True,'triangles':builds['triangles'],'bytes':builds['bytes'],'bone_and_morph_animation_channels_identical':True,'animated_surface_error':rows,'contacts':contacts,'maximum_contact_pairs':{k:max(r[k] for r in contacts) for k in ['shoulder_pairs','boot_pairs']}}
  (dest/'Validation.json').write_text(json.dumps(row,indent=2));results.append(row);print('LOD VALIDATED',gender,level,row['maximum_contact_pairs'],flush=True)
protected=json.loads((OUT/'Protected_Before.json').read_text());assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h for p,h in protected.items())
(OUT/'Validation.json').write_text(json.dumps({'passed':True,'protected_files_unchanged':len(protected),'results':results,'scope':'Four reopened LOD files; original rest bones and all action hashes, exact runtime bone/morph channels, normalized weights and finite data; nine animated surface-error poses and 288 contact poses per model. Sampled comparison, not continuous collision certification.'},indent=2))
