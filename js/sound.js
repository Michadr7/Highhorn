/* Highhorn 0.24: sound effects, music and ambience (Web Audio).
   Files load in this order: engine.js, bots.js, sound.js, game.js. */
'use strict';
/* =====================================================================
   SOUND AND MUSIC (generated in the browser with Web Audio; no files)
   ===================================================================== */
const Snd = (() => {
  const AC=window.AudioContext||window.webkitAudioContext;
  let ctx=null, master, sfx, mus, nbuf=null, musTimer=null, nextBar=0, bar=0;
  const prefs=(()=>{try{return Object.assign({sfx:true,music:true,sfxVol:0.7,musVol:0.3},JSON.parse(localStorage.getItem('hexworld.audio')||'{}'));}catch(e){return {sfx:true,music:true,sfxVol:0.7,musVol:0.3};}})();
  const save=()=>{try{localStorage.setItem('hexworld.audio',JSON.stringify(prefs));}catch(e){}};
  function unlock(){
    if(!AC) return;
    if(!ctx){ctx=new AC();master=ctx.createGain();master.gain.value=0.9;
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=3;comp.attack.value=0.004;comp.release.value=0.2;
      master.connect(comp);comp.connect(ctx.destination);
      sfx=ctx.createGain();mus=ctx.createGain();sfx.connect(master);mus.connect(master);
      try{const len=Math.floor(ctx.sampleRate*1.3),ir=ctx.createBuffer(2,len,ctx.sampleRate);
        for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
        const rev=ctx.createConvolver();rev.buffer=ir;const wet=ctx.createGain();wet.gain.value=0.16;sfx.connect(rev);rev.connect(wet);wet.connect(master);}catch(e){}
      setInterval(ambTick,450);
      apply();}
    if(ctx.state==='suspended') ctx.resume();
    if(prefs.music&&!musTimer) startMusic();
  }
  function apply(){if(!ctx) return;sfx.gain.value=prefs.sfx?prefs.sfxVol:0;mus.gain.setTargetAtTime(prefs.music?prefs.musVol*0.5:0,ctx.currentTime,0.4);}
  function set(k,v){prefs[k]=v;save();apply();if(ctx&&k==='music'){if(v&&!musTimer) startMusic();}}
  const env=(g,t,a,d,pk)=>{g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(pk,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);};
  function tone(f,t,o={}){
    const {type='sine',a=0.005,d=0.3,pk=0.2,glide=null,lp=null,dest=sfx}=o;
    const os=ctx.createOscillator(),g=ctx.createGain();os.type=type;os.frequency.setValueAtTime(f,t);
    if(glide) os.frequency.exponentialRampToValueAtTime(glide,t+a+d);
    os.connect(g); if(lp){const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=lp;g.connect(fl);fl.connect(dest);} else g.connect(dest);
    env(g,t,a,d,pk); os.start(t); os.stop(t+a+d+0.05);
  }
  function noise(t,o={}){
    const {d=0.2,pk=0.2,type='bandpass',f=1000,q=1,a=0.005,to=null,dest=sfx}=o;
    if(!nbuf){nbuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const ch=nbuf.getChannelData(0);for(let i=0;i<ch.length;i++) ch[i]=Math.random()*2-1;}
    const s=ctx.createBufferSource();s.buffer=nbuf;const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f,t);fl.Q.value=q;
    if(to) fl.frequency.exponentialRampToValueAtTime(to,t+a+d);
    const g=ctx.createGain();s.connect(fl);fl.connect(g);g.connect(dest);env(g,t,a,d,pk);s.start(t,Math.random());s.stop(t+a+d+0.05);
  }
  const arp=(t,fs,step,o)=>fs.forEach((f,i)=>tone(f,t+i*step,o));
  const drum=(t,pk=0.4)=>tone(95,t,{glide:45,d:0.22,pk});
  const PITCH={timber:523,clay:587,leather:659,wheat:784,iron:880,fish:988};
  const S={
    dice:t=>{for(let i=0;i<8;i++) noise(t+i*0.09+Math.random()*0.03,{d:0.05,pk:0.22,f:2200+Math.random()*2400,q:3});tone(150,t+0.9,{type:'triangle',d:0.12,pk:0.3});tone(125,t+0.98,{type:'triangle',d:0.14,pk:0.25});},
    build:t=>{tone(110,t,{type:'triangle',d:0.15,pk:0.35});noise(t,{d:0.08,f:600,pk:0.15});tone(88,t+0.13,{type:'triangle',d:0.16,pk:0.3});},
    city:t=>{S.build(t);tone(880,t+0.28,{d:1.2,pk:0.1});tone(1320,t+0.28,{d:1,pk:0.05});},
    road:t=>{noise(t,{d:0.2,type:'lowpass',f:900,pk:0.18});tone(130,t+0.14,{type:'triangle',d:0.1,pk:0.25});},
    bridge:t=>{S.road(t);tone(98,t+0.25,{type:'triangle',d:0.2,pk:0.3});},
    splash:t=>{noise(t,{d:0.4,type:'highpass',f:1400,pk:0.14});tone(380,t,{glide:950,d:0.14,pk:0.06});},
    march:t=>{drum(t);drum(t+0.18,0.3);},
    collect:(t,r)=>{const f=PITCH[r]||700;tone(f,t,{type:'triangle',d:0.25,pk:0.1});tone(f*1.5,t+0.05,{d:0.3,pk:0.05});},
    coin:t=>{tone(1567,t,{d:0.12,pk:0.08});tone(2093,t+0.07,{d:0.3,pk:0.07});},
    card:t=>{noise(t,{type:'highpass',f:3000,d:0.08,pk:0.12});noise(t+0.06,{type:'highpass',f:4200,d:0.05,pk:0.08});},
    clash:t=>{noise(t,{type:'highpass',f:3500,d:0.12,pk:0.18});tone(1800+Math.random()*700,t,{type:'square',d:0.07,pk:0.025,lp:4000});tone(2600+Math.random()*400,t,{d:0.3,pk:0.03});},
    victory:t=>arp(t,[523,659,784,1047],0.1,{type:'triangle',d:0.35,pk:0.12}),
    defeat:t=>arp(t,[440,415,392,330],0.15,{type:'triangle',d:0.4,pk:0.1}),
    fanfare:t=>arp(t,[392,523,659,784,659,784],0.12,{type:'square',d:0.18,pk:0.05,lp:2200}),
    win:t=>{S.fanfare(t);[523,659,784].forEach(f=>tone(f,t+0.8,{type:'triangle',a:0.05,d:1.6,pk:0.08}));},
    turn:t=>{tone(660,t,{d:0.5,pk:0.07});tone(990,t+0.1,{d:0.6,pk:0.05});},
    whoosh:t=>noise(t,{type:'bandpass',f:300,to:1400,d:0.5,q:2,pk:0.18,a:0.05}),
    evend:t=>arp(t,[784,659],0.14,{d:0.5,pk:0.07}),
    siege:t=>{for(let i=0;i<7;i++) drum(t+i*(0.2-i*0.015),0.25+i*0.03);tone(110,t+0.9,{type:'sawtooth',a:0.1,d:0.9,pk:0.06,lp:700});},
    error:t=>tone(160,t,{type:'square',d:0.12,pk:0.025,lp:600}),
    ev_wolf:t=>{tone(380,t,{a:0.25,d:0.9,glide:640,pk:0.11});tone(640,t+1.05,{a:0.1,d:0.9,glide:420,pk:0.09});},
    ev_storm:t=>{noise(t,{type:'lowpass',f:160,d:1.8,a:0.06,pk:0.5});noise(t,{type:'highpass',f:5000,d:1.8,a:0.3,pk:0.04});},
    ev_flood:t=>noise(t,{type:'lowpass',f:250,to:1300,d:1.5,a:0.2,pk:0.25}),
    ev_merchant:t=>arp(t,[1047,1319,1568,1319],0.16,{d:0.7,pk:0.07}),
    ev_bandits:t=>{drum(t,0.35);[147,175,208].forEach(f=>tone(f,t+0.05,{type:'sawtooth',a:0.03,d:0.8,pk:0.05,lp:800}));},
    ev_harvest:t=>arp(t,[587,740,880,1175],0.11,{type:'triangle',d:0.45,pk:0.1}),
    ev_calving:t=>{arp(t,[523,659,784,1047],0.12,{type:'triangle',d:0.4,pk:0.09});tone(220,t+0.55,{type:'sawtooth',a:0.08,d:0.5,glide:180,pk:0.04,lp:900});},
    ev_fishrun:t=>arp(t,[800,1000,1300,1700,2100],0.07,{d:0.18,pk:0.07}),
    ev_commission:t=>S.fanfare(t),
    ev_muster:t=>{drum(t);drum(t+0.25);S.fanfare(t+0.4);},
    robbed:t=>{S.whoosh(t);arp(t+0.15,[523,440,349,294],0.13,{type:'triangle',d:0.35,pk:0.1});},
    sneak:t=>arp(t,[196,0,233,262],0.11,{type:'triangle',d:0.09,pk:0.12}),
    seven:t=>{tone(98,t,{type:'sawtooth',a:0.05,d:1.3,pk:0.07,lp:500});tone(116.5,t,{type:'sawtooth',a:0.05,d:1.3,pk:0.06,lp:500});drum(t,0.3);},
    decline:t=>arp(t,[330,247],0.12,{type:'square',d:0.12,pk:0.03,lp:900}),
    offer:t=>arp(t,[880,1175],0.1,{d:0.35,pk:0.07}),
    thud:t=>{tone(70,t,{glide:40,d:0.3,pk:0.4});noise(t,{type:'lowpass',f:300,d:0.2,pk:0.2});},
    sad:t=>arp(t,[392,370,349],0.2,{type:'triangle',d:0.5,pk:0.07}),
    tick:t=>tone(1400,t,{type:'square',d:0.04,pk:0.03,lp:3000}),
    yak:t=>{tone(150,t,{type:'sawtooth',a:0.06,d:0.55,glide:95,pk:0.08,lp:700});tone(225,t,{type:'sawtooth',a:0.06,d:0.5,glide:140,pk:0.03,lp:900});noise(t+0.05,{type:'lowpass',f:500,d:0.3,pk:0.05});},
    pop:t=>{noise(t,{type:'highpass',f:2000,d:0.25,pk:0.12});tone(1200+Math.random()*800,t+0.02,{d:0.3,pk:0.03});},
  };
  /* ---- chunkier, wooden sounds (0.21) ---- */
  // A wooden knock: a short resonant body plus an inharmonic overtone, like a wood block or a game piece set down hard
  function wood(t,f=220,pk=0.3,d=0.12){
    tone(f,t,{type:'sine',a:0.002,d,pk});tone(f*2.76,t,{type:'sine',a:0.001,d:d*0.45,pk:pk*0.35});
    noise(t,{type:'bandpass',f:f*4,q:3,d:0.025,pk:pk*0.6,a:0.001});
  }
  const clack=(t,pk=0.3)=>{const f=1500+Math.random()*900;tone(f,t,{a:0.001,d:0.035,pk:pk*0.5});noise(t,{type:'bandpass',f:f*1.6,q:5,d:0.03,pk,a:0.001});};
  const thump=(t,pk=0.4,f=70)=>tone(f,t,{glide:f*0.55,a:0.002,d:0.18,pk});
  function metal(t,f=1800,pk=0.06,d=0.9){[1,2.76,5.4].forEach((m,i)=>tone(f*m,t,{a:0.001,d:d/(1+i*0.8),pk:pk/(1+i*1.3)}));noise(t,{type:'highpass',f:6000,d:0.02,pk:pk*1.5,a:0.001});}
  const paper=(t,pk=0.16)=>{noise(t,{type:'bandpass',f:2400,to:5200,q:0.8,d:0.07,pk,a:0.004});noise(t+0.07,{type:'lowpass',f:900,d:0.04,pk:pk*0.6,a:0.001});};
  function frame(t,pk=0.45){tone(78,t,{glide:42,a:0.003,d:0.32,pk});tone(150,t,{a:0.002,d:0.12,pk:pk*0.25});noise(t,{type:'lowpass',f:260,d:0.08,pk:pk*0.55,a:0.001});}
  const step=(t,pk=0.18)=>{noise(t,{type:'lowpass',f:700+Math.random()*300,d:0.07,pk,a:0.004});thump(t,pk*0.6,95);};
  const horn=(t,f,d=0.4,pk=0.05)=>{tone(f,t,{type:'sawtooth',a:0.03,d,pk,lp:1500});tone(f/2,t,{type:'triangle',a:0.03,d,pk:pk*0.8});};
  Object.assign(S,{
    dice:t=>{for(let i=0;i<9;i++){const k=t+i*0.075+Math.random()*0.02;clack(k,0.07+Math.random()*0.05);}
      noise(t,{type:'lowpass',f:500,d:0.7,a:0.05,pk:0.05});
      for(const off of [0,0.05]){const k=t+0.78+off;clack(k,0.42);wood(k,190,0.14,0.08);clack(k+0.11,0.24);clack(k+0.18,0.13);clack(k+0.23,0.06);}},
    build:t=>{wood(t,210,0.36,0.14);thump(t,0.3);wood(t+0.12,175,0.3,0.16);noise(t+0.12,{type:'lowpass',f:500,d:0.15,pk:0.06});},
    city:t=>{S.build(t);wood(t+0.26,150,0.38,0.2);thump(t+0.26,0.4,60);metal(t+0.42,880,0.05,1.4);},
    road:t=>{wood(t,300,0.22,0.08);wood(t+0.09,340,0.2,0.08);wood(t+0.18,380,0.2,0.09);noise(t,{type:'lowpass',f:800,d:0.25,pk:0.07});},
    bridge:t=>{S.road(t);wood(t+0.3,140,0.36,0.3);thump(t+0.3,0.28,65);},
    march:t=>{for(let i=0;i<4;i++) step(t+i*0.16,0.16+(i%2)*0.04);metal(t+0.05,2600,0.012,0.25);},
    collect:(t,r)=>{clack(t,0.16);wood(t,(PITCH[r]||700)*0.5,0.12,0.18);tone((PITCH[r]||700),t+0.03,{type:'triangle',d:0.3,pk:0.05});},
    coin:t=>{metal(t,1900,0.06,0.5);metal(t+0.08,2550,0.05,0.7);clack(t+0.08,0.08);},
    card:t=>{paper(t,0.15);clack(t+0.09,0.06);},
    clash:t=>{metal(t,900+Math.random()*400,0.09,0.7);noise(t,{type:'highpass',f:2500,d:0.1,pk:0.2,a:0.001});thump(t,0.35,85);},
    fanfare:t=>[392,523,659,784,659,784].forEach((f,i)=>horn(t+i*0.13,f,0.22,0.05)),
    win:t=>{S.fanfare(t);[523,659,784].forEach(f=>horn(t+0.85,f,1.6,0.045));frame(t+0.85,0.4);},
    turn:t=>{metal(t,1320,0.035,1.1);metal(t+0.12,1760,0.025,1.2);},
    error:t=>{wood(t,170,0.3,0.07);wood(t+0.11,130,0.3,0.1);},
    tick:t=>clack(t,0.12),
    siege:t=>{for(let i=0;i<7;i++) frame(t+i*(0.2-i*0.015),0.3+i*0.035);
      for(let i=0;i<10;i++) noise(t+0.9+Math.random()*1.2,{type:'bandpass',f:1500+Math.random()*2500,q:4,d:0.02,pk:0.05,a:0.001});
      noise(t+0.9,{type:'lowpass',f:400,d:1.2,a:0.1,pk:0.06});},
    march2:t=>S.march(t),
    thud:t=>{thump(t,0.5,62);noise(t,{type:'lowpass',f:260,d:0.2,pk:0.2});},
    ev_bandits:t=>{frame(t,0.4);frame(t+0.18,0.3);[147,175,208].forEach(f=>horn(t+0.05,f,0.8,0.035));},
    ev_muster:t=>{frame(t);frame(t+0.25);S.fanfare(t+0.4);},
    seven:t=>{frame(t,0.45);tone(98,t,{type:'sawtooth',a:0.05,d:1.3,pk:0.06,lp:450});tone(116.5,t,{type:'sawtooth',a:0.05,d:1.3,pk:0.05,lp:450});},
    decline:t=>{wood(t,260,0.2,0.07);wood(t+0.12,200,0.2,0.1);},
    offer:t=>{metal(t,1568,0.035,0.6);metal(t+0.1,2093,0.03,0.7);},
    sneak:t=>[196,233,262].forEach((f,i)=>wood(t+i*0.12,f,0.18,0.1)),
    pop:t=>{noise(t,{type:'highpass',f:1500,d:0.3,pk:0.14});thump(t,0.18,110);metal(t+0.05,2400+Math.random()*900,0.02,0.6);},
  });
  // Day and night ambience on the music channel: birdsong by day, crickets and the odd owl at night
  function ambTick(){
    if(!ctx||!prefs.music||ctx.state!=='running') return;
    const night=(typeof DN!=='undefined'&&DN.dayF!==undefined)?1-DN.dayF:0, t=ctx.currentTime+0.05, M={dest:mus};
    if(night>0.6){ if(Math.random()<0.55){const f=4100+Math.random()*500,n=3+Math.floor(Math.random()*2);for(let i=0;i<n;i++) tone(f,t+i*0.045,{a:0.003,d:0.03,pk:0.018,...M});}
      if(Math.random()<0.012){tone(420,t,{a:0.05,d:0.35,glide:380,pk:0.05,...M});tone(400,t+0.5,{a:0.05,d:0.6,glide:350,pk:0.045,...M});}}
    else if(night<0.3&&Math.random()<0.1){const base=2400+Math.random()*1400,n=2+Math.floor(Math.random()*4);
      for(let i=0;i<n;i++) tone(base*(1+(Math.random()-0.4)*0.25),t+i*0.11,{a:0.005,d:0.07,glide:base*1.3,pk:0.02,...M});}
  }
  function play(name,arg,delay=0){
    if(!ctx||!prefs.sfx||!S[name]) return;
    try{S[name](ctx.currentTime+0.01+delay,arg);}catch(e){}
  }
  // Generative folk ambience: a slow D dorian progression with a soft pad, bass and a wandering pluck.
  const ROOT=146.83, PROG=[[0,3,7],[-2,2,5],[-4,0,3],[-2,2,5]], PENTA=[0,3,5,7,10,12,15,17];
  const hz=n=>ROOT*Math.pow(2,n/12);
  function scheduleBar(t){
    const ch=PROG[bar%4], B=60/68*4;
    for(const n of ch){const o=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),fl=ctx.createBiquadFilter();
      o.type='triangle';o2.type='triangle';o.frequency.value=hz(n+12);o2.frequency.value=hz(n+12)*1.004;fl.type='lowpass';fl.frequency.value=900;
      const nf=(typeof DN!=='undefined'&&DN.dayF!==undefined)?0.55+0.45*DN.dayF:1;
      o.connect(g);o2.connect(g);g.connect(fl);fl.connect(mus);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.035*nf,t+1.2);g.gain.linearRampToValueAtTime(0.0001,t+B+0.6);
      o.start(t);o2.start(t);o.stop(t+B+0.7);o2.stop(t+B+0.7);}
    tone(hz(ch[0]-12),t,{type:'sine',a:0.02,d:B*0.9,pk:0.09,dest:mus});
    let last=-1;
    const night=(typeof DN!=='undefined'&&DN.dayF!==undefined)?1-DN.dayF:0;
    for(let i=0;i<8;i++){if(Math.random()<0.42-night*0.2){let n;do{n=PENTA[Math.floor(Math.random()*PENTA.length)];}while(n===last);last=n;
      tone(hz(n+24),t+i*B/8,{type:'triangle',a:0.004,d:0.7,pk:0.045,dest:mus});}}
    bar++;
  }
  function startMusic(){
    if(!ctx) return; nextBar=Math.max(nextBar,ctx.currentTime+0.1);
    musTimer=setInterval(()=>{if(!prefs.music){clearInterval(musTimer);musTimer=null;return;}
      while(nextBar<ctx.currentTime+0.6){scheduleBar(nextBar);nextBar+=60/68*4;}},200);
  }
  return {unlock,play,set,prefs};
})();
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>Snd.unlock(),{passive:true}));

