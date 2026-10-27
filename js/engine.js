/* Highhorn 0.25: rules engine, game data and map generation. Pure: no graphics, no page.
   Files load in this order: engine.js, bots.js, sound.js, game.js. */
'use strict';
const $ = s => document.querySelector(s);
const SQ3 = Math.sqrt(3);

/* =====================================================================
   CONTENT (data with stable ids; ids are never reused)
   ===================================================================== */
const RULESET = '0.20.0';
const RES = {
  timber:  {name:'Timber',  color:'#3d8550'},
  clay:    {name:'Clay',    color:'#bb5a3b'},
  leather: {name:'Leather', color:'#9a6b45'},
  wheat:   {name:'Wheat',   color:'#e0bd45'},
  iron:    {name:'Iron',    color:'#8e98a6'},
  fish:    {name:'Fish',    color:'#4f9fd0'},
};
const LAND = ['timber','clay','leather','wheat','iron'];
const RKEYS = Object.keys(RES);
const TERRAIN = {
  fields:    {name:'Fields',         res:'wheat',   top:0xd6b54a},
  pasture:   {name:'Pasture',        res:'leather', top:0x8cc25e},
  forest:    {name:'Forest',         res:'timber',  top:0x3f7b40},
  hills:     {name:'Hills',          res:'clay',    top:0xb3663f},
  mountains: {name:'Mountains',      res:'iron',    top:0x8a8e95},
  badlands:  {name:'Badlands',       res:null,      top:0xcbb185},
  lake:      {name:'Lake',           res:null,      top:0x4a8fb5},
  frontier:  {name:'Shaggy Peaks',   res:null,      top:0x66604a},
};
const COSTS = {
  road:    {timber:1, clay:1},
  bridge:  {timber:2, clay:1},
  village: {timber:1, clay:1, wheat:1, leather:1},
  city:    {wheat:2, iron:3},
  dev:     {iron:1, wheat:1, leather:1},
  fisher:  {timber:1, leather:1},
  army:    {iron:2, wheat:1},
};
const LIMITS = {road:15, bridge:3, village:5, city:4, fisher:3, army:5, stack:3};
const DEV = {
  vp:      {name:'Victory point',  desc:'Worth 1 point. Kept hidden until it wins you the game.', count:5},
  roads:   {name:'Road building',  desc:'Build 2 roads for free. One may be a bridge.', count:2},
  plenty:  {name:'Year of plenty', desc:'Take any 2 resources from the bank.', count:2},
  scout:   {name:'Scout',          desc:'Move the robber, the wolf or the bandits to any land tile. No card is stolen.', count:3},
  march:   {name:'Forced march',   desc:'This turn, your moving army can go up to 3 roads with no fish cost.', count:2},
  reinf:   {name:'Reinforcements', desc:'Raise 1 army for free on a road next to one of your cities.', count:2},
  rally:   {name:'Rally',          desc:'+1 strength to your attacking army in one battle this turn.', count:2},
  catch:   {name:'Good catch',     desc:'Each of your fishermen catches 1 fish right now, unless blockaded.', count:2},
  switch:  {name:'Ability switch', desc:'Change your hero’s ability.', count:2},
};
const BANK_SIZE = 19, WIN_VP = 10, BASE_TOKENS = [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12];
const TERRAIN_RATIO = {forest:4, pasture:4, fields:4, hills:3, mountains:3};
const SIZE_CFG = {2:{lakes:1,bad:1,rivers:1,gates:3}, 3:{lakes:2,bad:2,rivers:2,gates:4,trim:true}, 4:{lakes:3,bad:3,rivers:3,gates:5}};
const LAKE_TOKENS = [5,9,4,10,3,11];
const EVENTS = {
  wolf:     {name:'Wolf',                desc:'A wolf has settled on a pasture. It produces nothing until the wolf leaves, or an army or a Herder hero moves onto a road around it.'},
  harvest:  {name:'Good harvest',        desc:'Players with a Farmer hero collect double from each fields tile the next time it’s rolled.'},
  calving:  {name:'Calving season',      desc:'Players with a Herder hero collect double from each pasture the next time it’s rolled.'},
  fishrun:  {name:'Fish run',            desc:'For a full round, fishermen of players with an Angler hero catch 1 extra fish.'},
  commission:{name:'Royal commission',   desc:'Players with an Engineer hero build their next road or bridge for free (within 2 rounds).'},
  muster:   {name:'Call to arms',        desc:'Players with a Warlord hero raise their next army for free (within 2 rounds).'},
  merchant: {name:'Travelling merchant', desc:'Players with a Merchant hero trade with the bank at 3:1 until the player who rolled starts their next turn.'},
  bandits:  {name:'Bandits',             desc:'Bandits block a hills or mountains tile. They move on after a few rolls, or when an army or a Warlord hero moves onto a road around it.'},
  storm:    {name:'Lake storm',          desc:'No fishing for a full round, until the player who rolled gets their next turn. Anglers still fish.'},
  flood:    {name:'Flood',               desc:'Armies and heroes can’t cross bridges for the next 2 rolls, except for Engineers.'},
};
const PALETTE = [
  {name:'Red',    color:0xd8332a, css:'#d8332a'},
  {name:'Blue',   color:0x1f5bd6, css:'#1f5bd6'},
  {name:'White',  color:0xf6f4ee, css:'#f6f4ee'},
  {name:'Orange', color:0xf28a12, css:'#f28a12'},
  {name:'Purple', color:0x8a3fd0, css:'#8a3fd0'},
  {name:'Pink',   color:0xe8459e, css:'#e8459e'},
];
const ABILITIES = {
  farmer:   {name:'Farmer',   letter:'F', color:'#c99a1e', desc:'Fields touching your hero’s road pay you +1 wheat when rolled. Only Farmers profit from a good harvest.'},
  herder:   {name:'Herder',   letter:'H', color:'#9a6b45', desc:'Pastures touching your hero’s road pay you +1 leather when rolled. Your hero can chase off the wolf. Only Herders profit from calving season.'},
  angler:   {name:'Angler',   letter:'A', color:'#3d7fa8', desc:'Your fishermen on a lake touching your hero’s road catch +1 fish. Your fishermen keep fishing in a lake storm. Only Anglers profit from a fish run.'},
  engineer: {name:'Engineer', letter:'E', color:'#6b6f78', desc:'Bridges cost you 1 timber less. Your armies and hero can cross bridges during a flood. Only Engineers profit from a royal commission.'},
  merchant: {name:'Merchant', letter:'M', color:'#7a4fa3', desc:'You can trade at any trade post or river port your hero’s road leads into. Only Merchants profit from the travelling merchant.'},
  warlord:  {name:'Warlord',  letter:'W', color:'#8a2f2f', desc:'Your army on your hero’s road gets +1 strength. Your hero can drive off bandits. Only Warlords profit from a call to arms.'},
};
const HERO_MOVES = 2;
// Named AI opponents. p = personality: aggr (armies and sieges), armies (extra armies wanted), tradeT (how hard to please in trades),
// offers (offers per turn), counter (chance to counter instead of declining), leaderHate (how much they target the leader),
// plan (how far ahead they plan roads), roadBias, cityBias, devBias, fishBias.
const AI_DEFS = {
  aracanus:{name:'Aracanus',title:'the Ageless Blade',diff:'Hard',ability:'warlord',
    look:{skin:'#d9ae86',hair:'#d9d4cc',hairStyle:'long',headwear:'circlet',cape:true,outfit:'#26262b',sigil:'flame'},
    bio:'A crossover from Perisno. He claims to come from a time when only the gods walked the earth, and carries Flamebringer, the blade his ancestor forged. A patient tactician: he raises armies early, besieges the leader and rarely trades.',
    p:{aggr:1.2,armies:1,tradeT:0.2,offers:1,counter:0.3,leaderHate:1.5,plan:5,cityBias:1,fishBias:0.5,hard:1}},
  corra:{name:'Corra',title:'of the Golden Fields',diff:'Hard',ability:'farmer',
    look:{skin:'#f1d1b5',hair:'#c8a25a',hairStyle:'long',headwear:'none',cape:false,outfit:'#c9a227',sigil:'sun'},
    bio:'Runs the richest farmsteads in Highhorn and wants a city on every hill. Plays efficiently, trades shrewdly and buys development cards.',
    p:{aggr:0.4,armies:0,tradeT:0.1,offers:1,counter:0.6,leaderHate:1.3,plan:5,cityBias:1,devBias:0.2,fishBias:0.5,hard:1}},
  brannoc:{name:'Brannoc',title:'the Bridgewright',diff:'Normal',ability:'engineer',
    look:{skin:'#b07d56',hair:'#6b4423',hairStyle:'short',headwear:'hat',cape:false,outfit:'#8a5a2b',sigil:'anchor'},
    bio:'Has built a bridge over every river in Highhorn and means to build the rest. Races for Longest Road and the best corners.',
    p:{aggr:0.5,armies:0,tradeT:0.1,offers:1,counter:0.5,leaderHate:1,plan:6,roadBias:1}},
  sella:{name:'Sella',title:'Silvertongue',diff:'Normal',ability:'merchant',
    look:{skin:'#d9ae86',hair:'#a8442a',hairStyle:'braids',headwear:'none',cape:true,outfit:'#40576e',sigil:'crown'},
    bio:'Travels the mountain passes with a cart of everything. Trades constantly, but always asks a little more than it is worth.',
    p:{aggr:0.3,armies:0,tradeT:0.35,offers:2,counter:0.95,leaderHate:1,plan:4,devBias:0.3}},
  fen:{name:'Fen',title:'of the Still Lakes',diff:'Normal',ability:'angler',
    look:{skin:'#7a4f33',hair:'#2b211b',hairStyle:'bald',headwear:'hat',cape:false,outfit:'#3d6b4a',sigil:'wave'},
    bio:'Would rather fish than fight. Settles by the lakes, hires fishermen early and trades fish for almost anything.',
    p:{aggr:0.2,armies:-1,tradeT:0,offers:1,counter:0.4,leaderHate:0.8,plan:4,fishBias:1,devBias:0.2}},
  moira:{name:'Old Moira',title:'the Yak-wife',diff:'Easy',ability:'herder',
    look:{skin:'#f1d1b5',hair:'#d9d4cc',hairStyle:'bun',headwear:'hood',cape:false,outfit:'#6b4a8a',sigil:'moon'},
    bio:'Has herded yaks on the high pastures longer than anyone remembers. Generous with trades, slow to anger, and never raises a sword.',
    p:{aggr:0,armies:-3,tradeT:-0.3,offers:2,counter:0.3,leaderHate:0.6,plan:3,devBias:0.2}},
};
const PLAYERS = [
  {name:'Red',    color:0xc8403a, css:'#c8403a'},
  {name:'Blue',   color:0x2f63b8, css:'#2f63b8'},
  {name:'White',  color:0xf6f4ee, css:'#f6f4ee'},
  {name:'Orange', color:0xe08a2c, css:'#e08a2c'},
];
const pips = n => n ? 6 - Math.abs(7 - n) : 0;
const rname = r => RES[r].name.toLowerCase();
const costText = c => Object.entries(c).map(([r,n])=>`${n} ${rname(r)}`).join(', ');

