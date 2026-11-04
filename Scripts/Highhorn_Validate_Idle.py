"""Round-trip the new idle and preserved locomotion against the Blender test file."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
# Reuse the established nearest-surface validation with this phase's inputs.
source=(ROOT/'Scripts/Highhorn_Validate_GLB.py').read_text()
source=source.replace("OUT=ROOT/'Exports/GameReady'","OUT=ROOT/'Exports/HeroPhase2/ClippingFix'")
source=source.replace("OUT/'Highhorn_Male_Commoner_EXPORT.blend'","OUT/'Highhorn_Commoner_IDLE_CLEARANCE_TEST.blend'")
source=source.replace("OUT/'Highhorn_Male_Commoner.glb'","ROOT/'Models/Heroes/MaleCommoner/commoner-idle.glb'")
source=source.replace("[('walk',[0,6,12,18,24]),('run',[0,3,7,11,15])]","[('idle',[0,24,48,72,96]),('walk',[0,6,12,18,24]),('run',[0,3,7,11,15])]")
source=source.replace("=={'walk','run'}","=={'idle','walk','run'}")
source=source.replace("Roundtrip_Validation.json","Idle_Roundtrip_Validation.json")
exec(compile(source,str(ROOT/'Scripts/Highhorn_Validate_GLB.py'),'exec'))
