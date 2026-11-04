import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from Highhorn_Roster_Workbench import *
OUT=ROOT/'Exports/MedievalRoster/2026-11-01'
for path in OUT.rglob('raw.glb'):
 package_glb(path,path.parent/'preview.glb',path.parent/'TextureCompression');print(path.parent.name,(path.parent/'preview.glb').stat().st_size,flush=True)
