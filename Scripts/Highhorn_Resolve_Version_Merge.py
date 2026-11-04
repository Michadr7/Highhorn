from pathlib import Path
import re,subprocess,json,hashlib
ROOT=Path.cwd();GIT=r'C:\Users\Michael\AppData\Local\GitHubDesktop\app-3.6.10\resources\app\git\cmd\git.exe'
def git(*args):return subprocess.check_output([GIT,*args],cwd=ROOT)
css=ROOT/'css/style.css';text=css.read_text(encoding='utf-8-sig')
pattern=r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> origin/main\n?'
matches=list(re.finditer(pattern,text,re.S));assert len(matches)<=1
if matches:
 ours,theirs=matches[0].group(1,2)
 assert 'Accepted Male Commoner' in ours and 'v0.26.8' in theirs
text=re.sub(pattern,lambda m:m.group(2).rstrip()+'\n\n'+m.group(1).rstrip()+'\n',text,flags=re.S)
css.write_text(text,encoding='utf8',newline='\r\n')
html=ROOT/'index.html';text=html.read_text(encoding='utf-8-sig')
assert len(re.findall(pattern,text,re.S))<=1
text=re.sub(pattern,'<link rel="stylesheet" href="css/style.css?v=0.26.8-commoner1">\n',text,flags=re.S)
text=text.replace('js/game.js?v=0.25-commoner1','js/game.js?v=0.26.8-commoner1')
text=text.replace('Version 0.25 · The Highlands await','Version 0.26.8 · The Highlands await')
text=text.replace('Version 0.25, ruleset','Version 0.26.8, ruleset')
html.write_text(text,encoding='utf8',newline='\r\n')
for name in ['index.html','css/style.css','js/game.js']:
 value=(ROOT/name).read_text(encoding='utf-8-sig');assert not re.search(r'^(<<<<<<<|=======|>>>>>>>)',value,re.M)
# Preserve the full newer menu stylesheet and add only our namespaced creator CSS.
remote_css=git('show','origin/main:css/style.css').decode('utf-8-sig').replace('\r\n','\n').rstrip()
actual_css=css.read_text(encoding='utf-8-sig').replace('\r\n','\n')
assert actual_css.startswith(remote_css)
current_js=(ROOT/'js/game.js').read_text(encoding='utf-8-sig')
assert 'ruleGroups=[' in current_js and 'HighhornCommoner.mount' in current_js and "L.model='male-commoner'" in current_js
assert 'lb-logo-image' in html.read_text() and 'js/hero-commoner.js' in html.read_text()
for name in ['worker/index.js','wrangler.jsonc','js/engine.js','js/bots.js','js/sound.js']:
 assert (ROOT/name).read_bytes().replace(b'\r\n',b'\n')==git('show','origin/main:'+name).replace(b'\r\n',b'\n'),name
report={'base':'GitHub main e403c3eb51676e2a34e829a53c6ea0edd90cf4ff (v0.26.8)','branch':'work/commoner-on-v0.26.8','resolved_conflicts':['index.html: combined newer cache version with Commoner script','css/style.css: retained entire newer menu stylesheet, followed by Commoner styles'],'preserved_newer_features':['logo artwork and yak menu background','newer sidebar/menu layout','keyboard-accessible rule topic tabs'],'preserved_integration':['textured Male Commoner model','Rest/Walk/Run controls','saved character choice','existing prototype compatibility'],'rules_worker_deployment_unchanged':True,'browser_saves_not_accessed_or_modified':True,'servers_stopped':True,'runtime_validation':'Not rerun: user requested servers remain closed.'}
(ROOT/'Exports/VersionMergeSafety/Merge_Validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report),flush=True)
