"""Append only idle animation data to the accepted web GLB; preserve existing bytes."""
import json,struct,hashlib,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/HeroPhase2/ClippingFix';DEST=ROOT/'Models/Heroes/MaleCommoner'
def read(path):
 data=path.read_bytes();n=struct.unpack_from('<I',data,12)[0]
 return json.loads(data[20:20+n]),data[28+n:]
doc,old=read(DEST/'commoner.glb');source,raw=read(OUT/'Idle_Source.glb')
binary=bytearray(old);node_map={n['name']:i for i,n in enumerate(doc['nodes'])}
idle=next(a for a in source['animations'] if a['name']=='idle')
accessor_map={};view_map={}
for sampler in idle['samplers']:
 for key in ['input','output']:
  index=sampler[key]
  if index not in accessor_map:
   a=source['accessors'][index].copy();vindex=a['bufferView']
   if vindex not in view_map:
    v=source['bufferViews'][vindex].copy();start=v.get('byteOffset',0)
    binary.extend(b'\0'*((-len(binary))%4));v['byteOffset']=len(binary)
    binary.extend(raw[start:start+v['byteLength']]);view_map[vindex]=len(doc['bufferViews']);doc['bufferViews'].append(v)
   a['bufferView']=view_map[vindex];accessor_map[index]=len(doc['accessors']);doc['accessors'].append(a)
  sampler[key]=accessor_map[index]
for channel in idle['channels']:
 target=channel['target'];oldnode=source['nodes'][target['node']];newid=node_map[oldnode['name']]
 # Translation/rotation samples use the same bone-local coordinate system.
 for key in ['translation','rotation','scale','matrix']:
  a=oldnode.get(key);b=doc['nodes'][newid].get(key)
  if a is not None and b is not None:assert max(abs(x-y) for x,y in zip(a,b))<.0001,(oldnode['name'],key)
 target['node']=newid
doc['animations'].append(idle);binary.extend(b'\0'*((-len(binary))%4));doc['buffers'][0]['byteLength']=len(binary)
data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
result=struct.pack('<III',0x46546C67,2,28+len(data)+len(binary))+struct.pack('<II',len(data),0x4E4F534A)+data+struct.pack('<II',len(binary),0x004E4942)+binary
assert binary[:len(old)]==old
(DEST/'commoner-idle.glb').write_bytes(result)
shutil.copyfile(OUT/'Commoner_Board.glb',DEST/'commoner-board.glb')
(OUT/'Package_Report.json').write_text(json.dumps({'existing_binary_data_preserved':True,'idle_bytes_added':len(binary)-len(old),'clips':[a['name'] for a in doc['animations']],'web_bytes':len(result),'board_bytes':(DEST/'commoner-board.glb').stat().st_size},indent=2))
print((OUT/'Package_Report.json').read_text())
