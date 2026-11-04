"""Run native export comparisons against the smaller production asset."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
script=(root/'Scripts/Highhorn_Validate_GLB.py').read_text(encoding='utf-8-sig')
script=script.replace("OUT/'Highhorn_Male_Commoner.glb'", "ROOT/'Models/Heroes/MaleCommoner/commoner.glb'")
script=script.replace("OUT/'Roundtrip_Validation.json'", "ROOT/'Exports/HeroCreatorIntegration/Web_Roundtrip_Validation.json'")
exec(compile(script,'Web_Roundtrip_Validation','exec'))
