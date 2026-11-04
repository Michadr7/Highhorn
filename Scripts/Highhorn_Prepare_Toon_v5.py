"""Create the isolated V4/V5 comparison and browser checks."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'Exports/StyleStudy/2026-11-02/Toon_v4';OUT=ROOT/'Exports/StyleStudy/2026-11-03/Toon_v5'
OUT.mkdir(parents=True,exist_ok=True);(OUT/'Board').mkdir(exist_ok=True)
for name in ['study.css','Production_Before.json','Start_Style_Study.cmd']:shutil.copy2(OLD/name,OUT/name)
config=json.loads((OLD/'study.json').read_text())
config.update(source='/Exports/StyleStudy/2026-11-02/Toon_v4/commoner-toon.glb',style='/Exports/StyleStudy/2026-11-03/Toon_v5/commoner-toon.glb',sourceBlend='/Exports/StyleStudy/2026-11-02/Toon_v4/Highhorn_Commoner_TOON_v4_TEST.blend',styleBlend='/Exports/StyleStudy/2026-11-03/Toon_v5/Highhorn_Commoner_TOON_v5_TEST.blend')
(OUT/'study.json').write_text(json.dumps(config,indent=2))
for name in ['index.html','study.js','Start_Style_Study.ps1','Board/index.html','Board/game.js','Board/hero-commoner.js','Board/fixture.js']:
    text=(OLD/name).read_text(encoding='utf-8')
    text=text.replace('2026-11-02/Toon_v4','2026-11-03/Toon_v5').replace('2026-11-02/Toon_v3','2026-11-02/Toon_v4').replace('HighhornToonV3','HighhornToonV4')
    text=text.replace('FOURTH ITERATION','FIFTH ITERATION').replace('TOON V4 · REFINED FIT & FACE','TOON V5 · BROADER CLOTH & MOTION').replace('TOON V3 · PREVIOUS LOOK','TOON V4 · PREVIOUS LOOK')
    text=text.replace('Softer face lighting, cleaner shoulder layers and aligned trouser cuffs. Compare the previous look with this fitting study.','Broader clothing facets and cloth that follows the running pose. Compare V4 with the new motion study.')
    text=text.replace('highhorn-board-srgb-v4','highhorn-board-srgb-v5')
    text=text.replace('flat:!!m.material.flatShading,','flat:!!m.material.flatShading,facetNormals:!!m.material.userData.highhornFacetNormals,morphWeights:m.morphTargetInfluences||[],')
    if name=='index.html':text=text.replace('flat face normals','broader per-face normals').replace('The original face, fitted geometry and animations are retained.','The original face and bone animations are retained; clothing has fitted and corrective shapes.')
    (OUT/name).write_text(text,encoding='utf-8')
shader=(OLD/'toon-materials.js').read_text().replace('Highhorn v4','Highhorn v5').replace('skin-v4','skin-v5').replace('cloth-v4','cloth-v5')
shader=shader.replace('material.flatShading = !skin;','material.flatShading = false;\n        material.morphTargets = !!mesh.morphTargetInfluences;\n        material.userData.highhornFacetNormals = !skin;')
(OUT/'toon-materials.js').write_text(shader)
test=(ROOT/'Scripts/Highhorn_Test_Toon_v4.cjs').read_text().replace('2026-11-02/Toon_v4','2026-11-03/Toon_v5').replace("'9249'","'9250'")
test=test.replace("m=>m.toon&&m.flat&&m.material==='MeshToonMaterial'","m=>m.toon&&m.facetNormals&&!m.flat&&m.material==='MeshToonMaterial'")
test=test.replace('let difference = 0;','')
test=test.replace('        assert(difference < .0121, `Unexpected shape change: ${difference}`);','')
test=test.replace('Four hard-band flat clothing materials','Four hard-band per-face clothing materials')
test=test.replace('    const motion = {}, poses = [];','    const motion = {}, poses = [];\n    await evaluate("highhornStyleStudy.setClip(\'run\');highhornStyleStudy.setProgress(.125)");\n    const corrective = await evaluate("highhornStyleStudy.inspect().models[1].meshDetails.find(m=>m.name===\'Shoulders\').morphWeights");\n    assert(corrective.length===2 && Math.max(...corrective)>.5, \'Running corrective missing\');\n    await evaluate("highhornStyleStudy.setClip(\'idle\');highhornStyleStudy.setProgress(.25)");\n    assert((await evaluate("highhornStyleStudy.inspect().models[1].meshDetails.find(m=>m.name===\'Shoulders\').morphWeights")).every(w=>Math.abs(w)<1e-6));')
(ROOT/'Scripts/Highhorn_Test_Toon_v5.cjs').write_text(test)
print('V5 REVIEW PREPARED')
