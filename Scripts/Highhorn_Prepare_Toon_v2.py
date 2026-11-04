"""Create an isolated v1/v2 comparison without replacing the accepted gallery."""
import json, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT/'Exports/StyleStudy/2026-11-02'
OUT=OLD/'Toon_v2'; OUT.mkdir(exist_ok=True)
PREFIX='/Exports/StyleStudy/2026-11-02'
for name in ['study.css','Production_Before.json','Start_Style_Study.cmd']:
    shutil.copy2(OLD/name,OUT/name)
config=json.loads((OLD/'study.json').read_text())
config.update(source=PREFIX+'/commoner-style.glb',style=PREFIX+'/Toon_v2/commoner-toon.glb',sourceBlend=PREFIX+'/Highhorn_Commoner_STYLE_TEST.blend',styleBlend=PREFIX+'/Toon_v2/Highhorn_Commoner_TOON_v2_TEST.blend')
(OUT/'study.json').write_text(json.dumps(config,indent=2))
html=(OLD/'index.html').read_text(encoding='utf-8')
for a,b in {
    'FIRST STUDY':'TOON STUDY · SECOND ITERATION',
    'Warm cloth, quieter leather and softer shading. Compare the same fitted character in both looks.':'Broader light bands and faceted clothing, with smooth skin. Same colors, same fit, different shading.',
    'ORIGINAL FIT':'FIRST STUDY · CONTINUOUS LIGHT',
    'HIGHHORN STYLE STUDY':'TOON STUDY · FOUR LIGHT BANDS',
    'Original and proposed Commoner':'First and second Commoner studies',
    'Original fit and style study, side by side':'First study and toon study, side by side',
    'Bring the materials closer to Highhorn’s warm, stylized world: clear color areas, restrained surface wear and matte light.':'Match the broad light and shadow shapes in this reference. Clothing uses four light bands and flat face normals; the face and skin retain smooth shading.',
    'This first study keeps the detailed mesh.':'The palette and detailed mesh are unchanged from the first study.',
    '<script src="study.js">':'<script src="toon-materials.js"></script><script src="study.js">',
}.items(): html=html.replace(a,b)
(OUT/'index.html').write_text(html,encoding='utf-8')
js=(OLD/'study.js').read_text(encoding='utf-8')
js=js.replace('const meshes=[];let bones=0,triangles=0;', 'if(i===1)HighhornToon.apply(gltf.scene);const meshes=[];let bones=0,triangles=0;')
js=js.replace('vertices:m.geometry.attributes.position.count}', 'vertices:m.geometry.attributes.position.count,material:m.material.type,flat:!!m.material.flatShading,toon:!!m.material.userData.highhornToon}')
js=js.replace('Both looks ready', 'Continuous and stepped lighting ready')
(OUT/'study.js').write_text(js,encoding='utf-8')
(OUT/'Board').mkdir(exist_ok=True)
for name in ['index.html','game.js','hero-commoner.js','fixture.js']:
    text=(OLD/'Board'/name).read_text(encoding='utf-8')
    text=text.replace(PREFIX+'/Board/',PREFIX+'/Toon_v2/Board/')
    text=text.replace(PREFIX+'/commoner-style.glb',PREFIX+'/Toon_v2/commoner-toon.glb')
    text=text.replace('/Exports/MedievalRoster/2026-11-01/CommonerBoots_v8/approved-male/preview.glb',PREFIX+'/commoner-style.glb')
    text=text.replace('Original fit','First study').replace('Style study','Toon study')
    if name=='index.html':
        text=text.replace('<script src="'+PREFIX+'/Toon_v2/Board/hero-commoner.js">','<script src="'+PREFIX+'/Toon_v2/toon-materials.js"></script><script src="'+PREFIX+'/Toon_v2/Board/hero-commoner.js">')
    if name=='hero-commoner.js':
        text=text.replace('const materials=new Set();','if(config.id===\'style-proposed\')HighhornToon.apply(gltf.scene);\n          const materials=new Set();')
        text=text.replace('materials.forEach(material=>{material.onBeforeCompile=(shader,targetRenderer)=>{','materials.forEach(material=>{const previous=material.onBeforeCompile;material.onBeforeCompile=(shader,targetRenderer)=>{\n            previous.call(material,shader,targetRenderer);')
        text=text.replace("()=> 'highhorn-board-srgb-v1'", "()=> 'highhorn-board-srgb-v2-'+!!material.userData.highhornToon")
    (OUT/'Board'/name).write_text(text,encoding='utf-8')