/* =====================================================================
   RANDOMNESS
   ===================================================================== */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function makeNoise(seed){
  const h=(x,y)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed|0,1442695041);n=Math.imul(n^(n>>>13),1274126177);n^=n>>>16;return (n>>>0)/4294967295;};
  const v=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    const a=h(ix,iy),b=h(ix+1,iy),c=h(ix,iy+1),d=h(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;};
  return (x,y)=>v(x,y)*0.57+v(x*2.1+17,y*2.1+9)*0.29+v(x*4.3+31,y*4.3+5)*0.14;
}

/* =====================================================================
   BOARD GENERATION (pure: no graphics)
   ===================================================================== */
const Board = (() => {
  const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  function generate(seedStr, R, balanced, style='classic'){
    const base=SIZE_CFG[R], cfg=Object.assign({},base);
    if(style==='rivers') cfg.rivers=base.rivers+2;
    if(style==='lakeland'){cfg.lakes=base.lakes+(R>=3?2:1);cfg.rivers=base.rivers+1;}
    if(style==='rugged') cfg.bad=base.bad+1;
    const seedNum=hashStr(seedStr+'#'+R);
    const rng=mulberry32(seedNum);
    const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
    const noiseE=makeNoise(seedNum), noiseM=makeNoise(seedNum^0x27d4eb2d);
    const B={R,cfg,style,seed:seedStr,tiles:[],tileMap:new Map(),corners:new Map(),edges:new Map(),rivers:[]};
    const {tiles,tileMap,corners,edges}=B;
    const nb=t=>DIRS.map(([dq,dr])=>tileMap.get((t.q+dq)+','+(t.r+dr))).filter(Boolean);
    B.nb=nb;
    const isLand=t=>!t.rim&&t.terrain!=='lake';
    const RR=R+1;
    const inside=(q,r)=>{const s=-q-r,d=(Math.abs(q)+Math.abs(r)+Math.abs(s))/2;if(d>R) return false;
      return !(cfg.trim&&d===R&&[q,r,s].filter(v=>Math.abs(v)===R).length===2);};
    for(let q=-RR;q<=RR;q++) for(let r=Math.max(-RR,-q-RR);r<=Math.min(RR,-q+RR);r++){
      const ins=inside(q,r); if(!ins&&!DIRS.some(([dq,dr])=>inside(q+dq,r+dr))) continue;
      const x=SQ3*(q+r/2), z=1.5*r, dist=(Math.abs(q)+Math.abs(r)+Math.abs(q+r))/2;
      const t={q,r,key:q+','+r,x,z,dist,rim:!ins,terrain:ins?null:'frontier',num:0,corners:[],edges:[]};
      tiles.push(t); tileMap.set(t.key,t);
    }
    for(const t of tiles){
      for(let i=0;i<6;i++){
        const a=i*Math.PI/3, cx=t.x+Math.sin(a), cz=t.z+Math.cos(a);
        const k=Math.round(cx*1000)+':'+Math.round(cz*1000);
        let c=corners.get(k);
        if(!c){c={key:k,x:cx,z:cz,tiles:[],adj:new Set(),edges:[],building:null,port:null,river:false,riverEnd:false};corners.set(k,c);}
        c.tiles.push(t); t.corners.push(k);
      }
      for(let i=0;i<6;i++){
        const a=t.corners[i], b=t.corners[(i+1)%6], k=a<b?a+'|'+b:b+'|'+a;
        let e=edges.get(k);
        if(!e){e={key:k,a,b,tiles:[],road:null,gate:null,river:false};edges.set(k,e);
          corners.get(a).adj.add(b);corners.get(b).adj.add(a);corners.get(a).edges.push(k);corners.get(b).edges.push(k);}
        e.tiles.push(t); t.edges.push(k);
      }
    }
    const inner=tiles.filter(t=>!t.rim), off=rng()*100;
    inner.forEach(t=>{t.e0=noiseE(t.x*0.2+off,t.z*0.2+off);t.m0=noiseM(t.x*0.22-off,t.z*0.22+off);});
    const rank=(from,to)=>{const s=[...inner].sort((a,b)=>a[from]-b[from]);s.forEach((t,i)=>t[to]=s.length>1?i/(s.length-1):0.5);};
    rank('e0','e'); rank('m0','m');
    // Lakes
    let lakes=0;
    for(const t of [...inner].sort((a,b)=>a.e-b.e)){
      if(lakes>=cfg.lakes) break;
      if(t.dist>=R&&R>2) continue;
      if(nb(t).some(n=>n.terrain==='lake')) continue;
      t.terrain='lake'; lakes++;
    }
    // Rivers along edges: from a frontier spring to a lake, or off the map
    const lakeTiles=tiles.filter(t=>t.terrain==='lake');
    const okEdge=e=>e.tiles.length===2&&e.tiles.every(isLand);
    const frontierCorner=c=>c.tiles.some(t=>t.rim)&&c.tiles.some(isLand)&&!c.tiles.some(t=>t.terrain==='lake')&&!c.river;
    for(let i=0;i<cfg.rivers;i++){
      const toLake=lakeTiles.length&&(i%2===0||rng()<0.4);
      const lake=toLake?lakeTiles[i%lakeTiles.length]:null;
      const starts=[...corners.values()].filter(frontierCorner);
      shuffle(starts);
      const w=new Map(); for(const e of edges.values()) w.set(e.key,1+rng()*1.6);
      let path=null, end=null;
      for(const s of starts.slice(0,8)){
        let targets;
        if(lake){ if(Math.hypot(s.x-lake.x,s.z-lake.z)<2.5) continue; targets=new Set(lake.corners.filter(k=>!corners.get(k).river)); }
        else targets=new Set([...corners.values()].filter(c=>frontierCorner(c)&&c!==s&&Math.hypot(c.x-s.x,c.z-s.z)>R*1.6).map(c=>c.key));
        const p=dijkstra(B,s.key,targets,w,okEdge,isLand);
        if(p&&p.length>=4){path=p;break;}
      }
      if(!path) continue;
      path.forEach(k=>corners.get(k).river=true);
      const first=corners.get(path[0]), last=corners.get(path[path.length-1]);
      first.riverEnd=true; last.riverEnd=true;
      const segs=[];
      for(let j=0;j<path.length-1;j++){const e=edgeBetween(B,path[j],path[j+1]);e.river=true;segs.push(e);}
      B.rivers.push({corners:path,edges:segs,lake,offMap:!lake});
    }
    // Badlands, then producing terrain by quota
    const land=inner.filter(t=>!t.terrain);
    const dry=land.filter(t=>!t.edges.some(k=>edges.get(k).river)).sort((a,b)=>a.m-b.m);
    for(let i=0,placed=0;i<dry.length&&placed<cfg.bad;i++){if(nb(dry[i]).some(n=>n.terrain==='badlands')) continue;dry[i].terrain='badlands';placed++;}
    const prod=land.filter(t=>!t.terrain), P=prod.length, quota={}; let used=0;
    for(const k in TERRAIN_RATIO){quota[k]=Math.floor(P*TERRAIN_RATIO[k]/18);used+=quota[k];}
    // rugged highlands trade some fields and pasture for hills and mountains
    if(style==='rugged'){const m=Math.max(1,Math.round(P/14));for(let i=0;i<m;i++){if(quota.fields>2){quota.fields--;quota.mountains++;} if(quota.pasture>2){quota.pasture--;quota.hills++;}}}
    const order=['forest','pasture','fields','hills','mountains'];
    for(let i=0;used<P;i++,used++) quota[order[i%5]]++;
    const score={mountains:t=>t.e, forest:t=>t.m*0.75+(1-Math.abs(t.e-0.55))*0.25, hills:t=>(1-t.m)*0.5+t.e*0.5, fields:t=>(1-t.e)*0.6+(1-Math.abs(t.m-0.45))*0.4};
    let pool=[...prod];
    for(const k of ['mountains','forest','hills','fields']){
      pool.map(t=>({t,s:score[k](t)*0.6+rng()})).sort((a,b)=>b.s-a.s).slice(0,quota[k]).forEach(o=>o.t.terrain=k);
      pool=pool.filter(t=>!t.terrain);
    }
    pool.forEach(t=>t.terrain='pasture');
    // Spread terrain out: swap tiles while it reduces same-terrain neighbours
    const sameAdj=()=>{let s=0;for(const t of prod) for(const n of nb(t)) if(n.terrain===t.terrain) s++;return s/2;};
    let sc=sameAdj();
    if(style==='clustered'){
      // clustered: swap tiles while it increases same-terrain neighbours, forming regions
      for(let k=0;k<6000&&sc<Math.round(P*0.75);k++){
        const a=prod[Math.floor(rng()*P)], b=prod[Math.floor(rng()*P)];
        if(a.terrain===b.terrain) continue;
        [a.terrain,b.terrain]=[b.terrain,a.terrain];
        const ns=sameAdj(); if(ns>=sc) sc=ns; else [a.terrain,b.terrain]=[b.terrain,a.terrain];
      }
    } else
    for(let k=0;k<6000&&sc>Math.round(P*0.1);k++){
      const a=prod[Math.floor(rng()*P)], b=prod[Math.floor(rng()*P)];
      if(a.terrain===b.terrain) continue;
      [a.terrain,b.terrain]=[b.terrain,a.terrain];
      const ns=sameAdj(); if(ns<=sc) sc=ns; else [a.terrain,b.terrain]=[b.terrain,a.terrain];
    }
    tiles.forEach(t=>t.rimH=t.rim?0.5+rng()*0.12:0);
    placeTokens(B,prod,balanced,rng,shuffle);
    {const lt=shuffle([...LAKE_TOKENS]); tiles.filter(t=>t.terrain==='lake').forEach((t,i)=>t.num=lt[i%lt.length]);}
    for(const c of corners.values()) c.valid=c.tiles.some(isLand);
    for(const e of edges.values()) e.valid=e.tiles.some(isLand)&&corners.get(e.a).valid&&corners.get(e.b).valid;
    // Trade posts: mountain-pass gates, and river ports where rivers leave the map
    const types=[]; const resShuf=shuffle([...LAND]);
    const total=cfg.gates+B.rivers.filter(r=>r.offMap).length;
    for(let i=0;i<total;i++) types.push(i%2===0?'any':resShuf[(i>>1)%5]);
    shuffle(types);
    let ti=0;
    for(const rv of B.rivers.filter(r=>r.offMap)){const c=corners.get(rv.corners[rv.corners.length-1]);c.port=types[ti++];c.riverPort=true;}
    const cand=[...edges.values()].filter(e=>e.tiles.length===2&&e.tiles.filter(t=>t.rim).length===1&&e.tiles.filter(isLand).length===1&&!corners.get(e.a).river&&!corners.get(e.b).river&&!corners.get(e.a).port&&!corners.get(e.b).port)
      .map(e=>{const a=corners.get(e.a),b=corners.get(e.b);return {e,ang:Math.atan2((a.z+b.z)/2,(a.x+b.x)/2)};});
    // Spread posts evenly around the map: each new post goes where it is farthest from the others
    const angOf=c=>Math.atan2(c.z,c.x), adiff=(x,y)=>{const d=Math.abs(x-y)%(Math.PI*2);return Math.min(d,Math.PI*2-d);};
    const placed=B.rivers.filter(r=>r.offMap).map(r=>angOf(corners.get(r.corners[r.corners.length-1])));
    for(let i=0;i<cfg.gates&&cand.length;i++){
      let best=null,bs=-1;
      for(const o of cand){
        if(o.e.gate||[o.e.a,o.e.b].some(k=>[...corners.get(k).adj].some(n=>corners.get(n).port))) continue;
        const s=(placed.length?Math.min(...placed.map(p=>adiff(p,o.ang))):Math.PI)+rng()*0.25;
        if(s>bs){bs=s;best=o;}
      }
      if(!best) break;
      const e=best.e; placed.push(best.ang);
      e.gate=types[ti++]; corners.get(e.a).port=e.gate; corners.get(e.b).port=e.gate;
    }
    B.isLand=isLand;
    return B;
  }
  function edgeBetween(B,a,b){return B.edges.get(a<b?a+'|'+b:b+'|'+a);}
  function dijkstra(B,start,targets,w,ok,isLand){
    const dist=new Map([[start,0]]), prev=new Map(), done=new Set();
    for(;;){
      let cur=null,cd=Infinity;
      for(const [k,d] of dist) if(!done.has(k)&&d<cd){cd=d;cur=k;}
      if(cur===null) return null;
      if(targets.has(cur)){const p=[cur];while(prev.has(p[0]))p.unshift(prev.get(p[0]));return p;}
      done.add(cur);
      for(const ek of B.corners.get(cur).edges){
        const e=B.edges.get(ek), o=e.a===cur?e.b:e.a, oc=B.corners.get(o);
        if(done.has(o)) continue;
        const toT=targets.has(o);
        if(!toT&&(!ok(e)||oc.river||oc.tiles.some(t=>t.rim||t.terrain==='lake'))) continue;
        if(toT&&!ok(e)) continue;
        const nd=cd+w.get(ek);
        if(nd<(dist.has(o)?dist.get(o):Infinity)){dist.set(o,nd);prev.set(o,cur);}
      }
    }
  }
  function balanceStats(list){
    const s={}; RKEYS.forEach(k=>s[k]={tiles:0,pips:0});
    list.forEach(t=>{const r=TERRAIN[t.terrain].res;if(r){s[r].tiles++;s[r].pips+=pips(t.num);}});
    let tt=0,tp=0; RKEYS.forEach(k=>{tt+=s[k].tiles;tp+=s[k].pips;});
    const mean=tp/Math.max(1,tt), avgs=RKEYS.filter(k=>s[k].tiles).map(k=>s[k].pips/s[k].tiles);
    return {per:s, spread:(Math.max(...avgs)-Math.min(...avgs))/mean};
  }
  function placeTokens(B,list,balanced,rng,shuffle){
    const n=list.length; let base=[]; while(base.length<n) base=base.concat(BASE_TOKENS);
    const hot=t=>t.num===6||t.num===8;
    let best=null,bestDev=Infinity;
    for(let k=0;k<(balanced?600:120);k++){
      // place the 6s and 8s first: never on mountains (iron), never next to each other
      shuffle(base); const nums=base.slice(0,n), hots=nums.filter(x=>x===6||x===8), rest=nums.filter(x=>x!==6&&x!==8);
      list.forEach(t=>t.num=0);
      const cand=shuffle(list.filter(t=>t.terrain!=='mountains'));
      let hi=0; for(const t of cand){if(hi>=hots.length) break; if(B.nb(t).some(hot)) continue; t.num=hots[hi++];}
      if(hi<hots.length) continue;
      const free=shuffle(list.filter(t=>!t.num)); free.forEach((t,i)=>t.num=rest[i]);
      const placed=list.map(t=>t.num);
      if(!balanced){best=placed;break;}
      const d=balanceStats(list).spread; if(d<bestDev){bestDev=d;best=placed;}
    }
    if(!best) best=base.slice(0,n);
    list.forEach((t,i)=>t.num=best[i]);
    if(!balanced) return;
    const redOk=t=>!hot(t)||(t.terrain!=='mountains'&&!B.nb(t).some(hot));
    let cur=balanceStats(list).spread;
    for(let k=0;k<4000&&cur>0.02;k++){
      const a=list[Math.floor(rng()*n)], b=list[Math.floor(rng()*n)];
      if(a===b||a.num===b.num||a.terrain===b.terrain) continue;
      [a.num,b.num]=[b.num,a.num];
      const d=balanceStats(list).spread;
      if(d<cur&&redOk(a)&&redOk(b)&&B.nb(a).every(redOk)&&B.nb(b).every(redOk)) cur=d;
      else [a.num,b.num]=[b.num,a.num];
    }
  }
  return {generate, edgeBetween, balanceStats};
})();

