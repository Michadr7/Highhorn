/* Highhorn: AI opponents (pure decision-making on top of the engine).
   Part of the Highhorn game. Files load in this order: engine.js, bots.js, sound.js, game.js. */
'use strict';
/* =====================================================================
   BOTS (pure decision-making on top of the rules engine)
   A bot never touches the page; it only picks the next legal action.
   ===================================================================== */
const Bot = (() => {
  const AI=(G,p)=>(AI_DEFS[G.players[p].ai]||{}).p||{};
  const E=Engine, W0={timber:1,clay:1,leather:0.9,wheat:1.1,iron:1.1,fish:0.35};
  const best=(list,f)=>{let b=null,bs=-Infinity;for(const x of list){const s=f(x);if(s>bs){bs=s;b=x;}}return b;};
  const other=(e,k)=>e.a===k?e.b:e.a;
  function production(G,p){
    const pr=Object.fromEntries(RKEYS.map(r=>[r,0]));
    for(const c of G.B.corners.values()){if(!c.building||c.building.p!==p) continue;const m=c.building.type==='city'?2:1;
      for(const t of c.tiles){const r=TERRAIN[t.terrain].res;if(r&&t.num&&t!==G.robber) pr[r]+=pips(t.num)*m;}}
    return pr;
  }
  function weights(G,p){const pr=production(G,p),w={};for(const r of RKEYS) w[r]=W0[r]*(1.5-Math.min(pr[r],10)/12);return {w,pr};}
  function spotValue(G,p,c,W){
    let v=0; const seen=new Set();
    for(const t of c.tiles){const r=TERRAIN[t.terrain].res;if(!r||!t.num) continue;v+=pips(t.num)*W.w[r]*(t===G.robber?0.4:1);seen.add(r);}
    v+=seen.size*0.6;
    if(c.port) v+=c.port==='any'?1:(W.pr[c.port]>=4?2:0.5);
    if(c.tiles.some(t=>t.terrain==='lake')) v+=0.6;
    return v;
  }
  // Breadth-first search outward from the bot's road network, for planning roads toward good spots.
  function plan(G,p,maxLen=4){
    const B=G.B, dist=new Map(), prev=new Map(), q=[];
    for(const c of B.corners.values()){
      const mine=c.building&&c.building.p===p, touches=c.edges.some(k=>{const e=B.edges.get(k);return e.road&&e.road.p===p;});
      if(mine||(touches&&!(c.building&&c.building.p!==p))){dist.set(c.key,0);q.push(c.key);}
    }
    while(q.length){
      const k=q.shift(), d=dist.get(k), c=B.corners.get(k);
      if(d>=maxLen) continue;
      if(d>0&&c.building&&c.building.p!==p) continue;
      for(const ek of c.edges){const e=B.edges.get(ek);if(!e.valid||e.road) continue;const o=other(e,k);if(dist.has(o)) continue;dist.set(o,d+1);prev.set(o,e);q.push(o);}
    }
    return {dist,prev};
  }
  function bestSpot(G,p,W){
    const PL=AI(G,p).plan||4;
    if(E.count(G,p,'village')>=LIMITS.village) return null;
    const {dist,prev}=plan(G,p,PL);
    let bestC=null,bs=-Infinity;
    for(const c of G.B.corners.values()){
      if(c.building||!c.valid||[...c.adj].some(k=>G.B.corners.get(k).building)) continue;
      const d=dist.get(c.key); if(d===undefined||d===0) continue;
      const s=spotValue(G,p,c,W)-d*1.6; if(s>bs){bs=s;bestC=c;}
    }
    if(!bestC) return null;
    const path=[]; let k=bestC.key;
    while(prev.has(k)){const e=prev.get(k);path.unshift(e);k=other(e,k);}
    return {c:bestC,path,score:bs};
  }
  function chooseTarget(G,p,W){
    const V=E.legal.village(G,p);
    if(V.length&&E.count(G,p,'village')<LIMITS.village) return {kind:'village',cost:COSTS.village};
    const hasVillage=E.count(G,p,'village')>0, citiesLeft=E.count(G,p,'city')<LIMITS.city;
    const spot=bestSpot(G,p,W);
    {const ai=AI(G,p),lim=2+(ai.roadBias?2:0)-(ai.cityBias?1:0);
    if(hasVillage&&citiesLeft&&(!spot||spot.path.length>lim||W.pr.iron+W.pr.wheat>=(ai.cityBias?6:8))) return {kind:'city',cost:COSTS.city};}
    if(spot&&spot.path.length) {const e=spot.path[0];return {kind:'road',edge:e,cost:E.costFor(G,p,e.river?'bridge':'road')};}
    if(hasVillage&&citiesLeft) return {kind:'city',cost:COSTS.city};
    return {kind:'dev',cost:COSTS.dev};
  }
  function tradeFor(G,p,cost,W){
    const hand=G.players[p].hand, rates=E.rates(G,p);
    const missing=RKEYS.filter(r=>(cost[r]||0)>hand[r]&&G.bank[r]>0);
    if(!missing.length) return null;
    const gives=RKEYS.filter(r=>hand[r]-(cost[r]||0)>=rates[r]).sort((a,b)=>(hand[b]-(cost[b]||0))*1/W.w[b]-(hand[a]-(cost[a]||0))*1/W.w[a]);
    if(!gives.length) return null;
    return {t:'bank',give:gives[0],get:best(missing,r=>W.w[r])};
  }
  function robberTile(G,p){
    return best(E.legal.robber(G),t=>{
      let s=0;
      for(const k of t.corners){const c=G.B.corners.get(k);if(!c.building) continue;const m=c.building.type==='city'?2:1;
        if(c.building.p===p) s-=12*m; else s+=pips(t.num)*m*(1+E.vp(G,c.building.p,false)/8*(AI(G,p).leaderHate||1));}
      return s+(t.num?0:-3);
    });
  }
  function stealFrom(G,p){return best(G.stealFrom,q=>E.vp(G,q,false)*2+E.total(G.players[q].hand)*0.3);}
  function discard(G,p){
    const d=G.discard.find(x=>x.p===p), hand={...G.players[p].hand}, W=weights(G,p), tgt=chooseTarget(G,p,W), keep=tgt.cost, sel={};
    const units=[]; for(const r of RKEYS) for(let i=0;i<hand[r];i++) units.push({r,v:W.w[r]+((keep[r]||0)>i?3:0)-i*0.15});
    units.sort((a,b)=>a.v-b.v);
    units.slice(0,d.n).forEach(u=>sel[u.r]=(sel[u.r]||0)+1);
    return sel;
  }
  function setupVillage(G,p){const W=weights(G,p);return best(E.legal.village(G,p),c=>spotValue(G,p,c,W)+Math.random()*0.3);}
  function setupRoad(G,p){
    const W=weights(G,p);
    return best(E.legal.road(G,p),e=>{const o=G.B.corners.get(e.a===G.setup.last?e.b:e.a);
      return Math.max(0,...[...o.adj].map(k=>G.B.corners.get(k)).filter(c=>!c.building&&c.valid).map(c=>spotValue(G,p,c,W)));});
  }
  function heroValue(G,p,e){
    const h=G.heroes[p], ts=e.tiles.filter(t=>!t.rim), ev=G.events;
    switch(h.ability){
      case 'farmer': return ts.filter(t=>t.terrain==='fields'&&t!==G.robber).reduce((s,t)=>s+pips(t.num),0);
      case 'herder': return ts.filter(t=>t.terrain==='pasture'&&t!==G.robber).reduce((s,t)=>s+pips(t.num),0)+(ev.wolf&&ts.some(t=>t.key===ev.wolf.tile)?6:0);
      case 'angler': return ts.filter(t=>t.terrain==='lake'&&t.corners.some(k=>{const c=G.B.corners.get(k);return c.fisher&&c.building&&c.building.p===p;})).reduce((s,t)=>s+pips(t.num)*1.5,0);
      case 'merchant': {const c=[e.a,e.b].map(k=>G.B.corners.get(k)).find(c=>c.port);return c?(c.port==='any'?2.5:3):0;}
      case 'warlord': return (e.army&&e.army.p===p?3:0)+(ev.bandits&&ts.some(t=>t.key===ev.bandits.tile)?6:0);
      default: return 0;
    }
  }
  function heroStep(G,p){
    const h=G.heroes[p]; if(!E.heroActive(G,p)||h.moves>=HERO_MOVES) return null;
    const B=G.B, start=B.edges.get(h.edge), left=HERO_MOVES-h.moves, cur=heroValue(G,p,start);
    const okE=e=>e.road&&!(e.army&&e.army.p!==p)&&!(e.river&&G.events.flood&&h.ability!=='engineer');
    const seen=new Map([[start.key,null]]); let frontier=[start], bestE=null, bv=cur+0.5;
    for(let d=0;d<left;d++){
      const nx=[];
      for(const e of frontier) for(const k of [e.a,e.b]) for(const ek of B.corners.get(k).edges){
        const t=B.edges.get(ek); if(seen.has(t.key)||!okE(t)) continue; seen.set(t.key,e); nx.push(t);
        const v=heroValue(G,p,t); if(v>bv){bv=v;bestE=t;}
      }
      frontier=nx;
    }
    if(!bestE) return null;
    let s=bestE; while(seen.get(s.key)&&seen.get(s.key)!==start) s=seen.get(s.key);
    return E.heroMoveInfo(G,p,s).err?null:{t:'hero',e:s};
  }
  function armyStep(G,p){
    const TH=E.threats(G,p), thEdges=new Set(); TH.forEach(t=>t.c.edges.forEach(k=>thEdges.add(k)));
    const leader=best([...Array(G.np).keys()].filter(q=>q!==p),q=>E.vp(G,q,false));
    let bestA=null, bs=0;
    // road distance from every road to the nearest worthwhile target: an enemy fisherman to blockade, or any enemy stack
    const B=G.B, dist=new Map(), q=[];
    for(const e of B.edges.values()){
      if(!e.road&&(e.river||e.valid===false||!e.tiles.some(t=>!t.rim&&t.terrain!=='lake'))) continue;
      const fisher=[e.a,e.b].some(k=>{const c=B.corners.get(k);return c.fisher&&c.building&&c.building.p!==p;});
      const enemy=[e.a,e.b].some(k=>B.corners.get(k).edges.some(x=>{const y=B.edges.get(x);return y.army&&y.army.p!==p;}));
      const besiegeable=[e.a,e.b].some(k=>{const c=B.corners.get(k);return c.building&&c.building.p!==p;});
      if(fisher||enemy||besiegeable){dist.set(e.key,0);q.push(e);}
    }
    while(q.length){const e=q.shift(),d=dist.get(e.key);if(d>=8) continue;
      for(const k of [e.a,e.b]) for(const x of B.corners.get(k).edges){const y=B.edges.get(x);if(dist.has(y.key)||(!y.road&&(y.river||y.valid===false||!y.tiles.some(t=>!t.rim&&t.terrain!=='lake')))) continue;dist.set(y.key,d+1);q.push(y);}}
    for(const from of E.legal.movable(G,p)) for(const to of E.legal.moves(G,from)){
      const info=E.moveInfo(G,from,to); let s=-info.cost*0.6;
      if(info.battle){ if(!info.battle.attWins) continue; s+=(8+(info.battle.defender===leader?2:0)+(E.total(G.players[info.battle.defender].hand)?1.5:0))*(1+(AI(G,p).aggr||0)*0.3);
        if(TH.some(t=>t.by===info.battle.defender)) s+=3;
        if([to.a,to.b].some(k=>{const c=B.corners.get(k);return c.building&&c.building.p===p;})) s+=4; }
      else {
        // march up to a weaker enemy stack so it can be attacked next turn
        for(const k of [to.a,to.b]) for(const ek of G.B.corners.get(k).edges){const x=G.B.edges.get(ek);
          if(x===to||!x.army||x.army.p===p) continue;
          const str=x.army.n+([x.a,x.b].some(kk=>{const c=G.B.corners.get(kk);return c.building&&c.building.p===x.army.p;})?1:0);
          if(1+Math.max(0,from.army.n-1)>str) s+=2.5+(x.army.p===leader?1:0);}
        const df=dist.get(from.key), dt=dist.get(to.key);
        if(df!==undefined&&dt!==undefined&&dt<df) s+=1.2+(G.heroes[p].ability==='warlord'?0.6:0);
      }
      // would standing here besiege an enemy village or city?
      {const n2=1+(to.army&&to.army.p===p&&!info.battle?to.army.n:0);
       for(const k of [to.a,to.b]){const c=B.corners.get(k);if(!c.building||c.building.p===p||E.siegedBy(G,c)===p) continue;
         const others=c.edges.map(x=>B.edges.get(x)).filter(x=>x!==to&&x!==from&&x.army&&x.army.p===p).reduce((a,x)=>a+x.army.n,0);
         if(n2+others>=(c.building.type==='city'?2:1)) s+=4+(c.building.p===leader?2:0)+(c.building.type==='city'?1:0);}
       // leaving a siege throws it away
       for(const k of [from.a,from.b]){const c=B.corners.get(k);if(c.building&&c.building.p!==p&&E.siegedBy(G,c)===p) s-=5;}}
      const ev=G.events, mine=t=>t.corners.some(k=>{const c=G.B.corners.get(k);return c.building&&c.building.p===p;});
      for(const t of to.tiles){
        if(ev.wolf&&t.key===ev.wolf.tile) s+=mine(t)?5:1;
        if(ev.bandits&&t.key===ev.bandits.tile) s+=mine(t)?5:1;
        if(t===G.robber&&mine(t)) s+=6;
      }
      if([to.a,to.b].some(k=>{const c=G.B.corners.get(k);return c.fisher&&c.building&&c.building.p!==p;})) s+=2;
      // stand guard on a road beside a threatened building of ours
      if(!info.battle&&thEdges.has(to.key)&&!thEdges.has(from.key)) s+=5;
      if(s>bs){bs=s;bestA={t:'move',from,to};}
    }
    return bestA;
  }
  function devPlay(G,p,W,tgt){
    const P=G.players[p]; if(G.devPlayed||G.phase!=='main') return null;
    const has=k=>P.dev.includes(k);
    if(has('roads')&&bestSpot(G,p,W)&&E.legal.road(G,p).length) return {t:'dev',k:'roads'};
    if(has('plenty')&&RKEYS.filter(r=>r!=='fish'&&G.bank[r]>0).length>=2){const need=RKEYS.filter(r=>r!=='fish'&&G.bank[r]>0).sort((a,b)=>((tgt.cost[b]||0)-P.hand[b])-((tgt.cost[a]||0)-P.hand[a])||W.w[b]-W.w[a]);return {t:'dev',k:'plenty',args:{res:[need[0],need[0]===need[1]?need[0]:need[1]]}};}
    if(has('reinf')&&E.count(G,p,'army')<LIMITS.army&&E.legal.army(G,p).length) return {t:'dev',k:'reinf'};
    if(has('catch')&&E.count(G,p,'fisher')>0) return {t:'dev',k:'catch'};
    if(has('scout')&&G.robber&&G.robber.corners.some(k=>{const c=G.B.corners.get(k);return c.building&&c.building.p===p;})) return {t:'dev',k:'scout',args:{target:'robber'}};
    return null;
  }
  // The next action for a bot during its main phase.
  function decide(G,p,turn){
    const P=G.players[p], can=c=>E.canAfford(G,p,c), W=weights(G,p);
    if(G.freeArmy>0||E.hasCredit(G,p,'muster')){const L=E.legal.army(G,p);if(L.length) return {t:'army',e:L[0]};}
    if(E.hasCredit(G,p,'commission')){const spot=bestSpot(G,p,W);if(spot&&spot.path.length&&!E.whyNotRoad(G,p,spot.path[0])) return {t:'road',e:spot.path[0]};}
    if(G.freeRoads>0){const spot=bestSpot(G,p,W);const L=E.legal.road(G,p);
      if(L.length){const e=spot&&spot.path.length&&L.includes(spot.path[0])?spot.path[0]:best(L,e=>Math.max(...[e.a,e.b].map(k=>spotValue(G,p,G.B.corners.get(k),W))));return {t:'road',e};}}
    const C=E.legal.city(G,p); if(can(COSTS.city)&&C.length) return {t:'city',c:best(C,c=>spotValue(G,p,c,W))};
    const V=E.legal.village(G,p); if(can(COSTS.village)&&V.length) return {t:'village',c:best(V,c=>spotValue(G,p,c,W))};
    const tgt=chooseTarget(G,p,W);
    const dv=devPlay(G,p,W,tgt); if(dv) return dv;
    {const of=makeOffer(G,p,turn); if(of) return {t:'offer',...of};}
    if(turn.trades<(AI(G,p).hard?6:4)){const tr=tradeFor(G,p,tgt.cost,W); if(tr) return tr;}
    if(tgt.kind==='road'&&can(tgt.cost)&&!E.whyNotRoad(G,p,tgt.edge)) return {t:'road',e:tgt.edge};
    const F=E.legal.fisher(G,p); if(F.length&&can(COSTS.fisher)&&E.total(P.hand)>=6-(AI(G,p).fishBias||0)*3) return {t:'fisher',c:F[0]};
    const others=[...Array(G.np).keys()].filter(q=>q!==p).map(q=>E.count(G,q,'army'));
    const besieged=E.sieges(G).some(x=>x.c.building.p===p);
    const ai=AI(G,p);
    const want=Math.max(0,Math.min(5,(ai.armies||0)+(besieged||E.threats(G,p).length?1:0)+Math.max(2,Math.max(0,...others)+1)+(G.heroes[p].ability==='warlord'?1:0)));
    const A=E.legal.army(G,p);
    if(A.length&&can(COSTS.army)&&E.count(G,p,'army')<want&&(tgt.kind!=='city'||P.hand.iron>=5)) return {t:'army',e:best(A,e=>(e.army?-1:1)+Math.random())};
    if(!turn.moved&&(ai.aggr??1)>0){const mv=armyStep(G,p); if(mv) return mv;
      // armies marching onto other players' roads need fish: buy some with spare cards
      if(E.count(G,p,'army')>=2&&P.hand.fish<2&&turn.trades<5&&E.legal.movable(G,p).length){const tr=tradeFor(G,p,{fish:2},W);if(tr){turn.trades++;return tr;}}}
    const hs=heroStep(G,p); if(hs) return hs;
    if(can(COSTS.dev)&&G.deck.length&&(tgt.kind==='dev'||E.total(P.hand)>=8-(ai.devBias||0)*4)) return {t:'buydev'};
    return {t:'end'};
  }
  // Should a bot accept a trade where it receives `gets` and pays `gives`?
  function acceptsTrade(G,bot,from,gets,gives){
    const ai=AI(G,bot);
    if(E.vp(G,from,false)>=8||((ai.leaderHate||1)>1.4&&E.vp(G,from,false)>=7)) return false;
    const W=weights(G,bot), h=G.players[bot].hand;
    if(RKEYS.some(r=>(gives[r]||0)>h[r])) return false;
    let v=0; for(const r of RKEYS) v+=(gets[r]||0)*W.w[r]-(gives[r]||0)*W.w[r]*1.15;
    return v>0.1+(ai.tradeT||0);
  }
  // A bot's answer to an offer where it would receive `gets` and pay `gives`: accept, decline, or a counter-offer.
  function respond(G,bot,from,gets,gives){
    if(E.vp(G,from,false)>=8) return {r:'decline'};
    if(RKEYS.some(r=>(gives[r]||0)>G.players[bot].hand[r])) return {r:'decline'};
    if(acceptsTrade(G,bot,from,gets,gives)) return {r:'accept'};
    if(Math.random()>(AI(G,bot).counter??0.6)) return {r:'decline'};
    const W=weights(G,bot), ph=G.players[from].hand;
    const want=RKEYS.filter(r=>r!=='fish'&&!gives[r]&&ph[r]>(gets[r]||0)).sort((a,b)=>W.w[b]-W.w[a])[0];
    if(want){const g2={...gets,[want]:(gets[want]||0)+1};if(acceptsTrade(G,bot,from,g2,gives)) return {r:'counter',gets:g2,gives};}
    const k=Object.keys(gives).find(r=>gives[r]>1);
    if(k){const v2={...gives,[k]:gives[k]-1};if(acceptsTrade(G,bot,from,gets,v2)) return {r:'counter',gets,gives:v2};}
    return {r:'decline'};
  }
  // An offer a bot makes to the table when it is one or two cards short of what it's saving for.
  function makeOffer(G,p,turn){
    if((turn.offers||0)>=(AI(G,p).offers??1)) return null;
    const W=weights(G,p), tgt=chooseTarget(G,p,W), h=G.players[p].hand;
    const missing=RKEYS.filter(r=>(tgt.cost[r]||0)>h[r]);
    const short=missing.reduce((s,r)=>s+((tgt.cost[r]||0)-h[r]),0);
    if(!missing.length||short>2) return null;
    const surplus=RKEYS.filter(r=>h[r]-(tgt.cost[r]||0)>=1).sort((a,b)=>(h[b]-(tgt.cost[b]||0))/W.w[b]-(h[a]-(tgt.cost[a]||0))/W.w[a]);
    if(!surplus.length) return null;
    return {give:{[surplus[0]]:1},get:{[best(missing,r=>W.w[r])]:1}};
  }
  return {decide,discard,robberTile,stealFrom,setupVillage,setupRoad,acceptsTrade,respond,makeOffer};
})();

