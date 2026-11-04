"""Package the female copies, retaining the original whole-character source untouched."""
import json,struct,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Exports/FemaleCommoner';DEST=ROOT/'Models/Heroes/FemaleCommoner';DEST.mkdir(exist_ok=True)
for source,target in [(OUT/'Female_Commoner_Full.glb',OUT/'Female_Filtered.glb'),(OUT/'Female_Commoner_Board.glb',DEST/'commoner-board.glb')]:
 data=source.read_bytes();n=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+n]);binary=data[28+n:]
 doc['animations']=[a for a in doc['animations'] if a['name'] in ['idle','walk','run']]
 assert len(doc['animations'])==3
 j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 target.write_bytes(struct.pack('<III',0x46546C67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(binary),0x004E4942)+binary)
source=(ROOT/'Scripts/Highhorn_Compress_Web_Textures.py').read_text(encoding='utf-8-sig')
source=source.replace("OUT=ROOT/'Exports/HeroCreatorIntegration'","OUT=ROOT/'Exports/FemaleCommoner'")
source=source.replace("ROOT/'Exports/GameReady/Highhorn_Male_Commoner.glb'","ROOT/'Exports/FemaleCommoner/Female_Filtered.glb'")
source=source.replace("ROOT/'Models/Heroes/MaleCommoner/commoner.glb'","ROOT/'Models/Heroes/FemaleCommoner/commoner.glb'")
exec(compile(source,str(ROOT/'Scripts/Highhorn_Compress_Web_Textures.py'),'exec'))
