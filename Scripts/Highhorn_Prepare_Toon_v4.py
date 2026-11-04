"""Prepare an isolated v3/v4 fit and face-lighting comparison."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'Exports/StyleStudy/2026-11-02';OLD=BASE/'Toon_v3';OUT=BASE/'Toon_v4'
OUT.mkdir(exist_ok=True);(OUT/'Board').mkdir(exist_ok=True)
for name in ['study.css','Production_Before.json','Start_Style_Study.cmd']:
    shutil.copy2(OLD/name,OUT/name)
config=json.loads((OLD/'study.json').read_text())
config.update(source='/Exports/StyleStudy/2026-11-02/Toon_v3/commoner-toon.glb',style='/Exports/StyleStudy/2026-11-02/Toon_v4/commoner-toon.glb',sourceBlend='/Exports/StyleStudy/2026-11-02/Toon_v3/Highhorn_Commoner_TOON_v3_TEST.blend',styleBlend='/Exports/StyleStudy/2026-11-02/Toon_v4/Highhorn_Commoner_TOON_v4_TEST.blend')
(OUT/'study.json').write_text(json.dumps(config,indent=2))
for name in ['index.html','study.js','Start_Style_Study.ps1','Board/index.html','Board/game.js','Board/hero-commoner.js','Board/fixture.js']:
    text=(OLD/name).read_text(encoding='utf-8')
    text=text.replace('Toon_v3','Toon_v4').replace('Toon_v2','Toon_v3').replace('HighhornToonV2','HighhornToonV3')
    text=text.replace('THIRD ITERATION','FOURTH ITERATION').replace('TOON V3 · SOFT SKIN, CRISP CLOTH','TOON V4 · REFINED FIT & FACE').replace('TOON V2 · PREVIOUS LOOK','TOON V3 · PREVIOUS LOOK')
    text=text.replace('Softer toon skin, warmer ochre linen and stronger clothing shadows. Compare the previous look with the polished study.','Softer face lighting, cleaner shoulder layers and aligned trouser cuffs. Compare the previous look with this fitting study.')
    text=text.replace('approved fit and all three animations retained','revised fit and all three animations retained')
    text=text.replace('highhorn-board-srgb-v3','highhorn-board-srgb-v4')
    if name=='study.js':
        text=text.replace('back:[[.75,1.14,-3.8],[0,.94,0]]','back:[[.75,1.14,-3.8],[0,.94,0]],side:[[3.9,1.05,0],[0,.91,0]],boots:[[1.1,.32,1.1],[0,.24,0]],shoulders:[[.8,1.85,-1.3],[0,1.4,0]]')
    if name=='index.html':
        text=text.replace('<button data-view="back">Back</button>','<button data-view="back">Back</button><button data-view="side">Side</button><button data-view="boots">Boots &amp; cuffs</button>')
    (OUT/name).write_text(text,encoding='utf-8')
shader=(OLD/'toon-materials.js').read_text().replace('Highhorn v3','Highhorn v4').replace('skin-v3','skin-v4').replace('cloth-v3','cloth-v4')
shader=shader.replace('0.52 + 0.33*smoothstep(0.46,0.64,level) + 0.33*smoothstep(0.86,1.04,level)','0.56 + 0.30*smoothstep(0.41,0.69,level) + 0.30*smoothstep(0.81,1.09,level)')
shader=shader.replace('skinBands:[.52,.85,1.18]','skinBands:[.56,.86,1.16]')
(OUT/'toon-materials.js').write_text(shader)
test=(ROOT/'Scripts/Highhorn_Test_Toon_v3.cjs').read_text().replace('Toon_v3','Toon_v4').replace("'9248'","'9249'")
test=test.replace("assert(initial.models[0].meshDetails.find(m=>m.name==='char1').material==='MeshStandardMaterial');","assert(initial.models[0].meshDetails.find(m=>m.name==='char1').material==='MeshToonMaterial');")
test=test.replace("['face', 'back']","['face', 'back', 'side', 'boots', 'shoulders']")
(ROOT/'Scripts/Highhorn_Test_Toon_v4.cjs').write_text(test)
print('V4 REVIEW PREPARED')
