from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'js/hero-commoner.js';s=p.read_text(encoding='utf-8-sig')
s=s.replace("  const assetURL = 'Models/Heroes/MaleCommoner/commoner-idle.glb';",'''  const catalog={
    'male-commoner':{id:'male-commoner',label:'Male Commoner',folder:'MaleCommoner',file:'commoner-idle.glb?v=3',height:1.8},
    'female-commoner':{id:'female-commoner',label:'Female Commoner',folder:'FemaleCommoner',file:'commoner.glb?v=1',height:1.68}
  };
  const resolve=id=>catalog[id]||catalog['male-commoner'];
  let loaderPromise=null;
  function createCharacter(config){
  const assetURL = 'Models/Heroes/'+config.folder+'/'+config.file;''')
s=s.replace('pending = null, loaderPromise = null, active','pending = null, active')
s=s.replace("setNotice('Loading Male Commoner…')","setNotice('Loading '+config.label+'…')")
s=s.replace("setNotice('Loading Male Commoner… '+Math.round(100*event.loaded/event.total)+'%')","setNotice('Loading '+config.label+'… '+Math.round(100*event.loaded/event.total)+'%')")
s=s.replace("setNotice('Male Commoner · Level 1')","setNotice(config.label+' · Level 1')")
s=s.replace("failure='Could not load Male Commoner. Check your connection and try again.'","failure='Could not load '+config.label+'. Check your connection and try again.'")
s=s.replace("    viewport = shell.querySelector", "    shell.querySelector('canvas').setAttribute('aria-label',config.label+' in medieval clothing. Drag to rotate; scroll to zoom.');\n    viewport = shell.querySelector")
s=s.replace("portraitCamera.position.set(.38,1.60,1.5);portraitCamera.lookAt(0,1.52,0);","portraitCamera.position.set(.38,config.height-.20,1.5);portraitCamera.lookAt(0,config.height-.28,0);")
s=s.replace('return {ready:!!root,active,clip:', 'return {model:config.id,ready:!!root,active,clip:')
s=s.replace("'Models/Heroes/MaleCommoner/commoner-board.glb'","'Models/Heroes/'+config.folder+'/commoner-board.glb?v=3'")
s=s.replace("'Models/Heroes/MaleCommoner/portrait.png'","'Models/Heroes/'+config.folder+'/portrait.png'")
s=s.replace('entry={group,marker,placeholder,model:null', 'entry={modelId:config.id,group,marker,placeholder,model:null')
s=s.replace('({slot,ready:!!e.model', '({slot,model:config.id,ready:!!e.model')
s=s.replace("  return {mount,suspend,setClip,inspect,capturePortrait,boardHero,animateBoard,inspectBoard};\n})();",'''  return {mount,suspend,setClip,inspect,capturePortrait,boardHero,animateBoard,inspectBoard};
  }
  const instances=new Map();let activePreview=null;
  function get(id){const config=resolve(id);if(!instances.has(config.id))instances.set(config.id,createCharacter(config));return instances.get(config.id);}
  return {
    mount(host,settings={}){const next=get(settings.model);if(activePreview&&activePreview!==next)activePreview.suspend();activePreview=next;next.mount(host,settings);},
    suspend(){activePreview?.suspend();},setClip(name){activePreview?.setClip(name);},
    inspect(){return activePreview?activePreview.inspect():{ready:false,active:false,error:'',frames:0};},
    capturePortrait(){return activePreview?.capturePortrait()||null;},
    portrait(id){return 'Models/Heroes/'+resolve(id).folder+'/portrait.png';},
    models(){return Object.values(catalog).map(c=>({id:c.id,label:c.label}));},
    boardHero(slot,color,id){return get(id).boardHero(slot,color);},
    animateBoard(group,now,walking,reducedMotion){return get(group.userData.commoner.modelId).animateBoard(group,now,walking,reducedMotion);},
    inspectBoard(){const all=[...instances.values()].map(i=>i.inspectBoard());return {ready:all.some(i=>i.ready),heroes:all.flatMap(i=>i.heroes)};}
  };
})();''')
p.write_text(s,encoding='utf-8')
p=ROOT/'js/game.js';s=p.read_text(encoding='utf-8-sig')
s=s.replace("return 'Models/Heroes/MaleCommoner/portrait.png';","return HighhornCommoner.portrait(L?.model);")
s=s.replace('HighhornCommoner.boardHero(p,PLAYERS[p].css)','HighhornCommoner.boardHero(p,PLAYERS[p].css,L.model)')
s=s.replace("  L.model='male-commoner';\n  const commoner=L.model==='male-commoner';","  if(!HighhornCommoner.models().some(m=>m.id===L.model)) L.model='male-commoner';\n  const commoner=true;")
s=s.replace('<option value="male-commoner" ${commoner?\'selected\':\'\'}>Male Commoner · Level 1</option>',"${HighhornCommoner.models().map(m=>`<option value=\"${m.id}\" ${m.id===L.model?'selected':''}>${m.label} · Level 1</option>`).join('')}")
s=s.replace('{reducedMotion:reduceMotion(),quality:uiPrefs.quality}', '{model:L.model,reducedMotion:reduceMotion(),quality:uiPrefs.quality}')
s=s.replace("||draft.look.model!=='male-commoner'",'')
# New bot characters may use either coherent commoner; old saved identities are
# resolved for display without guessing a gender from their name or old hairstyle.
s=s.replace("look:{skin:pickR(SKINS)","look:{model:pickR(['male-commoner','female-commoner']),skin:pickR(SKINS)")
s=s.replace('look:{skin:h.look.skin,hair:h.look.hair,sigil:h.look.sigil,outfit:null}', 'look:{model:h.look.model,skin:h.look.skin,hair:h.look.hair,sigil:h.look.sigil,outfit:null}')
p.write_text(s,encoding='utf-8')
p=ROOT/'index.html';s=p.read_text(encoding='utf-8-sig').replace('hero-commoner.js?v=2','hero-commoner.js?v=3').replace('game.js?v=0.26.8-commoner2','game.js?v=0.26.8-commoner3');p.write_text(s,encoding='utf-8')
