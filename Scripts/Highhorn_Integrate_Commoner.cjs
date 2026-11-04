const fs=require('node:fs');
const file='js/game.js';let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
function once(old,value){if(!s.includes(old))throw Error('Missing patch anchor: '+old.slice(0,80));s=s.replace(old,value);}
once("function heroPortrait(L,css,ability,expr){", "function heroPortrait(L,css,ability,expr){\n  if(L&&L.model==='male-commoner') return 'Models/Heroes/MaleCommoner/portrait.png';");
once("function hideLobby(){$('#lobbyScr').hidden=true;controls.autoRotate=false;}", "function hideLobby(){HighhornCommoner.suspend();$('#lobbyScr').hidden=true;controls.autoRotate=false;}");
once("function renderLobby(sec){\n  lbSec=sec;", "function renderLobby(sec){\n  if(sec!=='hero') HighhornCommoner.suspend();\n  lbSec=sec;");
once("  const L=draft.look, css=colorCss(profile.color), lvl=levelInfo(profile.xp).lvl;", "  const L=draft.look, css=colorCss(profile.color), lvl=levelInfo(profile.xp).lvl;\n  if(!L.model) L.model='male-commoner';\n  const commoner=L.model==='male-commoner';\n  if(!commoner) HighhornCommoner.suspend();");
once("$('#lb-hero').innerHTML=`<div class=\"creator\">", "$('#lb-hero').innerHTML=`<div class=\"creator${commoner?' creator--commoner':''}\">");
const previewStart='    <div class="cprev"><div class="bigav">';
const previewEnd='</div><canvas id="cflag"';
const start=s.indexOf(previewStart,s.indexOf('function renderCreator()'));const end=s.indexOf(previewEnd,start);
if(start<0||end<0)throw Error('Missing preview block');
const original=s.slice(start+previewStart.length,end);
s=s.slice(0,start)+'    <div class="cprev">${commoner?\'<div id="commonerMount"></div>\':`<div class="bigav">'+original+'</div>`}<canvas id="cflag"'+s.slice(end+previewEnd.length);
once('    <div class="cform">\n      <label class="lbl" for="cname">', '    <div class="cform">\n      <label class="lbl" for="cmodel">Character</label><select id="cmodel"><option value="male-commoner" ${commoner?\'selected\':\'\'}>Male Commoner · Level 1</option><option value="prototype" ${!commoner?\'selected\':\'\'}>Original prototype</option></select>\n      ${commoner?\'<p class="m commoner-outfit-note">A medieval tunic, trousers, boots and shoulder garment. Customize your name, banner and ability below.</p>\':\'\'}\n      <label class="lbl" for="cname">');
once('      <p class="lbl">Outfit</p>', '      <div class="legacy-appearance" ${commoner?\'hidden\':\'\'}><p class="lbl">Outfit</p>');
once('      <p class="lbl">Banner</p>', '      </div><p class="lbl">Banner</p>');
once("  previewHero=buildHero(L,css,draft.ability,'smile');", "  if(commoner){previewHero=null;HighhornCommoner.mount($('#commonerMount'),{reducedMotion:reduceMotion(),quality:uiPrefs.quality});}\n  else previewHero=buildHero(L,css,draft.ability,'smile');\n  $('#cmodel').addEventListener('change',e=>{L.model=e.target.value;renderCreator();});");
once('cape:r.look.cape,outfit:L.outfit}};renderCreator();', 'cape:r.look.cape,outfit:L.outfit,model:L.model}};renderCreator();');
// The board simulation continues; skip its expensive background draw under the
// full-body creator so the two views do not both consume the graphics budget.
once('  renderer.render(scene,camera);\n}', "  if($('#lobbyScr').hidden||lbSec!=='hero'||!draft||draft.look.model!=='male-commoner') renderer.render(scene,camera);\n}");
fs.writeFileSync(file,s.replace(/\n/g,'\r\n'));
let html=fs.readFileSync('index.html','utf8').replace('css/style.css?v=0.25','css/style.css?v=0.25-commoner1').replace('<script src="js/game.js?v=0.25"></script>','<script src="js/hero-commoner.js?v=1"></script>\n<script src="js/game.js?v=0.25-commoner1"></script>');
fs.writeFileSync('index.html',html);
