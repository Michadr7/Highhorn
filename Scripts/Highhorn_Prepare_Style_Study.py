"""Prepare a read-only board snapshot and isolated material comparison page."""
import json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parent.parent;O=R/'Exports/StyleStudy/2026-11-02';B=O/'Board';B.mkdir(parents=True,exist_ok=True)
files=[R/'index.html',*sorted((R/'js').glob('*.js')),*sorted((R/'css').glob('*.css')),*sorted((R/'Models/Heroes/MaleCommoner').glob('*')),*sorted((R/'assets').glob('*.png'))]
manifest={p.relative_to(R).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}
if not (O/'Production_Before.json').exists():(O/'Production_Before.json').write_text(json.dumps(manifest,indent=2))
base='/Exports/StyleStudy/2026-11-02';source='/Exports/MedievalRoster/2026-11-01/CommonerBoots_v8/approved-male/preview.glb';style=base+'/commoner-style.glb'
config={'source':source,'style':style,'subject':'Male Commoner','sourceBlend':'/Exports/MedievalRoster/2026-11-01/CommonerBoots_v8/approved-male/approved-male_BOOTS_TEST.blend','styleBlend':base+'/Highhorn_Commoner_STYLE_TEST.blend','palette':{'Flax':'#b4aa80','Chestnut':'#80553b','Olive':'#62654e','Umber':'#493d32'}};(O/'study.json').write_text(json.dumps(config,indent=2))
shim='''<script>
(()=>{function storage(){const values=new Map();return {get length(){return values.size},key(i){return [...values.keys()][i]??null},getItem(k){return values.get(String(k))??null},setItem(k,v){values.set(String(k),String(v))},removeItem(k){values.delete(String(k))},clear(){values.clear()}}}Object.defineProperty(window,'localStorage',{value:storage()});Object.defineProperty(window,'sessionStorage',{value:storage()});window.__styleMemoryStorage=true;})();
</script>'''
html=(R/'index.html').read_text();html=html.replace('<head>','<head>\n<base href="/">\n'+shim+'\n<style>body>*:not(#c){display:none!important}#c{display:block!important;position:fixed;inset:0;width:100%;height:100%}</style>');html=html.replace('src="js/game.js?v=0.26.8-commoner3"',f'src="{base}/Board/game.js"').replace('src="js/hero-commoner.js?v=3"',f'src="{base}/Board/hero-commoner.js"').replace('</body>',f'<script src="{base}/Board/fixture.js"></script></body>');(B/'index.html').write_text(html)
(B/'game.js').write_text("if(!window.__styleMemoryStorage)throw Error('Style fixture requires memory-only storage');\n"+(R/'js/game.js').read_text())
js=(R/'js/hero-commoner.js').read_text();js=js.replace('female-commoner','style-proposed').replace('male-commoner','style-original').replace("label:'Male Commoner'","label:'Original fit'").replace("label:'Female Commoner'","label:'Style study'").replace("folder:'FemaleCommoner'","folder:'MaleCommoner'").replace('height:1.68','height:1.8');url="(config.id==='style-proposed'?"+json.dumps(style)+":"+json.dumps(source)+")";js=js.replace("'Models/Heroes/'+config.folder+'/'+config.file",url).replace("'Models/Heroes/'+config.folder+'/commoner-board.glb?v=3'",url);(B/'hero-commoner.js').write_text(js)
print('Prepared isolated board snapshot; original game files untouched')
