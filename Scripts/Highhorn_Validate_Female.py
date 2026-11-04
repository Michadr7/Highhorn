from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'Scripts/Highhorn_Validate_GLB.py').read_text(encoding='utf-8-sig')
source=source.replace("OUT=ROOT/'Exports/GameReady'","OUT=ROOT/'Exports/FemaleCommoner'")
source=source.replace("OUT/'Highhorn_Male_Commoner_EXPORT.blend'","OUT/'Highhorn_Female_Commoner_TEST.blend'")
source=source.replace("OUT/'Highhorn_Male_Commoner.glb'","ROOT/'Models/Heroes/FemaleCommoner/commoner.glb'")
source=source.replace("bpy.data.objects['Armature']","bpy.data.objects['Female_Armature']").replace("names=['char1'","names=['Female_Body'")
source=source.replace("[('walk',[0,6,12,18,24]),('run',[0,3,7,11,15])]","[('idle',[0,24,48,72,96]),('walk',[0,6,12,18,24]),('run',[0,3,7,11,15])]")
source=source.replace("=={'walk','run'}","=={'idle','walk','run'}")
exec(compile(source,str(ROOT/'Scripts/Highhorn_Validate_GLB.py'),'exec'))
