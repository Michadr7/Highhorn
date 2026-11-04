"""Repack the accepted GLB with full-resolution JPEG clothing maps only.
Geometry, animation, materials, original body maps and all non-image bytes stay exact.
"""
import bpy,json,struct,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/HeroCreatorIntegration';TMP=OUT/'TextureCompression';TMP.mkdir(exist_ok=True)
source=ROOT/'Exports/GameReady/Highhorn_Male_Commoner.glb';target=ROOT/'Models/Heroes/MaleCommoner/commoner.glb'
data=source.read_bytes();json_len=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+json_len]);bin_start=20+json_len+8;binary=data[bin_start:]
original_views=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in doc['bufferViews']]
replacements={};report={'source_bytes':len(data),'images':[]}
for image in doc['images']:
 if image['mimeType']!='image/png':continue
 index=image['bufferView'];name=image['name'];png=TMP/(name+'.png');jpeg=TMP/(name+'.jpg');png.write_bytes(original_views[index])
 im=bpy.data.images.load(str(png),check_existing=False)
 size=list(im.size);im.file_format='JPEG';im.save(filepath=str(jpeg),quality=94,save_copy=True)
 jpg=jpeg.read_bytes();replacements[index]=jpg;image['mimeType']='image/jpeg'
 report['images'].append({'name':name,'size':size,'png_bytes':len(original_views[index]),'jpeg_bytes':len(jpg),'quality':94})
new_binary=bytearray()
for index,view in enumerate(doc['bufferViews']):
 while len(new_binary)%4:new_binary.append(0)
 chunk=replacements.get(index,original_views[index]);view['byteOffset']=len(new_binary);view['byteLength']=len(chunk);new_binary.extend(chunk)
 if index not in replacements:assert hashlib.sha256(chunk).digest()==hashlib.sha256(original_views[index]).digest()
while len(new_binary)%4:new_binary.append(0)
doc['buffers'][0]['byteLength']=len(new_binary)
new_json=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();new_json+=b' '*((-len(new_json))%4)
result=struct.pack('<III',0x46546C67,2,12+8+len(new_json)+8+len(new_binary))+struct.pack('<II',len(new_json),0x4E4F534A)+new_json+struct.pack('<II',len(new_binary),0x004E4942)+new_binary
target.write_bytes(result);assert target.stat().st_size<25*1024*1024
report.update(web_bytes=len(result),reduction_percent=round(100*(1-len(result)/len(data)),1),geometry_animation_and_original_body_maps_byte_identical=True,sha256=hashlib.sha256(result).hexdigest())
(OUT/'Web_Asset_Report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