/* =====================================================================
   RULES ENGINE (pure: knows nothing about graphics or the page)
   Every game records the ruleset it started with.
   ===================================================================== */
const Engine = (() => {
  const other=(e,k)=>e.a===k?e.b:e.a;
  const total=h=>RKEYS.reduce((s,r)=>s+h[r],0);
  function newGame(B, np, seed, heroes, opts={}){
    const rng=mulberry32(hashStr(seed+'|game|'+np));
    const deck=[]; for(const k in DEV) for(let i=0;i<DEV[k].count;i++) deck.push(k);
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    let contenders=[...Array(np).keys()]; const firstRolls=[];
    for(;;){const r=contenders.map(p=>{const a=1+Math.floor(rng()*6),b=1+Math.floor(rng()*6);return {p,a,b,v:a+b};});firstRolls.push(r);
      const max=Math.max(...r.map(x=>x.v)); contenders=r.filter(x=>x.v===max).map(x=>x.p); if(contenders.length===1) break;}
    const first=contenders[0];
    const order=[]; for(let i=0;i<np;i++) order.push((first+i)%np); for(let i=np-1;i>=0;i--) order.push((first+i)%np);
    const G={ruleset:RULESET,B,np,rng,
      players:Array.from({length:np},(_,p)=>({hand:Object.fromEntries(RKEYS.map(r=>[r,0])),dev:[],newDev:[],played:0,bot:!!(opts.bots&&opts.bots[p]),ai:(opts.ai&&opts.ai[p])||null})),
      cur:first, first, firstRolls, phase:'setup', setup:{order,i:0,step:'village',last:null},
      bank:Object.fromEntries(RKEYS.map(r=>[r,BANK_SIZE])), deck, devPlayed:false, freeRoads:0, dice:null,
      robber:B.tiles.find(t=>t.terrain==='badlands')||null, longest:{holder:null,len:Array(np).fill(0)},
      discard:[], stealFrom:[], returnPhase:null, winner:null, turnNo:0, log:[],
      opts, diceDeck:[], sevens:0, stats:Array.from({length:np},()=>({collected:0,stole:0,robbed:0,won:0,lost:0,trades:0,devBought:0,devPlayed:0})),
      events:{}, armyHolder:null, mover:null, march:false, rally:false, freeArmy:0, scoutTarget:null};
    G.heroes=Array.from({length:np},(_,p)=>Object.assign({name:'Hero',ability:'farmer',look:{}},heroes&&heroes[p]||{},{edge:null,home:null,moves:0,wounded:false}));
    log(G,`A new game for ${np} players. Place your starting villages and roads. Each hero joins at their player’s first road.`);
    return G;
  }
  function log(G,msg){G.log.push(msg);}
  // Balanced dice: a shuffled deck of all 36 dice outcomes, reshuffled when 5 are left,
  // and never a third 7 in a row. Plain dice when the option is off.
  function drawDice(G){
    if(!G.opts||!G.opts.diceDeck) return [1+Math.floor(G.rng()*6),1+Math.floor(G.rng()*6)];
    if(G.diceDeck.length<=5){G.diceDeck=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)G.diceDeck.push([a,b]);
      for(let i=G.diceDeck.length-1;i>0;i--){const j=Math.floor(G.rng()*(i+1));[G.diceDeck[i],G.diceDeck[j]]=[G.diceDeck[j],G.diceDeck[i]];}}
    let i=G.diceDeck.length-1;
    if(G.sevens>=2&&G.diceDeck[i][0]+G.diceDeck[i][1]===7){const j=G.diceDeck.findIndex(d=>d[0]+d[1]!==7);if(j>=0)[G.diceDeck[i],G.diceDeck[j]]=[G.diceDeck[j],G.diceDeck[i]];}
    return G.diceDeck.pop();
  }
  const pname=p=>PLAYERS[p].label||PLAYERS[p].name;
  function canAfford(G,p,cost){return Object.entries(cost).every(([r,n])=>G.players[p].hand[r]>=n);}
  function pay(G,p,cost){for(const [r,n] of Object.entries(cost)){G.players[p].hand[r]-=n;G.bank[r]+=n;}}
  function take(G,p,r,n){const k=Math.min(n,G.bank[r]);G.bank[r]-=k;G.players[p].hand[r]+=k;return k;}
  function count(G,p,kind){
    let n=0;
    if(kind==='fisher'){for(const c of G.B.corners.values()) if(c.fisher&&c.building&&c.building.p===p) n++;return n;}
    if(kind==='army'){for(const e of G.B.edges.values()) if(e.army&&e.army.p===p) n+=e.army.n;return n;}
    if(kind==='village'||kind==='city'){for(const c of G.B.corners.values()) if(c.building&&c.building.p===p&&c.building.type===kind) n++;}
    else for(const e of G.B.edges.values()) if(e.road&&e.road.p===p&&(kind==='bridge')===!!e.river) n++;
    return n;
  }
  function vp(G,p,withHidden){
    let v=0;
    for(const c of G.B.corners.values()) if(c.building&&c.building.p===p) v+=c.building.type==='city'?2:1;
    if(G.longest.holder===p) v+=2;
    if(G.armyHolder===p) v+=2;
    if(withHidden) v+=[...G.players[p].dev,...G.players[p].newDev].filter(d=>d==='vp').length;
    return v;
  }
  const isMine=(G,p,c)=>c.building&&c.building.p===p;
  function touchesOwnRoad(G,p,c){return c.edges.some(k=>{const e=G.B.edges.get(k);return e.road&&e.road.p===p;});}
  function roadConnects(G,p,e){
    return [e.a,e.b].some(k=>{const c=G.B.corners.get(k);
      if(c.building) return c.building.p===p;
      return c.edges.some(ok=>{const o=G.B.edges.get(ok);return o!==e&&o.road&&o.road.p===p;});});
  }
  // A plain road may not cross a river at its spring or mouth, unless a bridge there already spans it.
  function crossesRiverEnd(G,e){
    if(e.river) return false;
    return [e.a,e.b].some(k=>{const c=G.B.corners.get(k);if(!c.riverEnd) return false;
      if(c.edges.some(ok=>{const o=G.B.edges.get(ok);return o.river&&o.road;})) return false;
      return c.edges.some(ok=>{const o=G.B.edges.get(ok);return o!==e&&!o.river&&o.road;});});
  }
  function distanceOk(G,c){return ![...c.adj].some(k=>G.B.corners.get(k).building);}

  /* ---- legality: return a reason string, or null when allowed ---- */
  function whyNotVillage(G,p,c,ignoreCost){
    if(!c.valid) return 'Villages need at least one land tile next to them.';
    if(c.building) return 'This corner is taken.';
    if(!distanceOk(G,c)) return 'Too close: leave one empty corner between villages.';
    if(G.phase==='setup') return null;
    if(!touchesOwnRoad(G,p,c)) return 'New villages must be on one of your roads.';
    if(count(G,p,'village')>=LIMITS.village) return `You have no villages left (limit ${LIMITS.village}).`;
    if(!ignoreCost&&!canAfford(G,p,COSTS.village)) return `A village costs ${costText(COSTS.village)}.`;
    return null;
  }
  function whyNotRoad(G,p,e,ignoreCost){
    if(!e.valid) return 'Roads need land on at least one side.';
    if(e.road) return 'There is already a road here.';
    if(G.phase==='setup'){
      if(e.river) return 'Starting roads can’t be bridges.';
      if(e.a!==G.setup.last&&e.b!==G.setup.last) return 'Your starting road must touch the village you just placed.';
      if(crossesRiverEnd(G,e)) return 'That would cross the river where it starts or ends.';
      return null;
    }
    if(crossesRiverEnd(G,e)) return 'That would cross the river where it starts or ends. Build a bridge on the river here first, then the road can join it.';
    if(!roadConnects(G,p,e)) return 'Roads must join your own road, village or city. Another player’s village cuts the road.';
    const kind=e.river?'bridge':'road';
    if(count(G,p,kind)>=LIMITS[kind]) return `You have no ${kind}s left (limit ${LIMITS[kind]}).`;
    if(!ignoreCost&&G.freeRoads===0&&!hasCredit(G,p,'commission')&&!canAfford(G,p,costFor(G,p,kind))) return `A ${kind} costs ${costText(costFor(G,p,kind))}.`;
    return null;
  }
  function whyNotCity(G,p,c,ignoreCost){
    if(!c.building||c.building.p!==p||c.building.type!=='village') return 'Cities are built by upgrading one of your villages.';
    if(count(G,p,'city')>=LIMITS.city) return `You have no cities left (limit ${LIMITS.city}).`;
    if(!ignoreCost&&!canAfford(G,p,COSTS.city)) return `A city costs ${costText(COSTS.city)}.`;
    return null;
  }
  const legal={
    village:(G,p)=>[...G.B.corners.values()].filter(c=>!whyNotVillage(G,p,c,true)),
    road:(G,p)=>[...G.B.edges.values()].filter(e=>!whyNotRoad(G,p,e,true)),
    city:(G,p)=>[...G.B.corners.values()].filter(c=>!whyNotCity(G,p,c,true)),
    robber:(G)=>{
      const all=G.B.tiles.filter(t=>G.B.isLand(t)&&t!==G.robber);
      if(!G.opts||!G.opts.friendly) return all;
      // Friendly robber: no tile touching another player with 2 or fewer points
      const ok=all.filter(t=>!t.corners.some(k=>{const c=G.B.corners.get(k);return c.building&&c.building.p!==G.cur&&vp(G,c.building.p,false)<=2;}));
      return ok.length?ok:all;
    },
  };

  /* ---- actions: return a reason string on failure, or a result object ---- */
  function placeVillage(G,c){
    const p=G.cur, why=whyNotVillage(G,p,c); if(why) return {err:why};
    if(G.phase==='setup'){
      if(G.setup.step!=='village') return {err:'Place your road first.'};
      c.building={p,type:'village'}; G.setup.last=c.key; G.setup.step='road';
      const gains=[];
      if(G.setup.i>=G.np) c.tiles.forEach(t=>{const r=TERRAIN[t.terrain].res; if(r&&take(G,p,r,1)) gains.push({p,res:r,n:1,tile:t,corner:c});});
      log(G,`${pname(p)} founds a village${gains.length?' and collects '+gains.map(g=>rname(g.res)).join(', '):''}.`);
      updateLongest(G); return {gains};
    }
    if(G.phase!=='main') return {err:'Roll the dice first.'};
    pay(G,p,COSTS.village); c.building={p,type:'village'};
    log(G,`${pname(p)} builds a village.`); updateLongest(G); checkWin(G); return {};
  }
  function placeRoad(G,e){
    const p=G.cur, why=whyNotRoad(G,p,e); if(why) return {err:why};
    const kind=e.river?'bridge':'road';
    if(G.phase==='setup'){
      if(G.setup.step!=='road') return {err:'Place your village first.'};
      if(G.setup.i<G.np){G.heroes[p].edge=e.key;G.heroes[p].home=G.setup.last;log(G,`${G.heroes[p].name} the ${ABILITIES[G.heroes[p].ability].name} arrives.`);}
      e.road={p}; G.setup.step='village'; G.setup.last=null; G.setup.i++;
      log(G,`${pname(p)} builds a road.`);
      if(G.setup.i>=G.setup.order.length){G.phase='roll';G.cur=G.first;G.turnNo=1;log(G,`Setup is done. ${pname(G.first)} rolls first.`);}
      else G.cur=G.setup.order[G.setup.i];
      updateLongest(G); return {};
    }
    if(G.phase!=='main') return {err:'Roll the dice first.'};
    if(G.freeRoads>0) G.freeRoads--; else if(hasCredit(G,p,'commission')) useCredit(G,p,'commission'); else pay(G,p,costFor(G,p,kind));
    e.road={p}; log(G,`${pname(p)} builds a ${kind}.`);
    if(G.freeRoads>0&&legal.road(G,p).length===0) G.freeRoads=0;
    updateLongest(G); checkWin(G); return {};
  }
  function placeCity(G,c){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    const why=whyNotCity(G,p,c); if(why) return {err:why};
    pay(G,p,COSTS.city); c.building.type='city'; log(G,`${pname(p)} upgrades a village to a city.`); checkWin(G); return {};
  }
  function buyDev(G){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    if(!G.deck.length) return {err:'The development deck is empty.'};
    if(!canAfford(G,p,COSTS.dev)) return {err:`A development card costs ${costText(COSTS.dev)}.`};
    pay(G,p,COSTS.dev); const card=G.deck.pop(); G.players[p].newDev.push(card); G.stats[p].devBought++;
    log(G,`${pname(p)} buys a development card.`); checkWin(G); return {card};
  }
  function playDev(G,type,args={}){
    const p=G.cur, P=G.players[p];
    if(G.phase!=='main'&&G.phase!=='roll') return {err:'You can’t play a card right now.'};
    if(G.devPlayed) return {err:'Only one development card can be played each turn.'};
    if(type==='vp') return {err:'Victory point cards count automatically.'};
    const i=P.dev.indexOf(type); if(i<0) return {err:P.newDev.includes(type)?'Cards bought this turn can be played from next turn.':'You don’t have that card.'};
    if(type==='plenty'){
      const rs=args.res||[]; if(rs.length!==2) return {err:'Choose two resources.'};
      const need={}; rs.forEach(r=>need[r]=(need[r]||0)+1);
      if(Object.entries(need).some(([r,n])=>G.bank[r]<n)) return {err:'The bank doesn’t have enough of that.'};
      rs.forEach(r=>take(G,p,r,1));
      log(G,`${pname(p)} plays Year of plenty and takes ${rs.map(rname).join(' and ')}.`);
    } else if(type==='roads'){
      if(G.phase!=='main') return {err:'Play Road building after rolling.'};
      if(!legal.road(G,p).length) return {err:'There’s nowhere to build a road.'};
      G.freeRoads=2; log(G,`${pname(p)} plays Road building.`);
    } else if(type==='scout'){
      const tgt=args.target||'robber';
      if(tgt!=='robber'&&!G.events[tgt]) return {err:'That isn’t on the board.'};
      G.scoutTarget=tgt; G.returnPhase=G.phase; G.phase='scout'; log(G,`${pname(p)} plays Scout.`);
    } else if(type==='march'){
      if(G.phase!=='main') return {err:'Play Forced march after rolling.'};
      G.march=true; log(G,`${pname(p)} plays Forced march.`);
    } else if(type==='reinf'){
      if(G.phase!=='main') return {err:'Play Reinforcements after rolling.'};
      if(count(G,p,'army')>=LIMITS.army) return {err:`You have no armies left (limit ${LIMITS.army}).`};
      if(!legal.army(G,p,true).length) return {err:'You need a road next to one of your cities.'};
      G.freeArmy=1; log(G,`${pname(p)} plays Reinforcements.`);
    } else if(type==='rally'){
      if(G.phase!=='main') return {err:'Play Rally after rolling.'};
      G.rally=true; log(G,`${pname(p)} plays Rally.`);
    } else if(type==='switch'){
      const a=args.ability; if(!ABILITIES[a]) return {err:'Choose an ability.'};
      if(a===G.heroes[p].ability) return {err:'Your hero already has that ability.'};
      G.heroes[p].ability=a; log(G,`${pname(p)}’s hero ${G.heroes[p].name} becomes a ${ABILITIES[a].name}.`);
    } else if(type==='catch'){
      let n=0; for(const c of G.B.corners.values()) if(c.fisher&&c.building&&c.building.p===p&&!fishBlocked(G,c)) n+=take(G,p,'fish',1);
      log(G,`${pname(p)} plays Good catch and lands ${n} fish.`);
    }
    P.dev.splice(i,1); P.played++; G.devPlayed=true; G.stats[p].devPlayed++; return {};
  }
  function roll(G){
    if(G.phase!=='roll') return {err:'You’ve already rolled.'};
    const [d1,d2]=drawDice(G), sum=d1+d2;
    G.sevens=sum===7?G.sevens+1:0;
    G.dice=[d1,d2];
    if(sum===7){
      G.discard=[];
      for(let p=0;p<G.np;p++){const n=total(G.players[p].hand);if(n>7) G.discard.push({p,n:Math.floor(n/2)});}
      G.phase=G.discard.length?'discard':'robber';
      log(G,`${pname(G.cur)} rolls 7. ${G.discard.length?G.discard.map(d=>`${pname(d.p)} must discard ${d.n}`).join(', ')+'. ':''}The robber moves.`);
      const ended=tickEvents(G);
      return {d1,d2,sum,gains:[],ended};
    }
    const want={}; RKEYS.forEach(r=>want[r]=[]);
    let blocked=null; const notes=[], ev=G.events;
    for(const t of G.B.tiles){
      if(t.num!==sum) continue;
      if(t.terrain==='lake'){
        for(const k of t.corners){const c=G.B.corners.get(k);if(!c.building) continue;
          const q=c.building.p;
          if(ev.storm&&!hasAbility(G,q,'angler')){notes.push('The lake storm stops fishing.');continue;}
          const n=(c.building.type==='city'?1:0)+(c.fisher?1:0)+(c.fisher&&hasAbility(G,q,'angler')&&heroNear(G,q,t)?1:0)+(c.fisher&&ev.fishrun&&hasAbility(G,q,'angler')?1:0); if(!n) continue;
          if(fishBlocked(G,c)){notes.push(`${pname(c.building.p)}’s fishermen are blockaded.`);continue;}
          want.fish.push({p:c.building.p,res:'fish',n,tile:t,corner:c});}
        continue;
      }
      const r=TERRAIN[t.terrain].res; if(!r) continue;
      if(t===G.robber){blocked=t;continue;}
      if(ev.wolf&&ev.wolf.tile===t.key){notes.push('The wolf keeps the yaks from grazing.');continue;}
      if(ev.bandits&&ev.bandits.tile===t.key){notes.push(`Bandits block ${TERRAIN[t.terrain].name.toLowerCase()} ${sum}.`);continue;}
      let harv=false; if(ev.harvest&&ev.harvest.includes(t.key)){harv=true;ev.harvest.splice(ev.harvest.indexOf(t.key),1);}
      let calf=false; if(ev.calving&&ev.calving.includes(t.key)){calf=true;ev.calving.splice(ev.calving.indexOf(t.key),1);}
      for(const k of t.corners){const c=G.B.corners.get(k);if(!c.building) continue;
        {const sb=siegedBy(G,c);if(sb!==null){notes.push(`${pname(c.building.p)}’s ${c.building.type} is under siege: ${pname(sb)} takes 1 ${rname(r)} as tribute.`);want[r].push({p:sb,res:r,n:1,tile:t,corner:c,tribute:true});continue;}}
        const q=c.building.p,dbl=(harv&&hasAbility(G,q,'farmer'))||(calf&&hasAbility(G,q,'herder'));
        if(dbl) notes.push(harv?`The good harvest doubles ${pname(q)}’s wheat.`:`Calving season doubles ${pname(q)}’s leather.`);
        want[r].push({p:q,res:r,n:(c.building.type==='city'?2:1)*(dbl?2:1),tile:t,corner:c});}
      for(let q=0;q<G.np;q++){
        const ab=G.heroes[q].ability;
        if(heroNear(G,q,t)&&((ab==='farmer'&&r==='wheat')||(ab==='herder'&&r==='leather'))){const he=G.B.edges.get(G.heroes[q].edge),a=G.B.corners.get(he.a),b=G.B.corners.get(he.b);
          want[r].push({p:q,res:r,n:1,tile:t,corner:{x:(a.x+b.x)/2,z:(a.z+b.z)/2},hero:true});notes.push(`${G.heroes[q].name} brings in 1 extra ${rname(r)} for ${pname(q)}.`);}
      }
    }
    if(ev.harvest&&!ev.harvest.length) delete ev.harvest;
    if(ev.calving&&!ev.calving.length) delete ev.calving;
    const gains=[], short=[];
    for(const r of RKEYS){
      const list=want[r]; if(!list.length) continue;
      const need=list.reduce((s,g)=>s+g.n,0), who=new Set(list.map(g=>g.p));
      if(need>G.bank[r]&&who.size>1){short.push(rname(r));continue;}
      for(const g of list){const k=take(G,g.p,r,g.n);if(k){gains.push({...g,n:k});G.stats[g.p].collected+=k;}}
    }
    G.phase='main';
    const by={}; gains.forEach(g=>{by[g.p]=by[g.p]||{};by[g.p][g.res]=(by[g.p][g.res]||0)+g.n;});
    const parts=Object.entries(by).map(([p,o])=>`${pname(+p)} gets ${Object.entries(o).map(([r,n])=>`${n} ${rname(r)}`).join(', ')}`);
    log(G,`${pname(G.cur)} rolls ${sum}. `+(parts.length?parts.join('. ')+'.':'Nobody collects.')+(blocked?` The robber blocks ${TERRAIN[blocked.terrain].name.toLowerCase()} ${sum}.`:'')+(short.length?` The bank is short of ${short.join(', ')}, so nobody gets it.`:'')+(notes.length?' '+[...new Set(notes)].join(' '):''));
    const ended=tickEvents(G);
    const event=(sum===2||sum===12)?triggerEvent(G):null;
    return {d1,d2,sum,gains,event,ended};
  }
  function discard(G,p,cards){
    const d=G.discard.find(x=>x.p===p); if(!d||G.phase!=='discard') return {err:'No discard needed.'};
    const n=RKEYS.reduce((s,r)=>s+(cards[r]||0),0);
    if(n!==d.n) return {err:`Choose exactly ${d.n} cards.`};
    if(RKEYS.some(r=>(cards[r]||0)>G.players[p].hand[r])) return {err:'You don’t have those cards.'};
    RKEYS.forEach(r=>{const k=cards[r]||0;G.players[p].hand[r]-=k;G.bank[r]+=k;});
    G.discard=G.discard.filter(x=>x!==d);
    log(G,`${pname(p)} discards ${n} cards.`);
    if(!G.discard.length) G.phase='robber';
    return {};
  }
  function moveRobber(G,t){
    if(G.phase!=='robber'&&G.phase!=='scout') return {err:'The robber can’t move now.'};
    if(G.phase==='scout'&&G.scoutTarget&&G.scoutTarget!=='robber'){
      const ev=G.events[G.scoutTarget];
      if(!G.B.isLand(t)||(ev&&ev.tile===t.key)) return {err:'Choose a different land tile.'};
      if(ev) ev.tile=t.key;
      log(G,`The ${G.scoutTarget==='wolf'?'wolf':'bandits'} move${G.scoutTarget==='wolf'?'s':''} to ${TERRAIN[t.terrain].name.toLowerCase()}${t.num?' '+t.num:''}.`);
      G.phase=G.returnPhase;G.returnPhase=null;G.scoutTarget=null;return {};
    }
    if(!G.B.isLand(t)||t===G.robber) return {err:'Choose a different land tile.'};
    G.robber=t; log(G,`The robber moves to ${TERRAIN[t.terrain].name.toLowerCase()}${t.num?' '+t.num:''}.`);
    if(G.phase==='scout'){G.phase=G.returnPhase;G.returnPhase=null;G.scoutTarget=null;return {};}
    const vs=[...new Set(t.corners.map(k=>G.B.corners.get(k).building).filter(b=>b&&b.p!==G.cur).map(b=>b.p))].filter(p=>total(G.players[p].hand)>0);
    if(!vs.length){G.phase='main';return {};}
    if(vs.length===1){const r=steal(G,vs[0]);return r;}
    G.stealFrom=vs; G.phase='steal'; return {choose:vs};
  }
  function steal(G,victim){
    if(G.phase!=='steal'&&G.phase!=='robber') return {err:'Nothing to steal now.'};
    const h=G.players[victim].hand, n=total(h); let res=null;
    if(n>0){let x=Math.floor(G.rng()*n);for(const r of RKEYS){if(x<h[r]){res=r;break;}x-=h[r];}
      h[res]--; G.players[G.cur].hand[res]++;}
    log(G,`${pname(G.cur)} steals a card from ${pname(victim)}.`); if(res){G.stats[G.cur].stole++;G.stats[victim].robbed++;}
    G.phase='main'; G.stealFrom=[]; return {stolen:res,victim};
  }
  function rates(G,p){
    const out=Object.fromEntries(RKEYS.map(r=>[r,4]));
    for(const c of G.B.corners.values()){
      if(!isMine(G,p,c)||!c.port) continue;
      if(c.port==='any') RKEYS.forEach(r=>out[r]=Math.min(out[r],3)); else out[c.port]=2;
    }
    if(heroActive(G,p)&&G.heroes[p].ability==='merchant'){
      const he=G.B.edges.get(G.heroes[p].edge);
      for(const k of [he.a,he.b]){const c=G.B.corners.get(k);if(!c.port) continue;if(c.port==='any') RKEYS.forEach(r=>out[r]=Math.min(out[r],3)); else out[c.port]=2;}
    }
    if(G.events.merchant&&hasAbility(G,p,'merchant')) RKEYS.forEach(r=>out[r]=Math.min(out[r],3));
    return out;
  }
  function bankTrade(G,give,get){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    if(give===get) return {err:'Choose two different resources.'};
    const rate=rates(G,p)[give];
    if(G.players[p].hand[give]<rate) return {err:`You need ${rate} ${rname(give)}.`};
    if(G.bank[get]<1) return {err:`The bank is out of ${rname(get)}.`};
    G.players[p].hand[give]-=rate; G.bank[give]+=rate; take(G,p,get,1);
    log(G,`${pname(p)} trades ${rate} ${rname(give)} with the bank for 1 ${rname(get)}.`); G.stats[p].trades++; return {};
  }
  function playerTrade(G,q,give,get){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    if(q===p) return {err:'Choose another player.'};
    const sum=o=>RKEYS.reduce((s,r)=>s+(o[r]||0),0);
    if(!sum(give)||!sum(get)) return {err:'Both sides need to offer something.'};
    if(RKEYS.some(r=>(give[r]||0)>G.players[p].hand[r])) return {err:'You don’t have those cards.'};
    if(RKEYS.some(r=>(get[r]||0)>G.players[q].hand[r])) return {err:`${pname(q)} doesn’t have those cards.`};
    RKEYS.forEach(r=>{const a=give[r]||0,b=get[r]||0;G.players[p].hand[r]+=b-a;G.players[q].hand[r]+=a-b;});
    const txt=o=>RKEYS.filter(r=>o[r]).map(r=>`${o[r]} ${rname(r)}`).join(', ');
    log(G,`${pname(p)} trades ${txt(give)} to ${pname(q)} for ${txt(get)}.`); G.stats[p].trades++; G.stats[q].trades++; return {};
  }
  function endTurn(G){
    if(G.phase!=='main') return {err:G.phase==='roll'?'Roll the dice first.':'Finish what you’re doing first.'};
    if(G.freeRoads>0) G.freeRoads=0;
    const P=G.players[G.cur]; P.dev.push(...P.newDev); P.newDev=[];
    {const h=G.heroes[G.cur]; if(h.wounded!==false&&h.wounded<G.turnNo){h.wounded=false;log(G,`${h.name} has recovered.`);}}
    const wasNight=isNight(G);
    G.cur=(G.cur+1)%G.np; G.phase='roll'; G.devPlayed=false; G.dice=null; G.turnNo++;
    const night=isNight(G), out={};
    if(wasNight===false&&night===true){log(G,'Night falls over Highhorn. Wolves and bandits may come out.');out.dusk=true;}
    if(wasNight===true&&night===false){out.dawn=true;const gone=[];
      if(G.events.wolf){delete G.events.wolf;gone.push('the wolf slinks back into the forest');}
      if(G.events.bandits){delete G.events.bandits;gone.push('the bandits melt away into the hills');}
      log(G,'Dawn breaks'+(gone.length?': '+gone.join(', and ')+'.':'.'));}
    G.mover=null; G.march=false; G.rally=false; G.freeArmy=0;
    G.heroes.forEach(h=>h.moves=0);
    if(G.events.merchant&&G.cur===G.events.merchant.until){delete G.events.merchant;log(G,'The travelling merchant moves on.');}
    return out;
  }
  function longestFor(G,p){
    let best=0; const B=G.B;
    const blocked=k=>{const c=B.corners.get(k);return c.building&&c.building.p!==p;};
    const dfs=(k,used,len)=>{
      if(len>best) best=len;
      if(len>0&&blocked(k)) return;
      for(const ek of B.corners.get(k).edges){const e=B.edges.get(ek);if(!e.road||e.road.p!==p||used.has(ek)) continue;used.add(ek);dfs(other(e,k),used,len+1);used.delete(ek);}
    };
    for(const e of B.edges.values()) if(e.road&&e.road.p===p){dfs(e.a,new Set(),0);dfs(e.b,new Set(),0);}
    return best;
  }
  function updateLongest(G){
    const len=Array.from({length:G.np},(_,p)=>longestFor(G,p)); G.longest.len=len;
    const max=Math.max(...len), tops=len.map((l,p)=>l===max?p:-1).filter(p=>p>=0), h=G.longest.holder;
    let nh;
    if(max<5) nh=null;
    else if(h!==null&&tops.includes(h)) nh=h;
    else nh=tops.length===1?tops[0]:null;
    if(nh!==h){G.longest.holder=nh; if(nh!==null) log(G,`${pname(nh)} takes Longest Road (${max} roads).`); else if(h!==null) log(G,`${pname(h)} loses Longest Road.`);}
  }
  function checkWin(G){
    if(G.phase==='over') return;
    const v=vp(G,G.cur,true);
    if(v>=WIN_VP){G.phase='over';G.winner=G.cur;log(G,`${pname(G.cur)} reaches ${v} points and wins the game!`);}
  }
  /* ---- fish ---- */
  // Siege: enemy armies on the roads touching a village (1 army) or city (2 armies) stop it producing.
  function siegedBy(G,c){
    if(!c.building) return null;
    const need=c.building.type==='city'?2:1, by={};
    for(const k of c.edges){const e=G.B.edges.get(k);if(e.army&&e.army.p!==c.building.p) by[e.army.p]=(by[e.army.p]||0)+e.army.n;}
    let best=null,bn=0; for(const q in by) if(by[q]>=need&&by[q]>bn){bn=by[q];best=+q;}
    return best;
  }
  function sieges(G){const out=[];for(const c of G.B.corners.values()){const q=siegedBy(G,c);if(q!==null) out.push({c,by:q});}return out;}
  function fishBlocked(G,c){return c.edges.some(k=>{const e=G.B.edges.get(k);return e.army&&e.army.p!==c.building.p;});}
  function whyNotFisher(G,p,c,ignoreCost){
    if(!c.tiles.some(t=>t.terrain==='lake')) return 'Fishermen go on a corner touching a lake.';
    if(!c.building||c.building.p!==p) return 'You need a village or city on this lake corner first.';
    if(c.fisher) return 'There is already a fisherman here.';
    if(count(G,p,'fisher')>=LIMITS.fisher) return `You have no fishermen left (limit ${LIMITS.fisher}).`;
    if(!ignoreCost&&!canAfford(G,p,COSTS.fisher)) return `A fisherman costs ${costText(COSTS.fisher)}.`;
    return null;
  }
  function placeFisher(G,c){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    const why=whyNotFisher(G,p,c); if(why) return {err:why};
    pay(G,p,COSTS.fisher); c.fisher=true; log(G,`${pname(p)} hires a fisherman.`); return {};
  }
  /* ---- armies ---- */
  const adjacent=(a,b)=>a!==b&&(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b);
  const nextToOwnCity=(G,p,e)=>[e.a,e.b].some(k=>{const c=G.B.corners.get(k);return c.building&&c.building.p===p&&c.building.type==='city';});
  function whyNotArmy(G,p,e,ignoreCost){
    if(!e.road||e.road.p!==p) return 'Armies are raised on one of your own roads.';
    if(!nextToOwnCity(G,p,e)) return 'Armies are raised on a road next to one of your cities.';
    if(e.army&&e.army.p!==p) return 'An enemy army stands here.';
    if(e.army&&e.army.n>=LIMITS.stack) return `A road holds at most ${LIMITS.stack} armies.`;
    if(count(G,p,'army')>=LIMITS.army) return `You have no armies left (limit ${LIMITS.army}).`;
    if(!ignoreCost&&G.freeArmy===0&&!hasCredit(G,p,'muster')&&!canAfford(G,p,COSTS.army)) return `An army costs ${costText(COSTS.army)}.`;
    return null;
  }
  function raiseArmy(G,e){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    const why=whyNotArmy(G,p,e); if(why) return {err:why};
    if(G.freeArmy>0) G.freeArmy--; else if(hasCredit(G,p,'muster')) useCredit(G,p,'muster'); else pay(G,p,COSTS.army);
    if(e.army){e.army.n++; if(e.army.fresh===G.turnNo) e.army.freshN=(e.army.freshN||0)+1; else {e.army.fresh=G.turnNo;e.army.freshN=1;}} else e.army={p,n:1,fresh:G.turnNo,freshN:1};
    log(G,`${pname(p)} raises an army.`); updateArmy(G); checkWin(G); return {};
  }
  function homeBonus(G,e,p){return [e.a,e.b].some(k=>{const c=G.B.corners.get(k);return c.building&&c.building.p===p;})?1:0;}
  function retreatTarget(G,p,from,exclude,n){
    const start=[from.a,from.b], seen=new Set(start); let q=[...start];
    while(q.length){
      const nq=[];
      for(const k of q){
        const c=G.B.corners.get(k);
        if(c.building&&c.building.p===p&&c.building.type==='city'){
          const e=c.edges.map(x=>G.B.edges.get(x)).find(e=>e.road&&e.road.p===p&&e!==exclude&&(!e.army||(e.army.p===p&&e.army.n+n<=LIMITS.stack)));
          if(e) return e;
        }
        for(const ek of c.edges){const e=G.B.edges.get(ek);if(!e.road||e.road.p!==p) continue;const o=other(e,k);if(!seen.has(o)){seen.add(o);nq.push(o);}}
      }
      q=nq;
    }
    return null;
  }
  // Armies on roads touching the battle road (sharing one of its corners) lend their strength.
  function supportOf(G,p,e){let n=0;for(const k of [e.a,e.b]) for(const ek of G.B.corners.get(k).edges){const x=G.B.edges.get(ek);if(x!==e&&x.army&&x.army.p===p) n+=x.army.n;}return n;}
  function battlePreview(G,from,to){
    const ap=from.army.p, def=to.army, dp=def.p, bonus=homeBonus(G,to,dp), rally=G.rally?1:0;
    const wa=warlordOn(G,ap,from)?1:0, wd=warlordOn(G,dp,to)?1:0;
    const supA=Math.max(0,supportOf(G,ap,to)-1), supD=supportOf(G,dp,to);
    const attForce=1+supA, defForce=def.n+supD, aS=attForce+rally+wa, dS=defForce+bonus+wd, attWins=aS>dS;
    let keep,depleted,loserN;
    if(attWins){keep=1;depleted=Math.min(supA,Math.max(0,attForce-Math.max(1,aS-dS)));loserN=def.n;}
    else{keep=Math.min(def.n,Math.max(1,dS-aS));depleted=def.n-keep;loserN=1;}
    const winP=attWins?ap:dp, loseP=attWins?dp:ap;
    return {aS,dS,bonus,rally,wa,wd,supA,supD,attWins,keep,depleted,loserN,attacker:ap,defender:dp,winP,loseP,
      winnerRetreat:depleted?!!retreatTarget(G,winP,to,to,1):true,
      loserRetreat:!!retreatTarget(G,loseP,attWins?to:from,attWins?to:from,loserN)};
  }
  function doRetreat(G,p,n,from,exclude,res){
    if(n<=0) return 0;
    const e=retreatTarget(G,p,from,exclude,n);
    if(res) (res.retreats=res.retreats||[]).push({p,n,from:from.key,to:e?e.key:null});
    if(!e){log(G,`${n} of ${pname(p)}’s ${n===1?'army is':'armies are'} lost, with no city to fall back to.`);return -n;}
    if(e.army) e.army.n+=n; else e.army={p,n,fresh:-1,freshN:0};
    if(p===G.cur){if(e.army.fresh===G.turnNo) e.army.freshN=(e.army.freshN||0)+n; else {e.army.fresh=G.turnNo;e.army.freshN=n;}}
    return n;
  }
  function moveInfo(G,from,to){
    const p=G.cur, st=from.army;
    if(!st||st.p!==p) return {err:'Choose one of your armies first.'};
    if(st.fresh===G.turnNo&&st.n<=(st.freshN||st.n)) return {err:'Armies raised or retreated this turn can move from your next turn.'};
    if(G.mover&&G.mover.edge!==from.key) return {err:'Only one army can move each turn.'};
    const moves=G.mover?G.mover.moves:0, max=G.march?3:2;
    if(moves>=max) return {err:'This army has no moves left this turn.'};
    if(!adjacent(from,to)) return {err:'Armies move one road at a time, to a road touching their own.'};
    if(!to.road&&!openGround(to)) return {err:to.river?'Armies need a bridge to cross a river.':'Armies can’t march into the Shaggy Peaks.'};
    if(to.road&&to.river&&G.events.flood&&!hasAbility(G,p,'engineer')) return {err:'The flood stops armies crossing bridges.'};
    // own roads and open ground: first step free; enemy roads cost fish
    const own=!to.road||to.road.p===p, cost=G.march?0:own?(moves===0?0:1):(moves===0?1:2);
    if(G.players[p].hand.fish<cost) return {err:`That move costs ${cost} fish and you have ${G.players[p].hand.fish}.`};
    if(to.army&&to.army.p===p&&to.army.n+1>LIMITS.stack) return {err:`A road holds at most ${LIMITS.stack} armies.`};
    if(to.army&&to.army.p!==p) return {cost,battle:battlePreview(G,from,to)};
    return {cost};
  }
  // Open ground: a path between land tiles with no road on it (not along a river, not up in the peaks)
  function openGround(e){return !e.road&&!e.river&&e.valid!==false&&e.tiles.some(t=>!t.rim&&t.terrain!=='lake');}
  function takeOne(e){e.army.n--;if(e.army.n<=0) e.army=null;}
  function moveArmy(G,from,to){
    if(G.phase!=='main') return {err:'Roll the dice first.'};
    const info=moveInfo(G,from,to); if(info.err) return info;
    const p=G.cur, st=from.army, moves=(G.mover?G.mover.moves:0)+1;
    G.players[p].hand.fish-=info.cost; G.bank.fish+=info.cost;
    const res={cost:info.cost};
    if(info.battle){
      const b=info.battle, def=to.army; res.battle=b;
      if(b.attWins){
        takeOne(from); to.army={p,n:1,fresh:-1}; G.mover={edge:to.key,moves}; woundHeroes(G,to,p,res);
        log(G,`${pname(p)} attacks ${pname(def.p)} (${b.aS} against ${b.dS}) and takes the road.`);
        doRetreat(G,def.p,b.loserN,to,to,res);
        // worn-out supporting armies head home, taken from the largest neighbouring stacks first
        let left=b.depleted; const sup=[];
        for(const k of [to.a,to.b]) for(const ek of G.B.corners.get(k).edges){const x=G.B.edges.get(ek);if(x!==to&&x.army&&x.army.p===p&&!sup.includes(x)) sup.push(x);}
        sup.sort((a,c)=>c.army.n-a.army.n);
        for(const x of sup){if(left<=0) break;const k=Math.min(left,x.army.n);x.army.n-=k;left-=k;if(x.army.n<=0) x.army=null;doRetreat(G,p,k,x,x,res);}
        G.stats[p].won++; G.stats[def.p].lost++; res.plunder=plunder(G,p,def.p);
        chase(G,to,p,res);
      } else {
        takeOne(from); def.n=b.keep; G.mover={edge:'done',moves:99};
        log(G,`${pname(def.p)} holds the road against ${pname(p)} (${b.dS} against ${b.aS}).`);
        doRetreat(G,p,1,from,from,res); doRetreat(G,def.p,b.depleted,to,to,res);
        G.stats[def.p].won++; G.stats[p].lost++; res.plunder=plunder(G,def.p,p);
      }
      G.rally=false;
    } else {
      takeOne(from); if(to.army) to.army.n+=1; else to.army={p,n:1,fresh:-1};
      G.mover={edge:to.key,moves}; woundHeroes(G,to,p,res);
      if(info.cost) log(G,`${pname(p)} marches an army for ${info.cost} fish.`);
      chase(G,to,p,res);
    }
    updateArmy(G); checkWin(G); return res;
  }
  function chase(G,e,p,res){
    const ev=G.events, on=k=>e.tiles.some(t=>t.key===k);
    if(ev.wolf&&on(ev.wolf.tile)){delete ev.wolf;res.chased='wolf';log(G,`${pname(p)}’s army chases the wolf away.`);}
    if(ev.bandits&&on(ev.bandits.tile)){delete ev.bandits;res.chased='bandits';log(G,`${pname(p)}’s army drives off the bandits.`);}
    if(G.robber&&e.tiles.includes(G.robber)&&G.phase==='main'){G.phase='robber';res.chased='robber';log(G,`${pname(p)}’s army chases the robber off. Move it and steal a card.`);}
  }
  function updateArmy(G){
    const cnt=Array.from({length:G.np},(_,p)=>count(G,p,'army')), h=G.armyHolder, max=Math.max(...cnt), tops=cnt.map((c,p)=>c===max?p:-1).filter(p=>p>=0);
    let nh=h;
    if(h!==null&&cnt[h]<3) nh=null;
    if(nh===null){if(max>=3&&tops.length===1) nh=tops[0];}
    else if(max>cnt[nh]) nh=tops.length===1?tops[0]:null;
    if(nh!==h){G.armyHolder=nh; log(G,nh!==null?`${pname(nh)} takes Largest Army (${cnt[nh]} armies).`:`${pname(h)} loses Largest Army.`);}
  }
  /* ---- events ---- */
  function tickEvents(G){
    const ev=G.events;
    const gone=[];
    if(ev.storm&&--ev.storm.rolls<=0){gone.push('storm');log(G,'The lake storm passes.');}
    if(ev.flood&&--ev.flood.rolls<=0){gone.push('flood');log(G,'The floodwater drains away.');}
    const ended=[];
    if(ev.storm&&ev.storm.rolls<=0){delete ev.storm;ended.push('storm');}
    if(ev.flood&&ev.flood.rolls<=0){delete ev.flood;ended.push('flood');}
    if(ev.wolf&&--ev.wolf.rolls<=0){delete ev.wolf;ended.push('wolf');log(G,'The wolf wanders back into the forest.');}
    if(ev.bandits&&--ev.bandits.rolls<=0){delete ev.bandits;ended.push('bandits');log(G,'The bandits move on.');}
    if(ev.fishrun&&--ev.fishrun.rolls<=0){delete ev.fishrun;ended.push('fishrun');log(G,'The fish run is over.');}
    for(const k of ['commission','muster']) if(ev[k]&&--ev[k].rolls<=0){delete ev[k];ended.push(k);log(G,`The ${k==='commission'?'royal commission':'call to arms'} has expired.`);}
    return ended;
  }
  // Day and night rules: a full day every 6 rounds (matches the sky). null when the rule is off.
  function isNight(G){if(!G.opts||!G.opts.nightRules) return null;const t=((G.turnNo||0)/(G.np*6)+0.15)%1;return t>0.5;}
  // Battle winners carry off 1 random card from the loser.
  function plunder(G,w,l){const h=G.players[l].hand,n=total(h);if(!n) return null;let x=Math.floor(G.rng()*n),res=null;
    for(const r of RKEYS){if(x<h[r]){res=r;break;}x-=h[r];}h[res]--;G.players[w].hand[res]++;G.stats[w].stole++;G.stats[l].robbed++;
    log(G,`${pname(w)} plunders a card from ${pname(l)}.`);return {w,l,res};}
  // Buildings an enemy army could besiege next turn: an enemy stack within two roads of a road touching the building.
  function threats(G,p){
    const B=G.B,out=[];
    for(const c of B.corners.values()){
      if(!c.building||c.building.p!==p||siegedBy(G,c)!==null) continue;
      let ring=new Set(c.edges), seen=new Set(c.edges), by=null;
      for(let d=0;d<=2&&by===null;d++){
        for(const k of ring){const e=B.edges.get(k);if(e.army&&e.army.p!==p){by=e.army.p;break;}}
        const next=new Set();for(const k of ring){const e=B.edges.get(k);for(const ck of [e.a,e.b]) for(const x of B.corners.get(ck).edges) if(!seen.has(x)){seen.add(x);next.add(x);}}
        ring=next;
      }
      if(by!==null) out.push({c,by});
    }
    return out;
  }
  function triggerEvent(G){
    const ev=G.events, B=G.B, T=k=>B.tiles.filter(t=>t.terrain===k);
    const pick=a=>a[Math.floor(G.rng()*a.length)];
    const possible={
      wolf:()=>isNight(G)!==false&&T('forest').length&&T('pasture').some(t=>t!==G.robber),
      harvest:()=>T('fields').length&&G.heroes.some(h=>h.ability==='farmer'), merchant:()=>G.heroes.some(h=>h.ability==='merchant'),
      bandits:()=>isNight(G)!==false&&[...T('hills'),...T('mountains')].some(t=>t!==G.robber),
      storm:()=>T('lake').length, flood:()=>[...B.edges.values()].some(e=>e.river),
      calving:()=>T('pasture').length&&G.heroes.some(h=>h.ability==='herder'), fishrun:()=>T('lake').length&&G.heroes.some(h=>h.ability==='angler'),
      commission:()=>G.heroes.some(h=>h.ability==='engineer'), muster:()=>G.heroes.some(h=>h.ability==='warlord'),
    };
    const opts=Object.keys(EVENTS).filter(k=>!ev[k]&&possible[k]());
    if(!opts.length) return null;
    const k=pick(opts), out={key:k};
    if(k==='wolf'){const f=pick(T('forest')), ps=T('pasture').filter(t=>t!==G.robber&&!(ev.bandits&&ev.bandits.tile===t.key));
      const tgt=ps.reduce((a,b)=>Math.hypot(a.x-f.x,a.z-f.z)<=Math.hypot(b.x-f.x,b.z-f.z)?a:b);
      ev.wolf={tile:tgt.key,from:f.key,rolls:3+Math.floor(G.rng()*3)}; out.from=f; out.tile=tgt;
      log(G,`Event: a wolf comes out of the forest and settles on pasture ${tgt.num}. It stays for ${ev.wolf.rolls} rolls unless an army chases it off.`);}
    if(k==='harvest'){ev.harvest=T('fields').map(t=>t.key);log(G,'Event: a good harvest. Each fields tile pays double the next time it’s rolled.');}
    if(k==='merchant'){ev.merchant={until:G.cur};log(G,`Event: a travelling merchant arrives. Bank trades are 3:1 until ${pname(G.cur)}’s next turn.`);}
    if(k==='bandits'){const t=pick([...T('hills'),...T('mountains')].filter(t=>t!==G.robber));ev.bandits={tile:t.key,rolls:3+Math.floor(G.rng()*3)};out.tile=t;
      log(G,`Event: bandits take over ${TERRAIN[t.terrain].name.toLowerCase()} ${t.num}. It produces nothing for ${ev.bandits.rolls} rolls, or until an army drives them off.`);}
    if(k==='storm'){ev.storm={rolls:G.np};log(G,`Event: a storm sweeps the lakes. No fishing for ${G.np} rolls.`);}
    const with_=a=>G.heroes.map((h,q)=>h.ability===a?q:-1).filter(q=>q>=0);
    if(k==='calving'){ev.calving=T('pasture').map(t=>t.key);log(G,'Event: calving season. Herders collect double from each pasture the next time it’s rolled.');}
    if(k==='fishrun'){ev.fishrun={rolls:G.np};log(G,`Event: a fish run. Anglers’ fishermen catch 1 extra fish for ${G.np} rolls.`);}
    if(k==='commission'){ev.commission={players:with_('engineer'),rolls:G.np*2};log(G,`Event: a royal commission. ${ev.commission.players.map(pname).join(' and ')} build their next road or bridge for free.`);}
    if(k==='muster'){ev.muster={players:with_('warlord'),rolls:G.np*2};log(G,`Event: a call to arms. ${ev.muster.players.map(pname).join(' and ')} raise their next army for free.`);}
    if(k==='flood'){ev.flood={rolls:2};log(G,'Event: the rivers flood. Armies can’t cross bridges for 2 rolls.');}
    return out;
  }
  /* ---- heroes ---- */
  function hasCredit(G,p,k){return !!(G.events[k]&&G.events[k].players.includes(p));}
  function useCredit(G,p,k){const e=G.events[k];e.players=e.players.filter(q=>q!==p);log(G,`${pname(p)} uses the ${k==='commission'?'royal commission':'call to arms'}.`);if(!e.players.length) delete G.events[k];}
  function hasAbility(G,p,a){return !!(G.heroes&&G.heroes[p]&&G.heroes[p].ability===a);}
  function heroActive(G,p){const h=G.heroes&&G.heroes[p];return !!(h&&h.edge&&h.wounded===false);}
  function heroNear(G,p,t){return heroActive(G,p)&&G.B.edges.get(G.heroes[p].edge).tiles.includes(t);}
  function warlordOn(G,p,e){return hasAbility(G,p,'warlord')&&heroActive(G,p)&&G.heroes[p].edge===e.key;}
  function costFor(G,p,kind){if(kind==='bridge'&&hasAbility(G,p,'engineer')) return {timber:1,clay:1};return COSTS[kind];}
  function heroMoveInfo(G,p,to){
    const h=G.heroes[p];
    if(!h.edge) return {err:'Your hero joins at your first road.'};
    if(h.wounded!==false) return {err:`${h.name} is wounded and resting this turn.`};
    if(h.moves>=HERO_MOVES) return {err:`${h.name} has no moves left this turn.`};
    const from=G.B.edges.get(h.edge);
    if(!adjacent(from,to)) return {err:'Heroes walk one road at a time, to a road touching their own.'};
    if(!to.road) return {err:'Heroes can only walk along roads and bridges.'};
    if(to.river&&G.events.flood&&h.ability!=='engineer') return {err:'The flood stops heroes crossing bridges.'};
    if(to.army&&to.army.p!==p) return {err:'Heroes can’t walk into an enemy army.'};
    return {};
  }
  function moveHero(G,to){
    const p=G.cur; if(G.phase!=='main') return {err:'Roll the dice first.'};
    const i=heroMoveInfo(G,p,to); if(i.err) return i;
    const h=G.heroes[p]; h.edge=to.key; h.moves++;
    const res={}, ev=G.events, on=k=>to.tiles.some(t=>t.key===k);
    if(h.ability==='herder'&&ev.wolf&&on(ev.wolf.tile)){delete ev.wolf;res.chased='wolf';log(G,`${h.name} the Herder chases the wolf away.`);}
    if(h.ability==='warlord'&&ev.bandits&&on(ev.bandits.tile)){delete ev.bandits;res.chased='bandits';log(G,`${h.name} the Warlord drives off the bandits.`);}
    return res;
  }
  function heroHome(G,q){
    const own=e=>e.road&&e.road.p===q, E=[...G.B.edges.values()];
    const city=E.find(e=>own(e)&&[e.a,e.b].some(k=>{const c=G.B.corners.get(k);return c.building&&c.building.p===q&&c.building.type==='city';}));
    if(city) return city;
    return E.find(e=>own(e)&&(e.a===G.heroes[q].home||e.b===G.heroes[q].home))||E.find(own)||null;
  }
  function woundHeroes(G,e,p,res){
    G.heroes.forEach((h,q)=>{
      if(q===p||h.edge!==e.key||h.wounded!==false||(e.army&&e.army.p===q)) return;
      const d=heroHome(G,q); if(d) h.edge=d.key; h.wounded=G.turnNo;
      (res.wounded=res.wounded||[]).push(q);
      log(G,`${pname(p)}’s army wounds ${h.name}, who limps home to rest for a turn.`);
    });
  }
  Object.assign(legal,{
    hero:(G,p)=>[...G.B.edges.values()].filter(t=>!heroMoveInfo(G,p,t).err),
    fisher:(G,p)=>[...G.B.corners.values()].filter(c=>!whyNotFisher(G,p,c,true)),
    army:(G,p)=>[...G.B.edges.values()].filter(e=>!whyNotArmy(G,p,e,true)),
    movable:(G,p)=>[...G.B.edges.values()].filter(e=>e.army&&e.army.p===p&&!(e.army.fresh===G.turnNo&&e.army.n<=(e.army.freshN||e.army.n))&&(!G.mover||G.mover.edge===e.key)&&[...G.B.edges.values()].some(t=>!moveInfo(G,e,t).err)),
    moves:(G,from)=>[...G.B.edges.values()].filter(t=>!moveInfo(G,from,t).err),
  });
  return {newGame,canAfford,count,vp,rates,legal,whyNotVillage,whyNotRoad,whyNotCity,roadConnects,touchesOwnRoad,
    whyNotFisher,placeFisher,whyNotArmy,raiseArmy,moveInfo,moveArmy,battlePreview,fishBlocked,siegedBy,sieges,
    costFor,hasAbility,heroActive,hasCredit,heroMoveInfo,moveHero,
    placeVillage,placeRoad,placeCity,buyDev,playDev,roll,discard,moveRobber,steal,bankTrade,playerTrade,endTurn,total,isNight,threats};
})();

