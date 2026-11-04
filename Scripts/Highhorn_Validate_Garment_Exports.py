"""Check staged GLB structure, image signatures and native animated skin data."""
import json, struct, math
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'Exports/MedievalRoster/2026-11-01/Garment_v6'
roster=json.loads((OUT/'Roster_Test.json').read_text())
results=[]
for asset in roster:
 for variant in asset['variants']:
  path=ROOT/variant['url'].split('?')[0].lstrip('/') if variant['url'].startswith('/') else (ROOT/'Exports/AssetSweep/2026-11-01/TestGallery'/variant['url'].split('?')[0]).resolve()
  data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);start=28+n
  def view(i):
   v=doc['bufferViews'][i];off=start+v.get('byteOffset',0);return data[off:off+v['byteLength']]
  def accessor(i):
   a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];b=view(a['bufferView']);fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size=struct.calcsize(fmt)*width;stride=v.get('byteStride',size)
   return [struct.unpack_from('<'+fmt*width,b,a.get('byteOffset',0)+j*stride) for j in range(a['count'])]
  for image in doc.get('images',[]):
   b=view(image['bufferView']);assert b.startswith(b'\xff\xd8') if image['mimeType']=='image/jpeg' else b.startswith(b'\x89PNG'),path
  clips={a['name'] for a in doc['animations']};assert {'idle','walk','run'}<=clips,(path,clips)
  for animation in doc['animations']:
   for sampler in animation['samplers']:
    for key in ['input','output']: assert all(math.isfinite(x) for row in accessor(sampler[key]) for x in row),path
  for mesh in doc['meshes']:
   for prim in mesh['primitives']:
    attrs=prim['attributes'];assert not any(k.startswith('COLOR_') for k in attrs),path
    for row in accessor(attrs['POSITION']): assert all(math.isfinite(x) for x in row),path
    for row in accessor(attrs['WEIGHTS_0']): assert abs(sum(row)-1)<.002,(path,row)
  results.append({'id':asset['id'],'appearance':variant['id'],'passed':True,'bytes':len(data)})
(OUT/'Export_Validation.json').write_text(json.dumps({'passed':True,'exports':results,'scope':'Embedded image signatures, finite geometry/animation samples, normalized skin weights, retained idle/walk/run and absence of temporary bake color attributes.'},indent=2))
print('Validated',len(results),'staged/reference exports')
