"""Side-by-side v2/v3 materials, with a copied board and isolated save storage."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'Exports/StyleStudy/2026-11-02'
OLD=BASE/'Toon_v2'; OUT=BASE/'Toon_v3'; OUT.mkdir(exist_ok=True)
PREFIX='/Exports/StyleStudy/2026-11-02'
for name in ['study.css','Production_Before.json','Start_Style_Study.cmd']:
    shutil.copy2(OLD/name,OUT/name)
config=json.loads((OLD/'study.json').read_text())
config.update(source=PREFIX+'/Toon_v2/commoner-toon.glb',style=PREFIX+'/Toon_v3/commoner-toon.glb',sourceBlend=PREFIX+'/Toon_v2/Highhorn_Commoner_TOON_v2_TEST.blend',styleBlend=PREFIX+'/Toon_v3/Highhorn_Commoner_TOON_v3_TEST.blend')
config['palette']={'Ochre linen':'#ad9568','Chestnut':'#80553b','Olive':'#62654e','Umber':'#493d32'}
(OUT/'study.json').write_text(json.dumps(config,indent=2))
both='<script src="'+PREFIX+'/Toon_v2/toon-materials.js"></script><script>window.HighhornToonV2=window.HighhornToon;</script><script src="toon-materials.js"></script>'
html=(OLD/'index.html').read_text(encoding='utf-8')
for a,b in {
 'TOON STUDY · SECOND ITERATION':'TOON STUDY · THIRD ITERATION',
 'Broader light bands and faceted clothing, with smooth skin. Same colors, same fit, different shading.':'Softer toon skin, warmer ochre linen and stronger clothing shadows. Compare the previous look with the polished study.',
 'FIRST STUDY · CONTINUOUS LIGHT':'TOON V2 · PREVIOUS LOOK',
 'TOON STUDY · FOUR LIGHT BANDS':'TOON V3 · SOFT SKIN, CRISP CLOTH',
 'First and second Commoner studies':'Previous and polished Commoner toon studies',
 'First study and toon study, side by side':'Previous toon and polished toon, side by side',
 'Clothing uses four light bands and flat face normals; the face and skin retain smooth shading.':'Clothing has four crisp light bands and flat face normals. Smooth skin uses three softer bands, and the linen is slightly darker and warmer.',
 'The palette and detailed mesh are unchanged from the first study.':'The original face, fitted geometry and animations are retained.',
 '<script src="toon-materials.js"></script>':both,
}.items():html=html.replace(a,b)
(OUT/'index.html').write_text(html,encoding='utf-8')
js=(OLD/'study.js').read_text(encoding='utf-8')
js=js.replace('if(i===1)HighhornToon.apply(gltf.scene);','(i===0?HighhornToonV2:HighhornToon).apply(gltf.scene);')
js=js.replace('toon:!!m.material.userData.highhornToon}', 'toon:!!m.material.userData.highhornToon,softSkin:!!m.material.userData.highhornSoftSkin,color:m.material.color.toArray(),normalMap:!!m.material.normalMap}')
js=js.replace('Continuous and stepped lighting ready','Previous and polished toon looks ready')
(OUT/'study.js').write_text(js,encoding='utf-8')
(OUT/'Board').mkdir(exist_ok=True)
for name in ['index.html','game.js','hero-commoner.js','fixture.js']:
    text=(OLD/'Board'/name).read_text(encoding='utf-8')
    text=text.replace(PREFIX+'/Toon_v2/',PREFIX+'/Toon_v3/')
    text=text.replace(PREFIX+'/commoner-style.glb',PREFIX+'/Toon_v2/commoner-toon.glb')
    text=text.replace('First study','Previous toon').replace('Toon study','Polished toon')
    if name=='index.html':
        tag='<script src="'+PREFIX+'/Toon_v3/toon-materials.js"></script>'
        text=text.replace(tag,both.replace('src="toon-materials.js"','src="'+PREFIX+'/Toon_v3/toon-materials.js"'))
    if name=='hero-commoner.js':
        text=text.replace("if(config.id==='style-proposed')HighhornToon.apply(gltf.scene);", "(config.id==='style-proposed'?HighhornToon:HighhornToonV2).apply(gltf.scene);")
        text=text.replace("'highhorn-board-srgb-v2-'+!!material.userData.highhornToon", "'highhorn-board-srgb-v3-'+config.id+'-'+!!material.userData.highhornSoftSkin")
    (OUT/'Board'/name).write_text(text,encoding='utf-8')
(OUT/'Start_Style_Study.ps1').write_text((OLD/'Start_Style_Study.ps1').read_text().replace('Toon_v2','Toon_v3'))
test=(ROOT/'Scripts/Highhorn_Validate_Toon_v2.py').read_text().replace('Toon_v2','Toon_v3').replace('TOON_v2','TOON_v3')
test=test.replace("'matrix': [list(row) for row in obj.matrix_world],", "'matrix': [list(row) for row in obj.matrix_world],\n        'smooth_flags': [f.use_smooth for f in mesh.polygons],")
test=test.replace("['uv', 'weights', 'topology', 'matrix']", "['uv', 'weights', 'topology', 'matrix', 'smooth_flags']")
test=test.replace("if name != 'char1':\n", "if name == 'char1':\n            ramp=mat.node_tree.nodes['TOON_V3_LIGHT_BANDS']\n            assert ramp.color_ramp.interpolation=='EASE' and len(ramp.color_ramp.elements)==6\n        if name != 'char1':\n")
test=test.replace("production = json.loads", "tunic=next(m for m in style_doc['materials'] if m['name']=='Highhorn v3 Tunic')\nassert np.allclose(tunic['pbrMetallicRoughness']['baseColorFactor'][:3], build['tunic_linear_factor'])\nassert all(0 < v < 1 for v in build['tunic_linear_factor'])\nproduction = json.loads")
(ROOT/'Scripts/Highhorn_Validate_Toon_v3.py').write_text(test)
test=(ROOT/'Scripts/Highhorn_Test_Toon_v2.cjs').read_text().replace('Toon_v2','Toon_v3').replace("'9247'","'9248'")
test=test.replace("assert(initial.models[1].meshDetails.find(m=>m.name==='char1').material==='MeshStandardMaterial');", "const skin=initial.models[1].meshDetails.find(m=>m.name==='char1');\n    assert(skin.material==='MeshToonMaterial' && skin.softSkin && !skin.flat && !skin.normalMap);\n    assert(initial.models[0].meshDetails.find(m=>m.name==='char1').material==='MeshStandardMaterial');\n    const linen=initial.models[1].meshDetails.find(m=>m.name==='Tunic');\n    const build=JSON.parse(fs.readFileSync(path.join(out,'Build_Report.json'),'utf8'));\n    linen.color.forEach((c,i)=>assert(Math.abs(c-build.tunic_linear_factor[i])<1e-5));")
test=test.replace('Four compiled flat toon clothing materials and smooth skin','Four hard-band flat clothing materials, a verified darker ochre tint, and soft-band smooth skin')
(ROOT/'Scripts/Highhorn_Test_Toon_v3.cjs').write_text(test)
print('TOON V3 REVIEW PREPARED')
