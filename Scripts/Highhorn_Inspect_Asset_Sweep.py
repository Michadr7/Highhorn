"""Inspect downloaded originals without modifying them; check animation/skin accessors."""
import json,struct,math,hashlib,csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/AssetSweep/2026-11-01';DEST=ROOT/'Models/AssetSweepSources/2026-11-01'
catalog=json.loads((ROOT/'Exports/AssetResearch/2026-11-01/Grab3D_Selected_Metadata.json').read_text())['models']
components={5120:('b',1),5121:('B',1),5122:('h',2),5123:('H',2),5125:('I',4),5126:('f',4)}
widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
reports=[]
for m in catalog:
 if m['slug'] in ['man-base-character','woman-base-character']:continue
 f=next(f for f in m['rigged']['files'] if f['format']=='glb');p=DEST/m['slug']/f['file']
 data=p.read_bytes();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length]);binary=data[28+length:]
 def values(index):
  a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']];code,size=components[a['componentType']];n=widths[a['type']];fmt=struct.Struct('<'+code*n);stride=view.get('byteStride',size*n);start=view.get('byteOffset',0)+a.get('byteOffset',0)
  if a['componentType']==5126:scale=1
  elif a.get('normalized'):scale={5121:255,5123:65535}.get(a['componentType'],1)
  else:scale=1
  for i in range(a['count']):
   raw=fmt.unpack_from(binary,start+i*stride)
   yield tuple(v/scale for v in raw) if scale!=1 else raw
 row={'id':m['slug'],'file':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'mesh_count':len(doc['meshes']),'material_count':len(doc.get('materials',[])),'skin_joint_counts':[len(s['joints']) for s in doc['skins']],'images':[],'clips':{},'meshes':[],'passed':True,'limitations':[]}
 for image in doc.get('images',[]):
  assert 'bufferView' in image,'External image reference';row['images'].append({'name':image.get('name'),'mime':image.get('mimeType')})
 for animation in doc['animations']:
  max_time=0;min_time=100;sampled_values=0
  for sampler in animation['samplers']:
   times=[v[0] for v in values(sampler['input'])];assert all(math.isfinite(t) for t in times);assert all(a<=b for a,b in zip(times,times[1:]));max_time=max(max_time,max(times));min_time=min(min_time,min(times))
   for v in values(sampler['output']):assert all(math.isfinite(x) for x in v);sampled_values+=len(v)
  row['clips'][animation['name']]={'start_seconds':min_time,'end_seconds':max_time,'channels':len(animation['channels']),'finite_values_checked':sampled_values}
 assert {'walk','run'}<=set(row['clips'])
 for mesh in doc['meshes']:
  primitives=[]
  for primitive in mesh['primitives']:
   attr=primitive['attributes'];assert all(k in attr for k in ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
   count=doc['accessors'][attr['POSITION']]['count'];assert count==doc['accessors'][attr['WEIGHTS_0']]['count']
   maximum_error=0;unweighted=0
   for ws in values(attr['WEIGHTS_0']):
    maximum_error=max(maximum_error,abs(sum(ws)-1));unweighted+=sum(ws)<1e-6
   assert unweighted==0 and maximum_error<.01,(m['slug'],unweighted,maximum_error)
   max_joint=max(max(v) for v in values(attr['JOINTS_0']));assert max_joint<len(doc['skins'][0]['joints'])
   for v in values(attr['POSITION']):assert all(math.isfinite(x) for x in v)
   primitives.append({'vertices':count,'triangles':doc['accessors'][primitive['indices']]['count']//3,'max_weight_sum_error':maximum_error,'unweighted_vertices':unweighted,'morph_targets':len(primitive.get('targets',[]))})
  row['meshes'].append({'name':mesh.get('name'),'primitives':primitives})
 row['limitations']=['Source character is one mesh; hair, beard, clothing and skin are not independently provided as mesh objects.','No face morph targets in this GLB.','No idle clip supplied; bind pose is not a relaxed idle.','No claim of motion collision clearance; inspect renders and browser playback.','Board LOD and texture optimization required before integration.']
 reports.append(row);print(json.dumps({'id':row['id'],'passed':True,'bones':row['skin_joint_counts'],'triangles':sum(p['triangles'] for mesh in row['meshes'] for p in mesh['primitives']),'clips':row['clips']}),flush=True)
(OUT/'Binary_Inspection.json').write_text(json.dumps({'all_passed':all(r['passed'] for r in reports),'models':reports},indent=2))
