"""Small presentation-only integration edits; game rules and stored saves remain intact."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];p=ROOT/'js/game.js';s=p.read_text(encoding='utf-8')
start=s.index('function heroPortrait(');end=s.index('// Rotating full-body preview',start)
s=s[:start]+'''function heroPortrait(L,css,ability,expr){
  // Legacy saves keep all their data; their presentation now uses the whole Commoner.
  return 'Models/Heroes/MaleCommoner/portrait.png';
}
'''+s[end:]
s=s.replace('  const u=h.userData.parts; if(!u) return;',"  if(h.userData.commoner){HighhornCommoner.animateBoard(h,now,walking,reduceMotion());return;}\n  const u=h.userData.parts; if(!u) return;")
s=s.replace('const g=buildHero(L,PLAYERS[p].css,h.ability);','const g=HighhornCommoner.boardHero(p,PLAYERS[p].css);')
s=s.replace("if(!L.model) L.model='male-commoner';","L.model='male-commoner';")
s=s.replace('<option value="prototype" ${!commoner?\'selected\':\'\'}>Original prototype</option>','')
start=s.index('      <div class="legacy-appearance"');end=s.index('<p class="lbl">Banner</p>',start)
s=s[:start]+'      '+s[end:]
# Remove unavailable appearance unlocks from the displayed rewards, while leaving
# their old saved fields intact for compatibility and future character unlocks.
start=s.index('const UNLOCKS=');end=s.index('const ACH=',start)
s=s[:start]+'''const UNLOCKS=[{lvl:2,kind:'sigil',id:'moon',name:'Moon banner'},
  {lvl:3,kind:'sigil',id:'anchor',name:'Anchor banner'},
  {lvl:4,kind:'sigil',id:'flame',name:'Flame banner'}];
'''+s[end:]
p.write_text(s,encoding='utf-8')
p=ROOT/'index.html';s=p.read_text(encoding='utf-8').replace('hero-commoner.js?v=1','hero-commoner.js?v=2').replace('game.js?v=0.26.8-commoner1','game.js?v=0.26.8-commoner2');p.write_text(s,encoding='utf-8')