launcher=(OLD/'Start_Style_Study.ps1').read_text()
launcher=launcher.replace("'..\\..\\..'", "'..\\..\\..\\..'").replace(PREFIX+'/',PREFIX+'/Toon_v2/')
(OUT/'Start_Style_Study.ps1').write_text(launcher)
# Reuse established deformation/export checks, now requiring ZERO geometry offsets.
test=(ROOT/'Scripts/Highhorn_Validate_Style_Study.py').read_text()
test=test.replace("'Exports/StyleStudy/2026-11-02'", "'Exports/StyleStudy/2026-11-02/Toon_v2'")
test=test.replace('Highhorn_Commoner_STYLE_TEST.blend','Highhorn_Commoner_TOON_v2_TEST.blend').replace('commoner-style.glb','commoner-toon.glb')
test=test.replace("(.012 if name == 'Shoulders' else .000001)", '.000001').replace("(.0121 if name == 'Shoulders' else .000002)", '.000002')
test=test.replace("if name != 'char1':\n            image", "if name != 'char1':\n            assert not any(f.use_smooth for f in bpy.data.objects[name].data.polygons)\n            ramp=next(n for n in mat.node_tree.nodes if n.type=='VALTORGB')\n            assert ramp.color_ramp.interpolation=='CONSTANT' and len(ramp.color_ramp.elements)==4\n            assert any(n.bl_idname=='ShaderNodeShaderToRGB' for n in mat.node_tree.nodes)\n            image")
test=test.replace('measured shoulder offsets','zero geometric changes and four-band Eevee nodes')
(ROOT/'Scripts/Highhorn_Validate_Toon_v2.py').write_text(test)
# Flat face normals split runtime vertices; test exact Blender deformation above,
# and each browser model's finite moving vertices independently below.
test=(ROOT/'Scripts/Highhorn_Test_Style_Study.cjs').read_text()
test=test.replace('../Exports/StyleStudy/2026-11-02','../Exports/StyleStudy/2026-11-02/Toon_v2').replace("'9246'", "'9247'")
test=test.replace('http://localhost:8012'+PREFIX+'/', 'http://localhost:8012'+PREFIX+'/Toon_v2/')
test=test.replace('assert.equal(samples[0].length, samples[1].length);','assert(samples.every(points=>points.length>100));')
test=test.replace('difference = Math.max(difference, Math.hypot(...point.map((v, axis) => v - samples[1][i][axis])));','// Correspondence is established in the Blender test; flat normals split vertices.')
test=test.replace("const motion = {}, poses = [];", "const cloth=initial.models[1].meshDetails.filter(m=>m.name!=='char1');\n    assert(cloth.length===4 && cloth.every(m=>m.toon&&m.flat&&m.material==='MeshToonMaterial'));\n    assert(initial.models[1].meshDetails.find(m=>m.name==='char1').material==='MeshStandardMaterial');\n    const motion = {}, poses = [];")
test=test.replace('maximumSourceStyleDifference_m: difference','finiteVertices: true')
test=test.replace('Two synchronized native skinned GLBs over fifteen poses','Four compiled flat toon clothing materials and smooth skin; two synchronized native skinned GLBs over fifteen poses')
(ROOT/'Scripts/Highhorn_Test_Toon_v2.cjs').write_text(test)
print('TOON V2 REVIEW PREPARED')
