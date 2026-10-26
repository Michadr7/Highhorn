/* Highhorn 0.24: 3D board, interface, lobby and saving.
   Files load in this order: engine.js, bots.js, sound.js, game.js. */
'use strict';
/* =====================================================================
   RENDERING (draws the board and game state; never changes rules)
   ===================================================================== */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
// Graphics quality: pixel density, shadows, how much scenery, frame rate and small effects
const QUALITY={low:{pr:1,shadows:0,dens:0.5,fps:30,fx:false},medium:{pr:1.5,shadows:1024,dens:0.75,fps:60,fx:true},high:{pr:2,shadows:2048,dens:1,fps:60,fx:true}};
let Q=QUALITY.high, curBoard=null, lastFrame=0, slowFrames=0, slowWarned=false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(); scene.fog=new THREE.Fog(0xc9d8dc,20,60);
const camera=new THREE.PerspectiveCamera(40,1,0.1,400);
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true; controls.dampingFactor=0.08; controls.maxPolarAngle=1.32; controls.minPolarAngle=0.12; controls.minDistance=3; controls.maxDistance=70;
const hemi=new THREE.HemisphereLight(0xdfeef5,0x6d6152,0.65); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff3df,1); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.02;
scene.add(sun); scene.add(sun.target);
const ground=new THREE.Mesh(new THREE.CircleGeometry(250,48),new THREE.MeshLambertMaterial({color:0xaebfb8}));
ground.rotation.x=-Math.PI/2; ground.position.y=-0.02; ground.receiveShadow=true; scene.add(ground);
const PIECE=1.4, ARMY_S=1.35, HERO_S=1.5, TOKEN_S=1.42;
let tokenMeshes=[];
const LAND_H=0.35, TOP=LAND_H+0.03, WATER=LAND_H-0.03;
const M=(c,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:0.95,metalness:0,flatShading:true},o));
const MAT={soil:M(0x7b5d43),rockDark:M(0x55504c),white:M(0xffffff),
  water:M(0x4a8fb5,{transparent:true,opacity:0.9,roughness:0.25,flatShading:false}),
  river:M(0x5aa3c8,{roughness:0.3}),tokenSide:M(0x7e5531),tokenSideFish:M(0x4f6f80),wood:M(0x7a5434),plank:M(0x9a7048),robber:M(0x2a2a30),
  outline:M(0x2b2a28),chim:M(0x5b4a40),gap:M(0x7d8a6a),skin:M(0xd9ae86),steel:M(0xb9bec6,{roughness:0.5}),foam:new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.75})};
MAT.smoke=new THREE.MeshStandardMaterial({color:0xe9e7e2,transparent:true,opacity:0.55,depthWrite:false,roughness:1});
const riverTex=(()=>{const c=document.createElement('canvas');c.width=64;c.height=128;const g=c.getContext('2d');
  g.fillStyle='#4f9dc6';g.fillRect(0,0,64,128);
  for(let i=0;i<14;i++){const x=4+Math.random()*56,y=Math.random()*128,l=10+Math.random()*22;g.strokeStyle=`rgba(255,255,255,${0.18+Math.random()*0.3})`;g.lineWidth=1.5+Math.random()*2;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+3,y+l/2,x,y+l);g.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,2);return t;})();
MAT.river=new THREE.MeshStandardMaterial({map:riverTex,roughness:0.25,metalness:0.05});
MAT.door=M(0x4a3020); MAT.peakBody=M(0x5a4a3c); MAT.rut=M(0x7d6446);
MAT.win=new THREE.MeshStandardMaterial({color:0xffd27a,emissive:0xffb347,emissiveIntensity:0.15,roughness:0.6}); MAT.foamRing=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.45,depthWrite:false}); MAT.bank=M(0x6f8a4e); MAT.dirt=M(0x9a7f5a); MAT.stone=M(0x8d8a84);
MAT.rain=new THREE.MeshBasicMaterial({color:0xd8e8f4,transparent:true,opacity:0.55,depthWrite:false});
MAT.shaft=new THREE.MeshBasicMaterial({color:0xffd970,transparent:true,opacity:0.16,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
MAT.glow=new THREE.MeshBasicMaterial({color:0xffe08a,transparent:true,opacity:0.45,depthWrite:false});
MAT.lantern=new THREE.MeshStandardMaterial({color:0xffd27a,emissive:0xffb347,emissiveIntensity:1.2});
MAT.eyes=new THREE.MeshBasicMaterial({color:0xffb347});
MAT.spark=new THREE.MeshBasicMaterial({color:0xfff1b0});
MAT.puddle=new THREE.MeshStandardMaterial({color:0x6d8fa3,transparent:true,opacity:0.75,roughness:0.2});
const LINE=new THREE.LineBasicMaterial({color:0x2f3540});
const edgeGeos=new Map(); const edgeGeo=g=>{if(!edgeGeos.has(g.uuid)) edgeGeos.set(g.uuid,new THREE.EdgesGeometry(g,25));return edgeGeos.get(g.uuid);};
const swayU={uTime:{value:0},uSway:{value:0.14}};
MAT.sway=M(0xffffff);
MAT.sway.onBeforeCompile=sh=>{
  sh.uniforms.uTime=swayU.uTime; sh.uniforms.uSway=swayU.uSway;
  sh.vertexShader='uniform float uTime;\nuniform float uSway;\n'+sh.vertexShader.replace('#include <begin_vertex>',
`#include <begin_vertex>
#ifdef USE_INSTANCING
  vec4 swp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
#else
  vec4 swp = vec4(0.0);
#endif
  float swh = max(transformed.y, 0.0);
  transformed.x += sin(uTime*1.7 + swp.x*1.9 + swp.z*1.3) * swh * uSway;
  transformed.z += cos(uTime*1.3 + swp.z*1.7 + swp.x*0.9) * swh * uSway * 0.6;`);
};
// Carved-miniature shapes: every edge gets a small chamfer, like whittled and sanded wood.
function tokenPlaque(r,depth,b){
  const sh=new THREE.Shape();for(let i=0;i<=6;i++){const a=Math.PI/6+i*Math.PI/3;const x=Math.sin(a)*(r-b),y=Math.cos(a)*(r-b);i?sh.lineTo(x,y):sh.moveTo(x,y);}
  const V=THREE.Vector2, uv=(vs,i)=>new V(vs[i*3]/(2*r)+0.5,vs[i*3+1]/(2*r)+0.5);
  const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,steps:1,
    UVGenerator:{generateTopUV:(geo,vs,a,c,d)=>[uv(vs,a),uv(vs,c),uv(vs,d)],generateSideWallUV:()=>[new V(0,0),new V(1,0),new V(1,1),new V(0,1)]}});
  return g.rotateX(-Math.PI/2).translate(0,b,0);
}
function bevelBox(w,h,d,b=0.012){
  const x=w/2-b,y=h/2-b,sh=new THREE.Shape();sh.moveTo(-x,-y);sh.lineTo(x,-y);sh.lineTo(x,y);sh.lineTo(-x,y);sh.lineTo(-x,-y);
  const g=new THREE.ExtrudeGeometry(sh,{depth:Math.max(0.001,d-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,steps:1});
  return g.translate(0,0,-(d-2*b)/2);
}
function hexSlab(r,depth,b){
  const sh=new THREE.Shape();for(let i=0;i<=6;i++){const a=i*Math.PI/3;const x=Math.sin(a)*(r-b),y=Math.cos(a)*(r-b);i?sh.lineTo(x,y):sh.moveTo(x,y);}
  return new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,steps:1}).rotateX(-Math.PI/2).translate(0,-(depth+2*b)/2+b,0);
}
function roofPrism(halfW,h,len,b=0.012){
  const sh=new THREE.Shape();sh.moveTo(-halfW+b,b);sh.lineTo(halfW-b,b);sh.lineTo(0,h-b);sh.lineTo(-halfW+b,b);
  return new THREE.ExtrudeGeometry(sh,{depth:len-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,steps:1}).translate(0,0,-(len-2*b)/2).rotateY(Math.PI/2);
}
const G3={
  body:new THREE.CylinderGeometry(0.985,0.985,1,6), cap:hexSlab(0.94,0.02,0.02),
  token:tokenPlaque(0.25,0.026,0.012), unit:new THREE.BoxGeometry(1,1,1), disc:new THREE.CylinderGeometry(0.12,0.12,0.016,10),
  trunk:new THREE.CylinderGeometry(0.025,0.035,0.14,5).translate(0,0.07,0), pine:new THREE.ConeGeometry(0.13,0.3,6).translate(0,0.27,0),
  pineMid:new THREE.ConeGeometry(0.105,0.22,6).translate(0,0.36,0), pineTop:new THREE.ConeGeometry(0.07,0.16,6).translate(0,0.47,0), leafy:new THREE.IcosahedronGeometry(0.13,0).translate(0,0.24,0),
  leafy2:new THREE.IcosahedronGeometry(0.085,0).translate(0.06,0.32,0.04), leafy3:new THREE.IcosahedronGeometry(0.075,0).translate(-0.055,0.29,-0.05),
  tuft:new THREE.CylinderGeometry(0.03,0.045,0.11,5).translate(0,0.055,0), grass:new THREE.ConeGeometry(0.025,0.08,4).translate(0,0.04,0),
  yakBody:bevelBox(0.15,0.085,0.1,0.02).translate(0,0.11,0),
  yakSkirt:new THREE.CylinderGeometry(0.07,0.09,0.065,7,1,true).scale(1.18,1,0.86).translate(0,0.068,0),
  yakSkirt2:new THREE.CylinderGeometry(0.062,0.082,0.055,7,1,true).rotateY(0.45).scale(1.12,1,0.84).translate(-0.005,0.118,0),
  yakHump:new THREE.IcosahedronGeometry(0.052,0).scale(1.25,0.8,1).translate(-0.015,0.155,0),
  yakHead:bevelBox(0.062,0.062,0.07,0.014).translate(0.1,0.112,0),
  yakFore:new THREE.ConeGeometry(0.036,0.055,5).rotateZ(Math.PI).translate(0.112,0.128,0),
  yakMuzzle:bevelBox(0.03,0.034,0.046,0.009).translate(0.138,0.096,0),
  hornL:new THREE.CylinderGeometry(0.011,0.015,0.05,5).rotateX(Math.PI/2).translate(0.1,0.148,0.055), hornR:new THREE.CylinderGeometry(0.011,0.015,0.05,5).rotateX(Math.PI/2).translate(0.1,0.148,-0.055),
  hornTipL:new THREE.ConeGeometry(0.0115,0.055,5).rotateX(-0.25).translate(0.1,0.18,0.082), hornTipR:new THREE.ConeGeometry(0.0115,0.055,5).rotateX(0.25).translate(0.1,0.18,-0.082),
  yakLeg:new THREE.BoxGeometry(0.12,0.036,0.07).translate(0,0.018,0),
  mound:new THREE.SphereGeometry(0.22,7,4,0,Math.PI*2,0,Math.PI/2), kiln:bevelBox(0.13,0.11,0.11,0.014).translate(0,0.055,0),
  chimney:new THREE.BoxGeometry(0.04,0.12,0.04).translate(0.03,0.15,0.02), peak:new THREE.ConeGeometry(0.3,0.55,6).translate(0,0.275,0),
  snow:new THREE.ConeGeometry(0.112,0.2,6).translate(0,0.452,0), rock:new THREE.DodecahedronGeometry(0.07,0).translate(0,0.03,0),
  reed:new THREE.CylinderGeometry(0.008,0.012,0.16,3).translate(0,0.08,0),
  sBody:bevelBox(0.2,0.14,0.16,0.014).translate(0,0.07,0), sRoof:roofPrism(0.105,0.095,0.23).translate(0,0.13,0),
  doorV:bevelBox(0.008,0.07,0.042,0.003).translate(0.101,0.035,0), doorC:bevelBox(0.05,0.08,0.008,0.003).translate(-0.06,0.04,0.1),
  cBody:bevelBox(0.3,0.16,0.2,0.016).translate(-0.04,0.08,0), cRoof:roofPrism(0.125,0.11,0.33).translate(-0.04,0.15,0),
  tower:bevelBox(0.12,0.34,0.12,0.014).translate(0.1,0.17,0), tRoof:new THREE.ConeGeometry(0.1,0.15,4).rotateY(Math.PI/4).translate(0.1,0.415,0),
  chimV:new THREE.BoxGeometry(0.035,0.08,0.035).translate(0.05,0.21,0.035), chimC:new THREE.BoxGeometry(0.04,0.09,0.04).translate(-0.12,0.235,0.04),
  robBody:new THREE.ConeGeometry(0.11,0.3,8).translate(0,0.15,0), robHead:new THREE.SphereGeometry(0.07,10,8).translate(0,0.33,0),
  post:new THREE.BoxGeometry(0.04,0.3,0.04).translate(0,0.15,0), lintel:new THREE.BoxGeometry(0.32,0.045,0.05), flag:new THREE.BoxGeometry(0.12,0.08,0.012),
  dock:new THREE.BoxGeometry(0.22,0.025,0.14),
  puff:new THREE.IcosahedronGeometry(0.04,1), flyCube:new THREE.BoxGeometry(0.08,0.08,0.08), dust:new THREE.SphereGeometry(0.035,6,4),
  mDisc:new THREE.CylinderGeometry(0.12,0.12,0.02,20), sphere:new THREE.SphereGeometry(0.1,14,10),
  hull:new THREE.CylinderGeometry(0.065,0.065,0.24,8,1,false,Math.PI,Math.PI).rotateZ(Math.PI/2).scale(1,0.7,1).translate(0,0.045,0),
  fBody:new THREE.ConeGeometry(0.035,0.1,6).translate(0,0.1,0), fHead:new THREE.SphereGeometry(0.025,8,6).translate(0,0.165,0),
  rod:new THREE.CylinderGeometry(0.004,0.004,0.34,3).rotateZ(-0.95).translate(0.13,0.2,0),
  sold:bevelBox(0.068,0.13,0.056,0.012).translate(0,0.065,0), soldHead:new THREE.SphereGeometry(0.036,10,8).translate(0,0.166,0),
  helm:new THREE.ConeGeometry(0.043,0.062,6).translate(0,0.214,0), spear:new THREE.CylinderGeometry(0.006,0.006,0.3,4).translate(0.05,0.15,0),
  tip:new THREE.ConeGeometry(0.013,0.04,4).translate(0.05,0.32,0), shield:new THREE.CylinderGeometry(0.056,0.056,0.014,8).rotateZ(Math.PI/2).translate(-0.05,0.08,0),
  ring:new THREE.TorusGeometry(0.2,0.018,6,28).rotateX(Math.PI/2),
  shag:new THREE.ConeGeometry(0.36,0.6,7).translate(0,0.3,0), shagSnow:new THREE.ConeGeometry(0.17,0.27,7).translate(0,0.47,0),
  crag:new THREE.ConeGeometry(0.24,0.55,5).translate(0,0.275,0),
  mineFrame:bevelBox(0.13,0.11,0.04,0.008).translate(0,0.055,0), mineHole:new THREE.BoxGeometry(0.085,0.075,0.046).translate(0,0.038,0),
  winV:new THREE.BoxGeometry(0.004,0.036,0.03).translate(0.1015,0.085,0.048), winC:new THREE.BoxGeometry(0.034,0.04,0.005).translate(-0.14,0.1,0.1015), winT:new THREE.BoxGeometry(0.03,0.045,0.005).translate(0.1,0.27,0.0615),
  rPost:new THREE.BoxGeometry(0.03,0.08,0.03).translate(0,0.04,0), tent:new THREE.ConeGeometry(0.07,0.11,4).translate(0,0.055,0), fire:new THREE.ConeGeometry(0.025,0.06,5).translate(0,0.03,0),
  fishM:new THREE.SphereGeometry(0.05,8,6).scale(1,0.45,0.5), fishTail:new THREE.ConeGeometry(0.025,0.04,3).rotateZ(Math.PI/2).translate(-0.06,0,0), hub:new THREE.CylinderGeometry(0.075,0.075,0.024,12),
  rbCloak:new THREE.ConeGeometry(0.12,0.3,10).translate(0,0.15,0), rbHood:new THREE.SphereGeometry(0.075,12,10).translate(0,0.31,0),
  rbFace:new THREE.SphereGeometry(0.05,10,8).translate(0.04,0.305,0), rbEye:new THREE.SphereGeometry(0.009,6,4),
  rbStaff:new THREE.CylinderGeometry(0.007,0.007,0.44,5).translate(0.11,0.22,0.06), rbLamp:new THREE.BoxGeometry(0.045,0.055,0.045).translate(0.11,0.46,0.06),
  vBody:bevelBox(0.05,0.075,0.042,0.01).translate(0,0.0375,0), vHead:new THREE.SphereGeometry(0.027,8,6).translate(0,0.1,0),
  lily:new THREE.CylinderGeometry(0.045,0.045,0.006,10,1,false,0.4,Math.PI*2-0.8), flower:new THREE.SphereGeometry(0.013,6,4).translate(0,0.012,0),
  snowPatch:new THREE.IcosahedronGeometry(0.12,0).scale(1,0.12,0.8).translate(0,0.004,0), foam:new THREE.TorusGeometry(0.855,0.016,3,6).rotateX(Math.PI/2).rotateY(Math.PI/6),
  drop:new THREE.BoxGeometry(0.008,0.14,0.008), shaft:new THREE.CylinderGeometry(0.2,0.75,2.4,18,1,true).translate(0,1.2,0),
  cartBody:new THREE.BoxGeometry(0.22,0.08,0.13).translate(0,0.09,0), cartWheel:new THREE.CylinderGeometry(0.05,0.05,0.02,12).rotateX(Math.PI/2),
  cartTop:new THREE.CylinderGeometry(0.07,0.07,0.2,10,1,false,0,Math.PI).rotateZ(Math.PI/2).rotateX(Math.PI/2).translate(0,0.14,0),
  mast:new THREE.CylinderGeometry(0.006,0.006,0.3,4).translate(-0.07,0.17,0), boatFlag:new THREE.BoxGeometry(0.004,0.08,0.12).translate(-0.07,0.28,0.06),
  wBody:new THREE.BoxGeometry(0.2,0.09,0.08).translate(0,0.1,0), wHead:new THREE.BoxGeometry(0.08,0.07,0.07).translate(0.13,0.15,0),
  wSnout:new THREE.BoxGeometry(0.05,0.035,0.04).translate(0.19,0.135,0), wEar:new THREE.ConeGeometry(0.016,0.04,4),
  wLeg:new THREE.BoxGeometry(0.025,0.07,0.025).translate(0,0.035,0), wTail:new THREE.BoxGeometry(0.1,0.025,0.025).rotateZ(0.6).translate(-0.13,0.13,0),
  hBody:new THREE.CylinderGeometry(0.05,0.078,0.2,8).translate(0,0.1,0), hBelt:new THREE.CylinderGeometry(0.062,0.062,0.022,8).translate(0,0.135,0),
  hHead:new THREE.SphereGeometry(0.046,10,8).translate(0,0.245,0), hHair:new THREE.SphereGeometry(0.05,10,6,0,Math.PI*2,0,Math.PI/2).translate(0,0.25,0),
  hPole:new THREE.CylinderGeometry(0.006,0.006,0.34,4).translate(0.08,0.17,0), hTines:new THREE.BoxGeometry(0.006,0.05,0.045).translate(0.08,0.355,0), hBar:new THREE.BoxGeometry(0.008,0.008,0.05).translate(0.08,0.33,0),
  hCrook:new THREE.TorusGeometry(0.03,0.006,4,10,Math.PI).translate(0.11,0.34,0), hRod:new THREE.CylinderGeometry(0.004,0.004,0.42,3).rotateZ(-0.6).translate(0.15,0.26,0),
  hHandle:new THREE.CylinderGeometry(0.006,0.006,0.17,4).translate(0.08,0.13,0), hHammer:new THREE.BoxGeometry(0.06,0.03,0.03).translate(0.08,0.215,0),
  hBag:new THREE.BoxGeometry(0.05,0.05,0.03).translate(-0.065,0.12,0.03), hCoin:new THREE.CylinderGeometry(0.018,0.018,0.006,10).rotateX(Math.PI/2).translate(-0.065,0.12,0.047),
  hBlade:new THREE.BoxGeometry(0.012,0.18,0.03).translate(0.08,0.2,0), hGuard:new THREE.BoxGeometry(0.012,0.012,0.075).translate(0.08,0.11,0),
  bPole:new THREE.CylinderGeometry(0.008,0.008,0.5,5).translate(0,0.25,0), bFlag:new THREE.PlaneGeometry(0.2,0.14).translate(0.1,0.42,0),
  banBody:new THREE.ConeGeometry(0.075,0.24,7).translate(0,0.12,0), banHead:new THREE.SphereGeometry(0.05,8,6).translate(0,0.27,0),
  banMask:new THREE.BoxGeometry(0.06,0.025,0.105).translate(0.03,0.275,0), banBlade:new THREE.BoxGeometry(0.012,0.15,0.03).rotateZ(-0.5).translate(0.08,0.15,0),
};
let world=new THREE.Group(); scene.add(world);
let bGroup=null, mGroup=null, robberMesh=null, smokeIM=null, ghost=null, ghostMat=null, pickables=[], prng=Math.random;
let heroHL=[], tagMats={}, flagMats={};
let yakHerd=[], yakIMs=[], yakLast=0;
const sigCache={}; let threatSet=new Set();
function warnMat(){if(sigCache.warn) return sigCache.warn;const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  g.fillStyle='#b0412e';g.beginPath();g.moveTo(32,4);g.lineTo(60,56);g.lineTo(4,56);g.closePath();g.fill();g.lineWidth=4;g.strokeStyle='#fff';g.stroke();
  g.fillStyle='#fff';g.font='bold 34px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('!',32,38);
  return sigCache.warn=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true});}
// Each player's banner sigil, made unique so no two players share one
function dispSigil(p){const all=['shield','tower','sun','wave','crown','star','moon','anchor','flame'];const used=[];
  for(let i=0;i<=p;i++){let s=(G.heroes[i].look||{}).sigil||'shield';if(used.includes(s)) s=all.find(x=>!used.includes(x));used.push(s);}return used[p];}
function sigilCanvas(p){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  g.fillStyle=PLAYERS[p].css;g.beginPath();g.arc(32,32,29,0,Math.PI*2);g.fill();g.lineWidth=4;g.strokeStyle='#ffffff';g.stroke();
  g.fillStyle=PLAYERS[p].name==='White'?'#46505e':'#ffffff';g.strokeStyle=g.fillStyle;drawSigil(g,dispSigil(p),32,33,17,g.fillStyle);return c;}
function sigilURL(p){const k='u'+p+PLAYERS[p].css+dispSigil(p);return sigCache[k]||(sigCache[k]=sigilCanvas(p).toDataURL());}
function sigilMat(p){const k='m'+p+PLAYERS[p].css+dispSigil(p);return sigCache[k]||(sigCache[k]=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(sigilCanvas(p)),depthTest:false,transparent:true}));}
function addBadge(p,x,y,z,sc=0.22){const sp=new THREE.Sprite(sigilMat(p));sp.position.set(x,y,z);sp.scale.set(sc,sc,1);sp.renderOrder=5;bGroup.add(sp);}
let hoverEdge=null, armyMeshes={}, evFx=null, evFxSig='', rainIM=null, rainData=[], lastRobber=null, battling=false;
let smokeEm=[], highlighted=[], hlUntil=0, robberHL=[], rods=[], wolfMesh=null, banditMesh=null, selRing=null, selEdge=null, lastEv='';
const anims=[];
const reduceMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function anim(dur,fn,done,delay=0){if(reduceMotion()){fn(1);done&&done();return;}anims.push({t0:performance.now()+delay,dur,fn,done});}
const easeOutBack=k=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(k-1,3)+c1*Math.pow(k-1,2);};

function makeBatch(){
  const lists=new Map();
  return {
    add(geo,mat,pos,rotY,scale,color){const k=geo.uuid+mat.uuid;let L=lists.get(k);if(!L){L={geo,mat,items:[]};lists.set(k,L);}L.items.push({pos,rotY,scale,color});},
    build(group){
      const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
      for(const L of lists.values()){
        const im=new THREE.InstancedMesh(L.geo,L.mat,L.items.length);
        L.items.forEach((it,i)=>{q.setFromAxisAngle(up,it.rotY);const sc=typeof it.scale==='number'?s.set(it.scale,it.scale,it.scale):it.scale;m.compose(it.pos,q,sc);im.setMatrixAt(i,m);im.setColorAt(i,it.color);});
        im.castShadow=true; im.receiveShadow=true; im.frustumCulled=false; group.add(im);
      }
    }
  };
}
function inHex(x,z,s){const ax=Math.abs(x);return ax<=s*SQ3/2&&Math.abs(z)<=s-ax/SQ3;}
function sample(count,minD,{margin=0.72,clear=0.34}={}){
  count=Math.max(1,Math.round(count*Q.dens));
  const pts=[]; let tries=0;
  while(pts.length<count&&tries<count*40){
    tries++; const p={x:(prng()*2-1)*margin,z:(prng()*2-1)*margin};
    if(!inHex(p.x,p.z,margin)||Math.hypot(p.x,p.z)<clear) continue;
    if(pts.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<minD)) continue;
    pts.push(p);
  }
  return pts;
}
function decorate(t,B){
  const at=p=>new THREE.Vector3(t.x+p.x,t.top,t.z+p.z);
  const jit=(hex,h=0.03,l=0.06)=>{const c=new THREE.Color(hex);c.offsetHSL((prng()-0.5)*h,(prng()-0.5)*0.1,(prng()-0.5)*l);return c;};
  const W=MAT.white, SW=MAT.sway, clear=t.num?0.52:0.12, rot=()=>prng()*Math.PI*2;
  switch(t.terrain){
    case 'forest':
      for(const p of sample(15,0.16,{clear})){const s=0.8+prng()*0.45,r=rot();B.add(G3.trunk,W,at(p),r,s,jit(0x5a3d26,0.02,0.05));
        if(prng()<0.62){const c=jit(0x2e6a3c);B.add(G3.pine,SW,at(p),r,s,c);B.add(G3.pineMid,SW,at(p),r,s,c.clone().offsetHSL(0,0,0.03));B.add(G3.pineTop,SW,at(p),r,s,c.clone().offsetHSL(0,0,0.06));}
        else{const c=jit(0x4f9440,0.04,0.08);B.add(G3.leafy,SW,at(p),r,s,c);B.add(G3.leafy2,SW,at(p),r,s,c.clone().offsetHSL(0.01,0,0.04));B.add(G3.leafy3,SW,at(p),r,s,c.clone().offsetHSL(-0.01,0,-0.03));}}
      break;
    case 'fields': {let row=0;
      for(let x=-0.66;x<=0.67;x+=0.12,row++) for(let z=-0.76;z<=0.76;z+=0.11){const p={x:x+(prng()-0.5)*0.02,z};
        if(!inHex(p.x,p.z,0.74)||Math.hypot(p.x,p.z)<clear) continue;
        B.add(G3.tuft,SW,at(p),rot(),0.85+prng()*0.3,jit(row%2?0xe3bf4c:0xc9a03a,0.02,0.05));}
      break;}
    case 'pasture':
      for(const p of sample(18,0.1,{clear})) B.add(G3.grass,SW,at(p),rot(),0.8+prng()*0.6,jit(0x5f9e45,0.04,0.1));
      for(const p of sample(3+Math.floor(prng()*2),0.24,{clear})){const k=prng();
        const fur=k<0.6?jit(0x8a4a2a,0.015,0.06):k<0.85?jit(0x4f3022,0.015,0.05):jit(0xe6d2b2,0.01,0.04);
        yakHerd.push({tile:t,x:t.x+p.x,z:t.z+p.z,rot:rot(),fur,dk:fur.clone().offsetHSL(0,0,-0.07),horn:jit(0xe3c08a,0.01,0.04),state:'graze',timer:prng()*5,pitch:0.5,tx:0,tz:0,ph:prng()*10});}
      break;
    case 'hills':
      for(const p of sample(3,0.32,{clear})){const s=0.8+prng()*0.5;B.add(G3.mound,W,at(p),rot(),new THREE.Vector3(s,s*0.6,s),jit(0xa95b3a,0.03,0.08));}
      for(const p of sample(1,0.2,{clear,margin:0.6})){const r=rot();B.add(G3.kiln,W,at(p),r,1,jit(0x8a4a33));B.add(G3.chimney,W,at(p),r,1,new THREE.Color(0x5b3a2c));}
      for(const p of sample(4,0.12,{clear})) B.add(G3.rock,W,at(p),rot(),0.6+prng()*0.5,jit(0x9a7a64));
      break;
    case 'mountains':
      // iron mountains: blue-grey crags, rusty ore and a timbered mine
      for(const p of sample(3,0.34,{clear,margin:0.64})){const s=0.46+prng()*0.18,r=rot();B.add(G3.crag,W,at(p),r,s,jit(0x7b8594,0.02,0.08));}
      for(const p of sample(5,0.12,{clear,margin:0.72})) B.add(G3.rock,W,at(p),rot(),0.7+prng()*0.6,prng()<0.5?jit(0x8a4f32,0.02,0.08):jit(0x3c3f45,0.01,0.06));
      for(const p of sample(1,0.2,{clear,margin:0.55})){const r=rot();B.add(G3.mineFrame,W,at(p),r,1,new THREE.Color(0x6b4a2f));B.add(G3.mineHole,W,at(p),r,1,new THREE.Color(0x121212));}
      break;
    case 'badlands':
      for(const p of sample(9,0.12,{clear:0.2})) B.add(G3.rock,W,at(p),rot(),0.6+prng()*0.9,jit(0xb59a72,0.03,0.1));
      for(const p of sample(1,0.3,{clear:0.45,margin:0.6})) B.add(G3.peak,W,at(p),rot(),0.35,jit(0xb08f68));
      break;
    case 'lake':
      for(const p of sample(14,0.08,{clear:0.55,margin:0.78})) B.add(G3.reed,SW,at(p),rot(),0.8+prng()*0.6,jit(0x6f8f4a,0.04,0.1));
      for(const p of sample(6,0.1,{clear:0.38,margin:0.68})){const q=at(p);q.y+=0.003;B.add(G3.lily,W,q,rot(),0.8+prng()*0.5,jit(0x4f8a3c,0.03,0.08));if(prng()<0.5) B.add(G3.flower,W,q,0,1,new THREE.Color(prng()<0.5?0xf2a6c4:0xfaf3e0));}
      for(const p of sample(4,0.12,{clear:0.7,margin:0.84})) B.add(G3.rock,W,at(p),rot(),0.6+prng()*0.6,jit(0x7c7a76,0.02,0.08));
      break;
    case 'frontier':
      if(t.gap){for(const p of sample(8,0.12,{clear:0.3,margin:0.7})) B.add(G3.grass,SW,at(p),rot(),1,jit(0x6a8a50,0.04,0.1));break;}
      // the Shaggy Peaks: big brown-green mountains with heavy snow, dark pine skirts and heather
      for(const p of sample(2+Math.floor(prng()*2),0.4,{clear:0,margin:0.6})){const tall=prng()<0.3,sc=tall?0.8+prng()*0.3:0.48+prng()*0.2,r=rot();
        B.add(G3.shag,W,at(p),r,sc,jit(prng()<0.5?0x6e5f4c:0x5f5848,0.02,0.07));B.add(G3.shagSnow,W,at(p),r,sc,new THREE.Color(0xf2f4f6));}
      for(const p of sample(5,0.14,{clear:0,margin:0.82})){const sc=0.45+prng()*0.3,r=rot();B.add(G3.pine,SW,at(p),r,sc,jit(0x24452e,0.02,0.05));B.add(G3.pineTop,SW,at(p),r,sc,jit(0x2c5236,0.02,0.05));}
      for(const p of sample(7,0.1,{clear:0,margin:0.85})) B.add(G3.grass,SW,at(p),rot(),1.3,jit(0x7a5a8a,0.04,0.1));
      for(const p of sample(1+Math.floor(prng()*2),0.25,{clear:0,margin:0.75})) B.add(G3.snowPatch,W,at(p),rot(),0.8+prng()*0.8,new THREE.Color(0xe8edf1));
      break;
  }
}
const tokMats={};
// Number tokens: carved hexagonal plaques of wood with the number painted on and the odds burned in as dots.
function tokenMaterial(n,fish){
  const key=n+(fish?'f':''); if(tokMats[key]) return tokMats[key];
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  let sd=n*9301+(fish?77:0); const rnd=()=>((sd=(sd*9301+49297)%233280)/233280);
  const grad=g.createLinearGradient(0,0,256,256);
  if(fish){grad.addColorStop(0,'#b2d0de');grad.addColorStop(1,'#8fb2c4');} else {grad.addColorStop(0,'#e2bd86');grad.addColorStop(1,'#c69a5e');}
  g.fillStyle=grad; g.fillRect(0,0,256,256);
  // wood grain
  for(let k=0;k<26;k++){const y=rnd()*256,amp=3+rnd()*6,ph=rnd()*6;g.strokeStyle=`rgba(${fish?'30,55,70':'80,45,15'},${0.08+rnd()*0.14})`;g.lineWidth=1+rnd()*2.5;
    g.beginPath();for(let x=0;x<=256;x+=8){const yy=y+Math.sin(x/40+ph)*amp;x?g.lineTo(x,yy):g.moveTo(x,yy);}g.stroke();}
  // carved inner border following the hexagon
  const hex=(rad)=>{g.beginPath();for(let k=0;k<=6;k++){const a=Math.PI/6+k*Math.PI/3,x=128+Math.sin(a)*rad,y=128-Math.cos(a)*rad;k?g.lineTo(x,y):g.moveTo(x,y);}};
  g.lineWidth=5; g.strokeStyle='rgba(255,240,215,.35)'; hex(104); g.stroke(); g.strokeStyle=fish?'rgba(20,45,60,.45)':'rgba(60,30,10,.45)'; g.lineWidth=3; hex(100); g.stroke();
  // painted number, with a light edge so it reads as carved
  const red=n===6||n===8, ink=fish?'#163e57':red?'#8e1f16':'#2e1a0c';
  g.textAlign='center'; g.textBaseline='middle'; g.font=`700 ${red?150:136}px Alegreya, Georgia, serif`; g.lineJoin='round';
  g.lineWidth=12; g.strokeStyle='rgba(255,244,222,.92)'; g.strokeText(String(n),128,104); g.fillStyle=ink; g.fillText(String(n),128,104);
  // burned dots for the odds
  const p=pips(n), w=p*22;
  for(let k=0;k<p;k++){const x=128-w/2+11+k*22;g.fillStyle='rgba(255,244,222,.8)';g.beginPath();g.arc(x,200,9,0,Math.PI*2);g.fill();g.fillStyle=ink;g.beginPath();g.arc(x,200,6.8,0,Math.PI*2);g.fill();}
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=8;
  return tokMats[key]=new THREE.MeshStandardMaterial({map:tex,roughness:0.9,flatShading:false});
}
const signMats={}, markMats={};
function portSign(type){
  if(signMats[type]) return signMats[type];
  const c=document.createElement('canvas'); c.width=256; c.height=128; const g=c.getContext('2d');
  const any=type==='any', col=any?'#f4efe2':RES[type].color, light=any||type==='wheat';
  const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  g.fillStyle='rgba(0,0,0,.3)'; rr(8,12,244,110,28); g.fill();
  g.fillStyle=col; rr(4,6,244,110,28); g.fill();
  g.lineWidth=7; g.strokeStyle='rgba(255,255,255,.92)'; rr(8,10,236,102,24); g.stroke();
  g.fillStyle=light?'#1d282c':'#ffffff'; g.textAlign='center'; g.textBaseline='middle';
  g.font='700 62px Alegreya, Georgia, serif'; g.fillText(any?'3:1':'2:1',126,50);
  g.font='700 28px "Alegreya Sans", sans-serif'; g.fillText(any?'any resource':RES[type].name,126,93);
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4;
  return signMats[type]=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
}
function addPortMarks(type,cs,sx,sz,sy){
  const sp=new THREE.Sprite(portSign(type)); sp.position.set(sx,sy,sz); sp.scale.set(0.8,0.4,1); world.add(sp);
  if(!markMats[type]) markMats[type]=new THREE.MeshBasicMaterial({color:type==='any'?0xf4efe2:new THREE.Color(RES[type].color),transparent:true,opacity:0.9});
  for(const c of cs){const d=new THREE.Mesh(G3.mDisc,markMats[type]);d.scale.set(1.25,0.6,1.25);d.position.set(c.x,TOP+0.012,c.z);world.add(d);}
}
const playerMats={}, lookMats={}, iconSprites={};
// A round badge sprite showing one of the interface icons (drawn from its SVG)
function iconSprite(k,bg){
  const key=k+bg; if(iconSprites[key]) return iconSprites[key];
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  g.fillStyle='rgba(255,255,255,.95)';g.beginPath();g.arc(64,64,60,0,Math.PI*2);g.fill();
  g.fillStyle=bg;g.beginPath();g.arc(64,64,52,0,Math.PI*2);g.fill();
  const tex=new THREE.CanvasTexture(c), mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
  const img=new Image();img.onload=()=>{g.drawImage(img,28,28,72,72);tex.needsUpdate=true;};
  img.src='data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="72" height="72" fill="#fff" color="#fff">${ICON[k]||''}</svg>`);
  return iconSprites[key]=mat;
}
let _blockMat=null;
function blockMat(){
  if(_blockMat) return _blockMat;
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
  g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(64,64,56,0,Math.PI*2);g.fill();
  g.strokeStyle='#c8322a';g.lineWidth=14;g.beginPath();g.arc(64,64,48,0,Math.PI*2);g.stroke();
  g.beginPath();g.moveTo(30,30);g.lineTo(98,98);g.stroke();
  const tex=new THREE.CanvasTexture(c);
  return _blockMat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
}
function lookMat(css){return lookMats[css]||(lookMats[css]=M(new THREE.Color(css)));}
function tagMat(p,h){
  const key=p+'|'+PLAYERS[p].name+'|'+h.name+'|'+h.ability+'|'+(h.wounded!==false);
  if(tagMats[key]) return tagMats[key];
  const c=document.createElement('canvas'); c.width=320; c.height=80; const g=c.getContext('2d');
  const rr=(x,y,w,hh,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+hh,r);g.arcTo(x+w,y+hh,x,y+hh,r);g.arcTo(x,y+hh,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  g.fillStyle='rgba(20,24,30,.78)'; rr(4,8,312,64,30); g.fill();
  g.fillStyle=PLAYERS[p].css; g.beginPath(); g.arc(40,40,20,0,Math.PI*2); g.fill();
  g.fillStyle=isWhite(p)?'#1d282c':'#fff'; g.font='700 22px "Alegreya Sans", sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(ABILITIES[h.ability].letter,40,41);
  g.fillStyle='#fff'; g.textAlign='left'; g.font='700 30px Alegreya, Georgia, serif'; g.fillText((h.name+(h.wounded!==false?' (resting)':'')).slice(0,22),70,42);
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=4;
  return tagMats[key]=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
}
function drawSigil(g,sig,x,y,r,col){
  g.fillStyle=col; g.strokeStyle=col; g.lineWidth=r*0.18; g.beginPath();
  if(sig==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*0.45:r;g.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad);}g.closePath();g.fill();}
  else if(sig==='tree'){g.moveTo(x,y-r);g.lineTo(x+r*0.8,y+r*0.5);g.lineTo(x-r*0.8,y+r*0.5);g.closePath();g.fill();g.fillRect(x-r*0.12,y+r*0.5,r*0.24,r*0.5);}
  else if(sig==='crown'){g.moveTo(x-r,y+r*0.6);g.lineTo(x-r,y-r*0.5);g.lineTo(x-r*0.5,y);g.lineTo(x,y-r*0.8);g.lineTo(x+r*0.5,y);g.lineTo(x+r,y-r*0.5);g.lineTo(x+r,y+r*0.6);g.closePath();g.fill();}
  else if(sig==='wave'){for(let k=0;k<2;k++){g.beginPath();for(let i=0;i<=20;i++){const t=i/20;g.lineTo(x-r+t*2*r,y-r*0.25+k*r*0.6+Math.sin(t*Math.PI*2)*r*0.22);}g.stroke();}}
  else if(sig==='sun'){g.arc(x,y,r*0.45,0,Math.PI*2);g.fill();for(let i=0;i<8;i++){const a=i*Math.PI/4;g.beginPath();g.moveTo(x+Math.cos(a)*r*0.6,y+Math.sin(a)*r*0.6);g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);g.stroke();}}
  else if(sig==='moon'){g.arc(x,y,r*0.8,0.3*Math.PI,1.7*Math.PI,false);g.arc(x+r*0.35,y,r*0.62,1.62*Math.PI,0.38*Math.PI,true);g.fill();}
  else if(sig==='anchor'){g.lineWidth=r*0.2;g.beginPath();g.arc(x,y-r*0.62,r*0.2,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(x,y-r*0.42);g.lineTo(x,y+r*0.8);g.stroke();g.beginPath();g.moveTo(x-r*0.45,y-r*0.15);g.lineTo(x+r*0.45,y-r*0.15);g.stroke();g.beginPath();g.arc(x,y+r*0.15,r*0.65,0.15*Math.PI,0.85*Math.PI);g.stroke();}
  else if(sig==='flame'){g.moveTo(x,y-r);g.quadraticCurveTo(x+r*0.9,y-r*0.1,x+r*0.5,y+r*0.7);g.quadraticCurveTo(x,y+r*1.05,x-r*0.5,y+r*0.7);g.quadraticCurveTo(x-r*0.9,y-r*0.1,x-r*0.15,y-r*0.35);g.quadraticCurveTo(x-r*0.05,y-r*0.7,x,y-r);g.fill();}
  else {g.moveTo(x,y-r);g.lineTo(x+r*0.8,y-r*0.6);g.lineTo(x+r*0.7,y+r*0.3);g.lineTo(x,y+r);g.lineTo(x-r*0.7,y+r*0.3);g.lineTo(x-r*0.8,y-r*0.6);g.closePath();g.fill();}
}
function flagMat(p,sig){
  const key=PLAYERS[p].name+'|'+sig; if(flagMats[key]) return flagMats[key];
  const c=document.createElement('canvas'); c.width=160; c.height=112; const g=c.getContext('2d');
  g.fillStyle=PLAYERS[p].css; g.fillRect(0,0,160,112); g.fillStyle='rgba(0,0,0,.18)'; g.fillRect(0,96,160,16);
  drawSigil(g,sig||'shield',80,50,30,isWhite(p)?'#46505e':'#ffffff');
  const tex=new THREE.CanvasTexture(c);
  return flagMats[key]=new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:0.85});
}
const isWhite=p=>PLAYERS[p].name==='White';
const lineMats={};
function pLine(p){const k=PLAYERS[p].name;return lineMats[k]||(lineMats[k]=new THREE.LineBasicMaterial({color:isWhite(p)?0x2f3540:new THREE.Color(PLAYERS[p].color).multiplyScalar(0.35)}));}
function pMat(p){const key=PLAYERS[p].name;if(!playerMats[key]){const w=isWhite(p),c=new THREE.Color(PLAYERS[p].color);playerMats[key]={wall:M(w?0xf6f4ee:c),roof:M(w?0x46505e:c.clone().multiplyScalar(0.58)),ghost:new THREE.MeshBasicMaterial({color:w?0xffffff:c,transparent:true,opacity:0.5,depthWrite:false})};}return playerMats[key];}
function box(x1,y1,z1,x2,y2,z2,w,h,mat){
  const m=new THREE.Mesh(G3.unit,mat); m.scale.set(w,h,Math.hypot(x2-x1,y2-y1,z2-z1)); m.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
  m.lookAt(x2,y2,z2); m.castShadow=true; m.receiveShadow=true; return m;
}
function addMesh(g,geo,mat){const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}

function buildScene(B){
  curBoard=B;
  scene.remove(world);
  world.traverse(o=>{if(o.userData.ownMat) o.material.dispose(); if(o.isInstancedMesh&&o.dispose) o.dispose();});
  world=new THREE.Group(); scene.add(world); pickables=[]; yakHerd=[]; yakIMs=[]; tokenMeshes=[];
  prng=mulberry32(hashStr(B.seed+'|look'));
  for(const rv of B.rivers) if(rv.offMap) B.corners.get(rv.corners[rv.corners.length-1]).tiles.filter(t=>t.rim).forEach(t=>t.gap=true);
  B.tiles.forEach(t=>{t.h=t.rim?(t.gap?LAND_H-0.04:t.rimH):LAND_H; t.top=t.terrain==='lake'?WATER:t.h+0.03;});
  const Bt=makeBatch();
  for(const t of B.tiles){
    const body=new THREE.Mesh(G3.body,t.rim&&!t.gap?MAT.peakBody:MAT.soil);
    const bh=t.terrain==='lake'?t.h-0.08:t.h;
    body.scale.y=bh; body.position.set(t.x,bh/2,t.z); body.castShadow=true; body.receiveShadow=true; body.userData.tile=t; world.add(body); pickables.push(body);
    let capMat;
    if(t.terrain==='lake') capMat=MAT.water.clone();
    else if(t.gap) capMat=MAT.gap.clone();
    else{const c=new THREE.Color(TERRAIN[t.terrain].top);c.offsetHSL((prng()-0.5)*(t.rim?0.06:0.02),t.rim?(prng()-0.5)*0.12:0,(prng()-0.5)*(t.rim?0.14:0.05));capMat=M(c);}
    const cap=new THREE.Mesh(G3.cap,capMat); cap.position.set(t.x,t.terrain==='lake'?t.h-0.06:t.h,t.z); cap.receiveShadow=true;
    cap.userData.tile=t; cap.userData.ownMat=true; world.add(cap); pickables.push(cap); t.capMat=capMat;
    if(t.terrain==='lake'){const f=new THREE.Mesh(G3.foam,MAT.foamRing);f.position.set(t.x,WATER+0.004,t.z);world.add(f);}
    if(t.num){const fish=t.terrain==='lake';const tok=new THREE.Mesh(G3.token,[tokenMaterial(t.num,fish),fish?MAT.tokenSideFish:MAT.tokenSide]);tok.position.set(t.x,t.top,t.z);tok.scale.set(TOKEN_S,1.3,TOKEN_S);tok.castShadow=true;tok.receiveShadow=true;world.add(tok);tokenMeshes.push(tok);}
    decorate(t,Bt);
  }
  const ry=TOP+0.006;
  for(const rv of B.rivers){
    for(let j=0;j<rv.corners.length-1;j++){
      const a=B.corners.get(rv.corners[j]),b=B.corners.get(rv.corners[j+1]),dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),ex=dx/L*0.06,ez=dz/L*0.06,px=-dz/L,pz=dx/L;
      const m=box(a.x-ex,ry,a.z-ez,b.x+ex,ry,b.z+ez,0.22,0.02,MAT.river); m.castShadow=false; world.add(m);
      for(const sd of [-1,1]){const ox=px*0.135*sd,oz=pz*0.135*sd;
        world.add(box(a.x+ox+dx*0.14,TOP+0.012,a.z+oz+dz*0.14,b.x+ox-dx*0.14,TOP+0.012,b.z+oz-dz*0.14,0.05,0.035,MAT.bank));
        for(let k=0;k<3;k++){const tt=0.2+prng()*0.6,off=0.17+prng()*0.05;Bt.add(G3.reed,MAT.sway,new THREE.Vector3(a.x+dx*tt+px*off*sd,TOP,a.z+dz*tt+pz*off*sd),prng()*6.28,0.8+prng()*0.6,new THREE.Color(0x6f8f4a).offsetHSL(0,0,(prng()-0.5)*0.12));}}
    }
    rv.corners.forEach(k=>{const c=B.corners.get(k);const d=new THREE.Mesh(G3.disc,MAT.river);d.position.set(c.x,ry,c.z);d.receiveShadow=true;world.add(d);});
    const s=B.corners.get(rv.corners[0]), nx=B.corners.get(rv.corners[1]);
    const hTop=Math.min(...s.tiles.filter(t=>t.rim).map(t=>t.h))-0.1;
    const dx=s.x-nx.x, dz=s.z-nx.z, dl=Math.hypot(dx,dz);
    if(hTop>ry+0.05){const f=new THREE.Mesh(G3.unit,MAT.river);f.scale.set(0.2,hTop-ry,0.05);f.position.set(s.x+dx/dl*0.04,(hTop+ry)/2,s.z+dz/dl*0.04);f.rotation.y=Math.atan2(dx,dz);world.add(f);}
    const end=B.corners.get(rv.corners[rv.corners.length-1]);
    if(rv.lake) world.add(box(end.x,ry,end.z,end.x+(rv.lake.x-end.x)*0.25,WATER+0.004,end.z+(rv.lake.z-end.z)*0.25,0.22,0.02,MAT.river));
    else{
      const gap=end.tiles.find(t=>t.gap); if(gap){const ox=gap.x+(gap.x-end.x)*0.9, oz=gap.z+(gap.z-end.z)*0.9, gy=gap.top+0.006;
        world.add(box(end.x,ry,end.z,gap.x,gy,gap.z,0.24,0.02,MAT.river)); world.add(box(gap.x,gy,gap.z,ox,gy,oz,0.24,0.02,MAT.river));
        // river port dock
        const g=new THREE.Group(); const dk=addMesh(g,G3.dock,MAT.plank); dk.position.y=0.02; const po=addMesh(g,G3.post,MAT.wood); po.position.set(0.09,0,0.05);
        const fl=addMesh(g,G3.flag,M(end.port==='any'?0xf2eee4:new THREE.Color(RES[end.port].color))); fl.position.set(0.15,0.25,0.05); fl.userData.ownMat=true;
        g.position.set(end.x+(gap.x-end.x)*0.18+0.12*Math.sign(gap.z-end.z||1),TOP,end.z+(gap.z-end.z)*0.18); g.rotation.y=Math.atan2(gap.x-end.x,gap.z-end.z); world.add(g);
        addPortMarks(end.port,[end],gap.x+(gap.x-end.x)*0.15,gap.z+(gap.z-end.z)*0.15,TOP+0.55);}
    }
  }
  for(const e of B.edges.values()){
    if(!e.gate) continue;
    const a=B.corners.get(e.a), b=B.corners.get(e.b), landT=e.tiles.find(B.isLand);
    const mx=(a.x+b.x)/2, mz=(a.z+b.z)/2, ix=landT.x-mx, iz=landT.z-mz, il=Math.hypot(ix,iz);
    const g=new THREE.Group(); g.position.set(mx+ix/il*0.17,landT.top,mz+iz/il*0.17); g.rotation.y=Math.atan2(-(b.z-a.z),b.x-a.x);
    const p1=addMesh(g,G3.post,MAT.wood); p1.position.x=-0.14; const p2=addMesh(g,G3.post,MAT.wood); p2.position.x=0.14;
    const li=addMesh(g,G3.lintel,MAT.wood); li.position.y=0.31;
    const fl=addMesh(g,G3.flag,M(e.gate==='any'?0xf2eee4:new THREE.Color(RES[e.gate].color))); fl.position.y=0.22; fl.userData.ownMat=true;
    world.add(g);
    addPortMarks(e.gate,[a,b],mx-ix/il*0.5,mz-iz/il*0.5,1.1);
  }
  Bt.build(world);
  buildYaks();
  bGroup=new THREE.Group(); world.add(bGroup);
  mGroup=new THREE.Group(); world.add(mGroup);
  evFx=new THREE.Group(); world.add(evFx); evFxSig=''; rainIM=null; armyMeshes={}; lastRobber=null;
  robberMesh=new THREE.Group();
  {const dark=MAT.robber, black=M(0x0b0b0e);
   [[G3.rbCloak,dark],[G3.rbHood,dark],[G3.rbFace,black],[G3.rbStaff,MAT.wood],[G3.rbLamp,MAT.lantern]].forEach(([g,m])=>robberMesh.add(new THREE.Mesh(g,m)));
   for(const z of [0.017,-0.017]){const e=new THREE.Mesh(G3.rbEye,MAT.eyes);e.position.set(0.085,0.315,z);robberMesh.add(e);}}
  robberMesh.children.forEach(m=>m.castShadow=true); robberMesh.scale.setScalar(1.3); world.add(robberMesh);
  ghost=new THREE.Mesh(G3.sphere,pMat(0).ghost); ghost.visible=false; world.add(ghost);
  selRing=new THREE.Mesh(G3.mDisc,MAT.glow); selRing.visible=false; world.add(selRing);
  wolfMesh=new THREE.Group(); {const fur=M(0x6f6a66),dark=M(0x3b3836);
    addMesh(wolfMesh,G3.wBody,fur);addMesh(wolfMesh,G3.wHead,fur);addMesh(wolfMesh,G3.wSnout,dark);addMesh(wolfMesh,G3.wTail,fur);
    [[-0.07,0.025],[-0.07,-0.025],[0.07,0.025],[0.07,-0.025]].forEach(([x,z])=>{addMesh(wolfMesh,G3.wLeg,dark).position.set(x,0,z);});
    [0.02,-0.02].forEach(z=>{addMesh(wolfMesh,G3.wEar,dark).position.set(0.125,0.2,z);});}
  wolfMesh.visible=false; world.add(wolfMesh);
  banditMesh=new THREE.Group(); {const cloak=M(0x5a2a2a),black=M(0x1c1c1f);
    for(const [x,z,r] of [[-0.09,0,0.4],[0.09,0.05,-0.5]]){const g=new THREE.Group();addMesh(g,G3.banBody,cloak);addMesh(g,G3.banHead,MAT.skin||M(0xd9ae86));addMesh(g,G3.banMask,black);addMesh(g,G3.banBlade,M(0xb9bec6));g.position.set(x,0,z);g.rotation.y=r;banditMesh.add(g);}}
  banditMesh.visible=false; world.add(banditMesh);
  lastEv='';
  smokeIM=new THREE.InstancedMesh(G3.puff,MAT.smoke,600); smokeIM.count=0; smokeIM.frustumCulled=false; world.add(smokeIM);
  const span=(B.R+2)*1.9; Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:1,far:80}); sun.shadow.camera.updateProjectionMatrix();
  applySceneTheme();
}
function updateEventFx(G){
  const ev=G.events, sig=JSON.stringify({h:ev.harvest||0,s:!!ev.storm,f:!!ev.flood,m:!!ev.merchant,c:ev.calving||0,r:!!ev.fishrun});
  if(sig===evFxSig) return; evFxSig=sig;
  while(evFx.children.length) evFx.remove(evFx.children[0]);
  rainIM=null; rainData=[];
  const B=G.B;
  if(ev.harvest) ev.harvest.forEach(k=>{const t=B.tileMap.get(k);const m=new THREE.Mesh(G3.shaft,MAT.shaft);m.position.set(t.x,t.top,t.z);m.userData.shaft=true;evFx.add(m);});
  if(ev.storm){const lakes=B.tiles.filter(t=>t.terrain==='lake');
    lakes.forEach(t=>{for(let i=0;i<70;i++){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*0.85;rainData.push({x:t.x+Math.cos(a)*r,z:t.z+Math.sin(a)*r,top:t.top,ph:Math.random()*1.5});}});
    if(rainData.length){rainIM=new THREE.InstancedMesh(G3.drop,MAT.rain,rainData.length);rainIM.frustumCulled=false;evFx.add(rainIM);}}
  if(ev.flood){for(const rv of B.rivers) rv.corners.forEach((k,i)=>{if(i%2) return;const c=B.corners.get(k);const d=new THREE.Mesh(G3.disc,MAT.puddle);d.scale.set(2.6,1,1.8);d.rotation.y=Math.random()*3;d.position.set(c.x+(Math.random()-0.5)*0.2,TOP+0.004,c.z+(Math.random()-0.5)*0.2);evFx.add(d);});}
  if(ev.calving) ev.calving.forEach(k=>{const t=B.tileMap.get(k);for(let i=0;i<2;i++){
      const g=new THREE.Group(),fur=M(i?0x6a4a34:0x8a6a50);[G3.yakBody,G3.yakSkirt,G3.yakHead].forEach(geo=>addMesh(g,geo,fur));
      const a=Math.random()*Math.PI*2,r=0.35+Math.random()*0.25;g.position.set(t.x+Math.cos(a)*r,TOP,t.z+Math.sin(a)*r);g.rotation.y=Math.random()*6.28;g.scale.setScalar(0.55);g.userData.calf={y:TOP,ph:Math.random()*6};evFx.add(g);popIn(g,g.position.x,g.position.z);}});
  if(ev.fishrun) B.tiles.filter(t=>t.terrain==='lake').forEach(t=>{for(let i=0;i<4;i++){
      const g=new THREE.Group();addMesh(g,G3.fishM,M(0x9fb8c8));addMesh(g,G3.fishTail,M(0x7d97a8));g.visible=false;
      g.userData.jump={cx:t.x+(Math.random()-0.5)*0.9,cz:t.z+(Math.random()-0.5)*0.9,a:Math.random()*6.28,ph:Math.random()*2.2,top:t.top};evFx.add(g);}});
  if(ev.merchant){const e=[...B.edges.values()].find(x=>x.gate);if(e){const a=B.corners.get(e.a),b=B.corners.get(e.b),lt=e.tiles.find(B.isLand),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
    const g=new THREE.Group();addMesh(g,G3.cartBody,MAT.plank);addMesh(g,G3.cartTop,M(0x7a4fa3));
    for(const [x,z] of [[-0.07,0.075],[0.07,0.075],[-0.07,-0.075],[0.07,-0.075]]){const w=addMesh(g,G3.cartWheel,MAT.wood);w.position.set(x,0.05,z);}
    g.position.set(mx+(lt.x-mx)*0.35,TOP,mz+(lt.z-mz)*0.35);g.rotation.y=Math.atan2(-(b.z-a.z),b.x-a.x);evFx.add(g);popIn(g,g.position.x,g.position.z);}}
}
const YAK_PARTS=[['yakBody','fur',0],['yakSkirt','dk',0],['yakSkirt2','fur',0],['yakHump','hump',0],['yakLeg','hoof',0],['yakHead','dk',1],['yakFore','fur',1],['yakMuzzle','muz',1],
  ['hornL','horn',1],['hornR','horn',1],['hornTipL','horn',1],['hornTipR','horn',1]];
function buildYaks(){
  if(!yakHerd.length) return;
  const hoof=new THREE.Color(0x3a3a3a), muz=new THREE.Color(0xead0a8);
  yakIMs=YAK_PARTS.map(([g,c,head])=>{const im=new THREE.InstancedMesh(G3[g],MAT.white,yakHerd.length);
    yakHerd.forEach((y,i)=>im.setColorAt(i,c==='fur'?y.fur:c==='dk'?y.dk:c==='hump'?y.fur.clone().offsetHSL(0,0,0.04):c==='horn'?y.horn:c==='hoof'?hoof:muz));
    im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;world.add(im);return {im,head};});
  updateYaks(performance.now(),0,true);
}
const _ym=new THREE.Matrix4(),_yq=new THREE.Quaternion(),_yv=new THREE.Vector3(),_ys=new THREE.Vector3(1,1,1),_up=new THREE.Vector3(0,1,0);
const _yp=new THREE.Matrix4().makeTranslation(0.075,0.12,0),_ypi=new THREE.Matrix4().makeTranslation(-0.075,-0.12,0),_yr=new THREE.Matrix4(),_yh=new THREE.Matrix4();
function updateYaks(now,dt,force){
  if(!yakIMs.length) return;
  const moving=!reduceMotion()&&dt>0;
  if(!moving&&!force) return;
  for(const y of yakHerd){
    if(moving){
      if(y.state==='graze'){y.pitch+=(0.55-y.pitch)*Math.min(1,dt*3);y.timer-=dt;
        if(y.timer<=0){for(let k=0;k<12;k++){const a=Math.random()*Math.PI*2,r=0.52+Math.random()*0.14,x=Math.cos(a)*r,z=Math.sin(a)*r;
            if(!inHex(x,z,0.66)) continue; if(distSeg2(0,0,y.x-y.tile.x,y.z-y.tile.z,x,z)<0.42) continue; y.tx=y.tile.x+x;y.tz=y.tile.z+z;y.state='walk';y.speed=0.045;break;}
          if(y.state!=='walk') y.timer=2;}}
      else{y.pitch+=(0-y.pitch)*Math.min(1,dt*4);const dx=y.tx-y.x,dz=y.tz-y.z,d=Math.hypot(dx,dz);
        const want=Math.atan2(-dz,dx);let da=want-y.rot;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;y.rot+=da*Math.min(1,dt*2.5);
        if(d<0.01){y.state='graze';y.timer=3+Math.random()*6;} else if(Math.abs(da)<0.6){const st=Math.min(d,(y.speed||0.045)*dt);y.x+=dx/d*st;y.z+=dz/d*st;}}
    }
    const bob=y.state==='walk'&&moving?Math.abs(Math.sin(now/180+y.ph))*0.006:0;
    _yq.setFromAxisAngle(_up,y.rot); _ym.compose(_yv.set(y.x,TOP+bob,y.z),_yq,_ys);
    _yr.makeRotationZ(-y.pitch); _yh.copy(_ym).multiply(_yp).multiply(_yr).multiply(_ypi);
    const i=yakHerd.indexOf(y); for(const o of yakIMs) o.im.setMatrixAt(i,o.head?_yh:_ym);
  }
  for(const o of yakIMs) o.im.instanceMatrix.needsUpdate=true;
}
function distSeg2(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;let u=l?((px-ax)*dx+(pz-az)*dz)/l:0;u=Math.max(0,Math.min(1,u));return Math.hypot(px-ax-u*dx,pz-az-u*dz);}
function yakNear(p,r){return yakHerd.find(y=>Math.hypot(y.x-p.x,y.z-p.z)<r);}
// Shoo: every yak near the number trots off to the far side of its pasture
function shooYaks(tile){
  let n=0;
  for(const y of yakHerd){ if(y.tile!==tile||Math.hypot(y.x-tile.x,y.z-tile.z)>0.62) continue;
    const a=Math.atan2(y.z-tile.z,y.x-tile.x)+(Math.random()-0.5)*0.6, r=0.6;
    y.tx=tile.x+Math.cos(a)*r; y.tz=tile.z+Math.sin(a)*r; y.state='walk'; y.speed=0.32; y.pitch=0; n++; }
  if(n){Snd.play('yak');toast(n===1?'Shoo! The yak trots off.':'Shoo! The yaks trot off.');}
  return n;
}
function rippleAt(x,y,z){
  const m=new THREE.Mesh(G3.ring,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5,depthWrite:false}));m.position.set(x,y,z);m.scale.setScalar(0.15);world.add(m);
  anim(1600,k=>{m.scale.setScalar(0.15+k*0.55);m.material.opacity=0.5*(1-k);},()=>{world.remove(m);m.material.dispose();});
}
let nextRipple=0;
const BOOT=`url("data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24"><path d="M7 2 H13 V13 L20 15 Q22.5 16 21.5 19.5 H4.5 Z" fill="#7a4a24" stroke="#fff" stroke-width="1.4"/><rect x="4.5" y="19.5" width="17" height="2.4" rx="1" fill="#3a2414" stroke="#fff" stroke-width="1"/></svg>')}") 6 30, pointer`;
function makeSoldier(p){const m=pMat(p),g=new THREE.Group();addMesh(g,G3.sold,m.wall);addMesh(g,G3.soldHead,MAT.skin);addMesh(g,G3.helm,MAT.steel);addMesh(g,G3.spear,MAT.wood);addMesh(g,G3.tip,MAT.steel);addMesh(g,G3.shield,m.roof);return g;}
function edgeMid(key){const e=G.B.edges.get(key),a=G.B.corners.get(e.a),b=G.B.corners.get(e.b);return new THREE.Vector3((a.x+b.x)/2,TOP+0.058,(a.z+b.z)/2);}
function battleAnim(from,to,done){
  {const m=edgeMid(to.key);if(isBot(G.cur)) focusAction(m.x,m.z);}
  const att=(armyMeshes[from.key]||[]).slice(-1), def=armyMeshes[to.key]||[];
  if(reduceMotion()||!att.length){done();return;}
  battling=true;
  const tgt=edgeMid(to.key), start=att.map(g=>g.position.clone());
  att.concat(def).forEach(g=>g.userData.busy=true);
  anim(450,k=>att.forEach((g,i)=>g.position.lerpVectors(start[i],new THREE.Vector3(tgt.x+(start[i].x-tgt.x)*0.35,start[i].y,tgt.z+(start[i].z-tgt.z)*0.35),k)),()=>{
    const base=att.concat(def).map(g=>g.position.clone());
    let lastSpark=0;
    anim(1000,k=>{
      att.concat(def).forEach((g,i)=>{const ph=k*40+i*1.7;g.position.set(base[i].x+Math.sin(ph)*0.02,base[i].y+Math.abs(Math.sin(ph*0.7))*0.03,base[i].z+Math.cos(ph*1.3)*0.02);if(g.userData.spear) g.userData.spear.rotation.z=g.userData.tip.rotation.z=Math.sin(ph)*0.5;});
      if(k-lastSpark>0.12){lastSpark=k;Snd.play('clash');
        for(let i=0;i<4;i++){const sp=new THREE.Mesh(G3.dust,MAT.spark);sp.scale.setScalar(0.4);const a=Math.random()*Math.PI*2,v=0.2+Math.random()*0.3;sp.position.set(tgt.x,tgt.y+0.12,tgt.z);world.add(sp);
          anim(350,q=>{sp.position.set(tgt.x+Math.cos(a)*v*q,tgt.y+0.12+Math.sin(q*Math.PI)*0.15,tgt.z+Math.sin(a)*v*q);sp.scale.setScalar(0.4*(1-q)+0.01);},()=>world.remove(sp));}
        popIn(new THREE.Group(),tgt.x+(Math.random()-0.5)*0.2,tgt.z+(Math.random()-0.5)*0.2);
      }
    },()=>{battling=false;done();});
  });
}
function retreatAnim(list){
  if(reduceMotion()||!list) return;
  list.forEach((r,ri)=>{
    const s=edgeMid(r.from), d=r.to?edgeMid(r.to):null;
    for(let i=0;i<Math.min(r.n,3);i++){
      const g=makeSoldier(r.p); g.scale.setScalar(ARMY_S); g.position.copy(s); g.position.x+=(i-1)*0.06; world.add(g);
      if(d){g.rotation.y=Math.atan2(-(d.z-s.z),d.x-s.x)+Math.PI/2;
        anim(1400,k=>{g.position.set(s.x+(d.x-s.x)*k+(i-1)*0.06,s.y+Math.abs(Math.sin(k*Math.PI*8))*0.03,s.z+(d.z-s.z)*k);g.scale.setScalar(k>0.85?Math.max(0.01,(1-k)/0.15):1);},()=>world.remove(g),ri*150+i*90);}
      else anim(1200,k=>{g.rotation.z=k*1.4;g.position.y=s.y-k*0.12;g.scale.setScalar(Math.max(0.01,1-k*0.9));},()=>world.remove(g),ri*150+i*90);
    }
  });
}
function popIn(g,x,z){
  if(reduceMotion()) return;
  g.scale.setScalar(0.001); anim(460,k=>g.scale.setScalar(Math.max(0.001,easeOutBack(k))));
  for(let i=0;i<9;i++){
    const m=new THREE.Mesh(G3.dust,new THREE.MeshBasicMaterial({color:0xd9ccb0,transparent:true,opacity:0.8,depthWrite:false}));
    const a=i/9*Math.PI*2+Math.random()*0.4; m.position.set(x,TOP+0.03,z); world.add(m);
    anim(650,k=>{const r=0.08+k*0.28;m.position.set(x+Math.cos(a)*r,TOP+0.03+Math.sin(k*Math.PI)*0.09,z+Math.sin(a)*r);m.scale.setScalar(1+k*1.4);m.material.opacity=0.8*(1-k);},()=>{world.remove(m);m.material.dispose();},60);
  }
}
let justBuilt=null;
/* ---- 3D heroes: built from parts, animated on the board, photographed for portraits ---- */
const HAIRSTYLES=[['short','Short'],['long','Long'],['bun','Bun'],['braids','Braids'],['bald','None']];
const HEADWEAR=[['none','None'],['hood','Hood'],['hat','Hat'],['circlet','Circlet']];
const HG={
  leg:new THREE.CylinderGeometry(0.017,0.015,0.09,7).translate(0,-0.045,0),
  boot:new THREE.BoxGeometry(0.038,0.024,0.03).translate(0.007,-0.093,0),
  torso:new THREE.CylinderGeometry(0.041,0.05,0.11,10).translate(0,0.055,0),
  belt:new THREE.CylinderGeometry(0.0515,0.0515,0.016,10).translate(0,0.012,0),
  skirt:new THREE.CylinderGeometry(0.05,0.059,0.042,10).translate(0,-0.012,0),
  collar:new THREE.TorusGeometry(0.03,0.008,6,14).rotateX(Math.PI/2).translate(0,0.11,0),
  arm:new THREE.CylinderGeometry(0.0135,0.011,0.085,7).translate(0,-0.042,0),
  hand:new THREE.SphereGeometry(0.0145,8,6).translate(0,-0.09,0),
  head:new THREE.SphereGeometry(0.044,16,12),
  eye:new THREE.SphereGeometry(0.0066,8,6), glint:new THREE.SphereGeometry(0.0022,5,4),
  ear:new THREE.SphereGeometry(0.0105,6,5), nose:new THREE.ConeGeometry(0.0075,0.017,6).rotateZ(-Math.PI/2),
  mN:new THREE.BoxGeometry(0.004,0.0035,0.017),
  mS:new THREE.TorusGeometry(0.0105,0.0026,5,12,Math.PI).rotateY(Math.PI/2).rotateX(Math.PI),
  mF:new THREE.TorusGeometry(0.0105,0.0026,5,12,Math.PI).rotateY(Math.PI/2),
  mO:new THREE.SphereGeometry(0.0085,8,6).scale(0.5,1,1),
  brow:new THREE.BoxGeometry(0.004,0.0032,0.016),
  cap:new THREE.SphereGeometry(0.0485,16,10,0,Math.PI*2,0,Math.PI*0.56).translate(-0.004,0.004,0),
  long:new THREE.BoxGeometry(0.022,0.075,0.082).translate(-0.034,-0.03,0),
  bun:new THREE.SphereGeometry(0.022,10,8).translate(-0.036,0.034,0),
  braid:new THREE.CylinderGeometry(0.0095,0.007,0.075,6),
  hood:new THREE.SphereGeometry(0.057,16,12,Math.PI+0.95,Math.PI*2-1.9,0,Math.PI*0.68).translate(-0.004,0.003,0),
  hoodBack:new THREE.BoxGeometry(0.03,0.06,0.088).translate(-0.042,-0.035,0),
  brim:new THREE.CylinderGeometry(0.078,0.078,0.006,18).translate(0,0.03,0), crown:new THREE.CylinderGeometry(0.034,0.042,0.046,14).translate(0,0.056,0),
  band:new THREE.CylinderGeometry(0.0425,0.0425,0.01,14).translate(0,0.037,0),
  circlet:new THREE.TorusGeometry(0.046,0.0048,6,18).rotateX(Math.PI/2).translate(0,0.014,0), gem:new THREE.OctahedronGeometry(0.008).translate(0.046,0.016,0),
  cape:new THREE.BoxGeometry(0.008,0.135,0.1).translate(0,-0.065,0),
  pole:new THREE.CylinderGeometry(0.0055,0.0055,0.32,5), tines:new THREE.BoxGeometry(0.004,0.05,0.042), bar:new THREE.BoxGeometry(0.006,0.006,0.048),
  crook:new THREE.TorusGeometry(0.028,0.0055,5,12,Math.PI*1.2),
  rod:new THREE.CylinderGeometry(0.004,0.0035,0.42,4), line:new THREE.CylinderGeometry(0.0012,0.0012,0.16,3),
  handle:new THREE.CylinderGeometry(0.006,0.006,0.15,5), hammer:new THREE.BoxGeometry(0.058,0.03,0.03),
  purse:new THREE.SphereGeometry(0.02,8,6).scale(1,1.15,1), coin:new THREE.CylinderGeometry(0.017,0.017,0.005,12).rotateX(Math.PI/2),
  blade:new THREE.BoxGeometry(0.013,0.17,0.03), guard:new THREE.BoxGeometry(0.012,0.012,0.07), shieldD:new THREE.CylinderGeometry(0.04,0.04,0.01,14).rotateZ(Math.PI/2),
};
const shadeCss=(css,f)=>{const c=new THREE.Color(css);c.multiplyScalar(f);return '#'+c.getHexString();};
function buildHero(L,css,ability,expr='neutral'){
  L=L||{};
  const outfit=lookMat(L.outfit||css), accent=lookMat(shadeCss(L.outfit||css,0.62)), team=lookMat(css), skin=lookMat(L.skin||'#d9ae86'),
    hair=lookMat(L.hair||'#3b2a1e'), dark=lookMat('#2a2420'), lip=lookMat('#7a2a20'), white=lookMat('#ffffff'), gold=lookMat('#d8b13a');
  const g=new THREE.Group(), add=(par,geo,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;par.add(m);return m;};
  const legs=[0.022,-0.022].map(z=>{const lg=new THREE.Group();lg.position.set(0,0.1,z);add(lg,HG.leg,accent);add(lg,HG.boot,dark);g.add(lg);return lg;});
  const body=new THREE.Group(); body.position.y=0.1; g.add(body);
  add(body,HG.torso,outfit); add(body,HG.skirt,outfit); add(body,HG.belt,team); add(body,HG.collar,accent);
  const arm=z=>{const a=new THREE.Group();a.position.set(0,0.103,z);add(a,HG.arm,outfit);add(a,HG.hand,skin);body.add(a);return a;};
  const armR=arm(0.058), armL=arm(-0.058);
  if(L.cape){const c=add(body,HG.cape,team,-0.044,0.108,0);c.rotation.z=-0.12;}
  const head=new THREE.Group(); head.position.y=0.165; body.add(head);
  add(head,HG.head,skin); add(head,HG.ear,skin,0,-0.002,0.043); add(head,HG.ear,skin,0,-0.002,-0.043); add(head,HG.nose,skin,0.045,-0.004,0);
  for(const z of [0.0155,-0.0155]){add(head,HG.eye,dark,0.038,0.007,z);add(head,HG.glint,white,0.0435,0.0095,z*0.92);}
  const mouth={smile:[HG.mS,dark,0.0405,-0.012],frown:[HG.mF,dark,0.04,-0.026],grr:[HG.mF,dark,0.04,-0.026],open:[HG.mO,lip,0.04,-0.019]}[expr]||[HG.mN,dark,0.042,-0.02];
  add(head,mouth[0],mouth[1],mouth[2],mouth[3],0);
  if(expr==='frown'||expr==='grr'){for(const s of [1,-1]){const b=add(head,HG.brow,dark,0.04,0.02,0.015*s);b.rotation.x=(expr==='grr'?0.5:-0.45)*s;}}
  const hw=L.headwear||'none', hs=L.hairStyle||'short';
  if(hw!=='hood'&&hs!=='bald') add(head,HG.cap,hair);
  if(hs==='long') add(head,HG.long,hair);
  if(hs==='bun') add(head,HG.bun,hair);
  if(hs==='braids') for(const z of [0.036,-0.036]) add(head,HG.braid,hair,-0.012,-0.042,z);
  if(hw==='hood'){add(head,HG.hood,team);add(head,HG.hoodBack,team);}
  if(hw==='hat'){add(head,HG.brim,accent);add(head,HG.crown,accent);add(head,HG.band,team);}
  if(hw==='circlet'){add(head,HG.circlet,gold);add(head,HG.gem,lookMat(css));}
  // the ability's tool, held in the right hand
  const tool=new THREE.Group(); tool.position.y=-0.09; armR.add(tool);
  const wood=MAT.wood, steel=MAT.steel;
  switch(ability){
    case 'farmer': add(tool,HG.pole,wood,0,0.07,0); add(tool,HG.bar,steel,0,0.23,0); add(tool,HG.tines,steel,0,0.255,0); break;
    case 'herder': add(tool,HG.pole,wood,0,0.07,0); {const c=add(tool,HG.crook,wood,0.026,0.235,0);c.rotation.z=-0.3;} break;
    case 'angler': {const r=add(tool,HG.rod,wood,0.09,0.12,0);r.rotation.z=-0.65;add(tool,HG.line,lookMat('#dddddd'),0.23,0.12,0);} break;
    case 'engineer': add(tool,HG.handle,wood,0,0.045,0); add(tool,HG.hammer,steel,0,0.12,0); break;
    case 'merchant': add(tool,HG.purse,lookMat('#8a6440'),0,-0.01,0); add(tool,HG.coin,gold,0.02,0.02,0.012); break;
    case 'warlord': add(tool,HG.blade,steel,0,0.1,0); add(tool,HG.guard,gold,0,0.017,0);
      {const sh=new THREE.Group();sh.position.y=-0.07;armL.add(sh);add(sh,HG.shieldD,team,0.01,0,-0.012);} break;
  }
  g.userData.parts={legs,armR,armL,head,body};
  return g;
}
/* A second, tiny renderer that photographs heroes for portraits and the hero creator. */
let PR=null; const prCache={};
function portraitRig(){
  if(PR!==null) return PR;
  try{
    const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    if(!r.domElement||!r.domElement.toDataURL||!r.render) throw new Error('no renderer');
    r.setPixelRatio(1); r.setSize(192,192,false);
    const sc=new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff6ea,0x6d6152,0.95));
    const d=new THREE.DirectionalLight(0xffffff,0.85); d.position.set(2,3,1.5); sc.add(d);
    PR={r,sc,cam:new THREE.PerspectiveCamera(26,1,0.01,10),size:192};
  }catch(e){PR=false;}
  return PR;
}
function heroPortrait(L,css,ability,expr){
  const P=portraitRig(); if(!P) return null;
  const key=JSON.stringify([L||{},css,ability||'',expr]); if(prCache[key]) return prCache[key];
  if(P.size!==192){P.r.setSize(192,192,false);P.size=192;}
  const h=buildHero(L,css,ability,expr); h.rotation.y=-0.35; P.sc.add(h);
  P.cam.fov=26; P.cam.updateProjectionMatrix(); P.cam.position.set(0.36,0.29,0.06); P.cam.lookAt(0,0.262,0);
  P.r.setClearColor(0x000000,0); P.r.render(P.sc,P.cam);
  const url=P.r.domElement.toDataURL('image/png'); P.sc.remove(h);
  return prCache[key]=url;
}
// Rotating full-body preview in the hero creator
let previewHero=null, previewKey='';
function drawPreview(now){
  const cv=document.getElementById('hero3d'); if(!cv||$('#lobbyScr').hidden) return;
  const P=portraitRig(); if(!P) return;
  if(P.size!==360){P.r.setSize(360,360,false);P.size=360;}
  if(!previewHero) return;
  previewHero.rotation.y=reduceMotion()?-0.5:now/1600;
  animateHeroParts(previewHero,now,0.7,false,0);
  P.cam.fov=24; P.cam.updateProjectionMatrix(); P.cam.position.set(0.86,0.36,0); P.cam.lookAt(0,0.17,0);
  P.sc.add(previewHero); P.r.setClearColor(0x000000,0); P.r.render(P.sc,P.cam); P.sc.remove(previewHero);
  const x=cv.getContext('2d'); x.clearRect(0,0,cv.width,cv.height); x.drawImage(P.r.domElement,0,0,cv.width,cv.height);
}
// Idle, walking and celebrating, shared by the board and the creator preview
const heroFx={};
function animateHeroParts(h,now,ph,walking,p){
  const u=h.userData.parts; if(!u) return;
  const t=now/1000, rm=reduceMotion();
  if(rm){u.head.rotation.y=0;return;}
  const fx=heroFx[p]||{};
  u.body.scale.y=1+Math.sin(t*2.1+ph)*0.014;
  u.head.rotation.y=fx.shake>now?Math.sin(t*28)*0.5:Math.sin(t*0.55+ph)*0.45;
  if(walking){const s=Math.sin(t*14);u.legs[0].rotation.z=s*0.55;u.legs[1].rotation.z=-s*0.55;u.armL.rotation.z=-s*0.4;u.armR.rotation.z=s*0.25;u.armR.rotation.x=0;u.armL.rotation.x=0;}
  else if(fx.cheer>now){u.armR.rotation.x=-2.5+Math.sin(t*12)*0.2;u.armL.rotation.x=2.5-Math.sin(t*12)*0.2;u.legs.forEach(l=>l.rotation.z=0);}
  else{u.legs.forEach(l=>l.rotation.z=0);u.armR.rotation.x=0;u.armL.rotation.x=0;u.armL.rotation.z=Math.sin(t*1.3+ph)*0.07;u.armR.rotation.z=-0.15+Math.sin(t*1.3+ph+1)*0.05;}
}
let heroMeshes={}, heroPrev={};

function renderPieces(G){
  const B=G.B; threatSet=new Set(G.phase==='setup'?[]:Engine.threats(G,viewer()).map(t=>t.c.key)); while(bGroup.children.length) bGroup.remove(bGroup.children[0]);
  smokeEm=[]; const jb=justBuilt; justBuilt=null;
  for(const c of B.corners.values()){
    if(!c.building) continue;
    const m=pMat(c.building.p), g=new THREE.Group(), city=c.building.type==='city';
    const parts=city?[[G3.cBody,m.wall],[G3.cRoof,m.roof],[G3.tower,m.wall],[G3.tRoof,m.roof],[G3.chimC,MAT.chim],[G3.doorC,MAT.door],[G3.winC,MAT.win],[G3.winT,MAT.win]]:[[G3.sBody,m.wall],[G3.sRoof,m.roof],[G3.chimV,MAT.chim],[G3.doorV,MAT.door],[G3.winV,MAT.win]];
    parts.forEach(([geo,mat])=>{addMesh(g,geo,mat);g.add(new THREE.LineSegments(edgeGeo(geo),pLine(c.building.p)));});
    let bx=c.x,bz=c.z;
    if(c.river){const ne=c.edges.map(k=>B.edges.get(k)).find(e=>!e.river);if(ne){const o=B.corners.get(ne.a===c.key?ne.b:ne.a);bx+=(o.x-c.x)*0.14;bz+=(o.z-c.z)*0.14;}}
    g.position.set(bx,TOP,bz); g.rotation.y=Math.atan2(c.x,c.z)+Math.PI/2; g.scale.setScalar(PIECE); bGroup.add(g);
    if(uiPrefs.cb) addBadge(c.building.p,bx,TOP+(city?0.62:0.46),bz);
    if(G.phase!=='over'&&c.building.p===viewer()&&!isBot(viewer())&&threatSet.has(c.key)){const sp=new THREE.Sprite(warnMat());sp.position.set(bx,TOP+(city?0.8:0.62),bz);sp.scale.set(0.26,0.26,1);sp.renderOrder=6;bGroup.add(sp);}
    g.updateMatrixWorld();
    const sp=(city?new THREE.Vector3(-0.12,0.29,0.04):new THREE.Vector3(0.05,0.26,0.035)).applyMatrix4(g.matrixWorld);
    smokeEm.push({x:sp.x,y:sp.y,z:sp.z,ph:c.x*1.7+c.z*2.3,n:city?7:5});
    if(jb===c.key){popIn(g,c.x,c.z);Snd.play(c.building.type==='city'?'city':'build');setTimeout(()=>react(c.building.p,'happy'),50);}
    {const sb=Engine.siegedBy(G,c);
     if(sb!==null){
       const sp=new THREE.Sprite(iconSprite('swords','#b0412e'));sp.position.set(bx,TOP+0.85,bz);sp.scale.set(0.42,0.42,1);bGroup.add(sp);
       const se=c.edges.map(k=>B.edges.get(k)).find(x=>x.army&&x.army.p===sb);
       if(se){const o=B.corners.get(se.a===c.key?se.b:se.a),dx=o.x-c.x,dz=o.z-c.z,L=Math.hypot(dx,dz),px=-dz/L,pz=dx/L,m=pMat(sb);
         for(const sd of [-1,1]){const tn=new THREE.Mesh(G3.tent,m.wall);tn.position.set(c.x+dx*0.32+px*0.12*sd,TOP,c.z+dz*0.32+pz*0.12*sd);tn.rotation.y=Math.PI/4;tn.castShadow=true;bGroup.add(tn);}
         const f=new THREE.Mesh(G3.fire,MAT.lantern);f.position.set(c.x+dx*0.3,TOP,c.z+dz*0.3);bGroup.add(f);}
     }}
  }
  for(const e of B.edges.values()){
    if(!e.road) continue;
    const a=B.corners.get(e.a), b=B.corners.get(e.b), dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz), px=-dz/L, pz=dx/L;
    const before=bGroup.children.length, mat=pMat(e.road.p).wall;
    const P=(f)=>({x:a.x+dx*f,z:a.z+dz*f});
    if(e.river){
      // stone abutments on each bank, an arched plank deck, and railings in the player's color
      for(const f of [0.13,0.87]){const q=P(f);const ab=box(q.x-dx*0.07,TOP+0.03,q.z-dz*0.07,q.x+dx*0.07,TOP+0.03,q.z+dz*0.07,0.24,0.07,MAT.stone);bGroup.add(ab);}
      const N=6, pts=[]; for(let i=0;i<=N;i++){const f=0.04+0.92*i/N, q=P(f);pts.push({x:q.x,z:q.z,y:TOP+0.06+Math.sin(Math.PI*i/N)*0.09});}
      for(let i=0;i<N;i++){const u=pts[i],v=pts[i+1];bGroup.add(box(u.x,u.y,u.z,v.x,v.y,v.z,0.19,0.03,MAT.plank));
        for(const sd of [-1,1]){const ox=px*0.1*sd,oz=pz*0.1*sd;bGroup.add(box(u.x+ox,u.y+0.07,u.z+oz,v.x+ox,v.y+0.07,v.z+oz,0.022,0.022,mat));}}
      for(let i=0;i<=N;i+=2){const u=pts[i];for(const sd of [-1,1]){const pm=new THREE.Mesh(G3.rPost,mat);pm.position.set(u.x+px*0.1*sd,u.y-0.005,u.z+pz*0.1*sd);pm.castShadow=true;bGroup.add(pm);}}
    } else {
      const s1=P(0.02), s2=P(0.98);
      bGroup.add(box(s1.x,TOP+0.014,s1.z,s2.x,TOP+0.014,s2.z,0.19,0.028,MAT.dirt));
      for(const sd of [-1,1]){const ox=px*0.034*sd,oz=pz*0.034*sd;const r1=P(0.08),r2=P(0.92);bGroup.add(box(r1.x+ox,TOP+0.03,r1.z+oz,r2.x+ox,TOP+0.03,r2.z+oz,0.014,0.004,MAT.rut));}
      const c1=P(0.17), c2=P(0.83), roof=pMat(e.road.p).roof;
      for(const sd of [-1,1]){const ox=px*0.092*sd,oz=pz*0.092*sd;bGroup.add(box(c1.x+ox,TOP+0.062,c1.z+oz,c2.x+ox,TOP+0.062,c2.z+oz,0.022,0.022,mat));
        bGroup.add(box(c1.x+ox,TOP+0.03,c1.z+oz,c2.x+ox,TOP+0.03,c2.z+oz,0.018,0.016,mat));
        for(const f of [0.17,0.5,0.83]){const q=P(f);const pm=new THREE.Mesh(G3.rPost,roof);pm.position.set(q.x+ox,TOP,q.z+oz);pm.castShadow=true;bGroup.add(pm);}}
    }
    if(jb===e.key&&!reduceMotion()){
      Snd.play(e.river?'bridge':'road');
      bGroup.children.slice(before).forEach(m=>{const y=m.position.y;m.position.y=y+0.5;anim(380,k=>{m.position.y=y+0.5*(1-k)*(1-k);});});
      popIn(new THREE.Group(),(a.x+b.x)/2,(a.z+b.z)/2);
    }
  }
  // dirt hubs where roads meet, so the network reads as one connected track
  for(const c of B.corners.values()){
    if(c.building) continue;
    const roads=c.edges.map(k=>B.edges.get(k)).filter(e=>e.road&&!e.river);
    if(!roads.length) continue;
    const h=new THREE.Mesh(G3.hub,MAT.dirt); h.position.set(c.x,TOP+0.014,c.z); h.scale.set(1.35,1.15,1.35); h.receiveShadow=true; bGroup.add(h);
  }
  // "blocked" markers over number tokens
  const blocked=[G.robber,G.events.wolf&&B.tileMap.get(G.events.wolf.tile),G.events.bandits&&B.tileMap.get(G.events.bandits.tile)].filter(t=>t&&t.num);
  for(const bt of blocked){const sp=new THREE.Sprite(blockMat());sp.position.set(bt.x,bt.top+0.32,bt.z);sp.scale.set(0.36,0.36,1);bGroup.add(sp);}
  const t=G.robber; robberMesh.visible=!!t;
  if(t){
    const nx=t.x+(t.num?0.36:0), nz=t.z;
    if(lastRobber&&lastRobber!==t){Snd.play('whoosh');if(isBot(G.cur)) focusAction(t.x,t.z);}
    if(lastRobber&&lastRobber!==t&&!reduceMotion()){const sx=robberMesh.position.x,sz=robberMesh.position.z;robberMesh.rotation.y=Math.atan2(-(nz-sz),nx-sx);
      anim(700,k=>robberMesh.position.set(sx+(nx-sx)*k,t.top+Math.sin(k*Math.PI)*0.9,sz+(nz-sz)*k));}
    else robberMesh.position.set(nx,t.top,nz);
    lastRobber=t;
  }
  // fishermen
  rods=[];
  for(const c of B.corners.values()){
    if(!c.fisher||!c.building) continue;
    const lake=c.tiles.find(x=>x.terrain==='lake'), m=pMat(c.building.p), g=new THREE.Group();
    addMesh(g,G3.hull,MAT.plank); addMesh(g,G3.fBody,m.wall); addMesh(g,G3.fHead,MAT.skin); const rod=addMesh(g,G3.rod,MAT.wood);
    addMesh(g,G3.mast,MAT.wood); const fl=addMesh(g,G3.boatFlag,m.wall); g.add(new THREE.LineSegments(edgeGeo(G3.boatFlag),pLine(c.building.p)));
    const rg=new THREE.Mesh(G3.ring,MAT.foam); rg.scale.set(1.15,1,1.15); rg.position.y=0.01; g.add(rg);
    g.scale.setScalar(1.8);
    g.position.set(c.x+(lake.x-c.x)*0.34,WATER,c.z+(lake.z-c.z)*0.34); g.rotation.y=Math.atan2(-(lake.z-c.z),lake.x-c.x)+Math.PI/2;
    bGroup.add(g); rods.push({rod,boat:g,ph:c.x*3.1+c.z*1.7});
    if(jb==='f'+c.key){popIn(g,g.position.x,g.position.z);Snd.play('splash');}
  }
  // armies
  armyMeshes={};
  for(const e of B.edges.values()){
    if(!e.army) continue;
    const a=B.corners.get(e.a), b=B.corners.get(e.b), dx=b.x-a.x, dz=b.z-a.z, L=Math.hypot(dx,dz), px=-dz/L, pz=dx/L, m=pMat(e.army.p), n=Math.min(e.army.n,LIMITS.stack);
    for(let k=0;k<n;k++){
      const tt=0.5+(k-(n-1)/2)*0.22, g=new THREE.Group(); g.scale.setScalar(ARMY_S);
      addMesh(g,G3.sold,m.wall); addMesh(g,G3.soldHead,MAT.skin); addMesh(g,G3.helm,MAT.steel); addMesh(g,G3.spear,MAT.wood); addMesh(g,G3.tip,MAT.steel); addMesh(g,G3.shield,m.roof);
      const side=(k%2?1:-1)*0.035;
      g.position.set(a.x+dx*tt+px*side,TOP+(e.river?0.1:0.058),a.z+dz*tt+pz*side); g.rotation.y=Math.atan2(px,pz)+Math.PI/2;
      g.userData={y0:g.position.y,x0:g.position.x,z0:g.position.z,spear:g.children[3],tip:g.children[4],k};
      (armyMeshes[e.key]=armyMeshes[e.key]||[]).push(g);
      bGroup.add(g); if(jb==='a'+e.key&&k===n-1){popIn(g,g.position.x,g.position.z);Snd.play('march');}
    }
    if(uiPrefs.cb) addBadge(e.army.p,(a.x+b.x)/2,TOP+0.5,(a.z+b.z)/2,0.18);
  }
  // heroes and their banners
  heroMeshes={};
  G.heroes.forEach((h,p)=>{
    const m=pMat(p), L=h.look||{};
    if(h.home){const c=B.corners.get(h.home), g=new THREE.Group(), o=new THREE.Vector3(c.x,0,c.z).normalize().multiplyScalar(0.16);
      addMesh(g,G3.bPole,MAT.wood); const f=new THREE.Mesh(G3.bFlag,flagMat(p,L.sigil)); f.castShadow=true; g.add(f);
      g.position.set(c.x+o.x+0.1,TOP,c.z+o.z); g.rotation.y=-0.6; bGroup.add(g);}
    if(!h.edge) return;
    const e=B.edges.get(h.edge), a=B.corners.get(e.a), b=B.corners.get(e.b), dx=b.x-a.x, dz=b.z-a.z, len=Math.hypot(dx,dz), px=-dz/len, pz=dx/len;
    const others=G.heroes.filter((x,q)=>q<p&&x.edge===h.edge).length, tt=0.22+others*0.14, side=e.army?0.09:0;
    const g=buildHero(L,PLAYERS[p].css,h.ability); g.scale.setScalar(HERO_S); heroMeshes[p]=g;
    g.position.set(a.x+dx*tt+px*side,TOP+(e.river?0.09:0.012),a.z+dz*tt+pz*side); g.rotation.y=Math.atan2(px,pz)+Math.PI/2;
    if(h.wounded!==false){g.rotation.z=0.5; g.position.y-=0.03;}
    {const prev=heroPrev[p], to=g.position.clone();
     if(prev&&prev.edge!==h.edge&&h.wounded===false&&!reduceMotion()){
       const from=prev.pos.clone(), face=g.rotation.y; g.rotation.y=Math.atan2(-(to.z-from.z),to.x-from.x); g.position.copy(from); g.userData.walking=true;
       anim(750,k=>{g.position.lerpVectors(from,to,k);g.position.y=from.y+(to.y-from.y)*k+Math.abs(Math.sin(k*Math.PI*4))*0.012;},()=>{g.userData.walking=false;g.rotation.y=face;});
     }
     heroPrev[p]={edge:h.edge,pos:to};}
    bGroup.add(g);
    {let yb=TOP+0.84;for(const [k,ic,bg] of [['commission','roads','#6b6f78'],['muster','reinf','#8a2f2f']]) if(Engine.hasCredit(G,p,k)){const sp=new THREE.Sprite(iconSprite(ic,bg));sp.position.set(g.position.x,yb,g.position.z);sp.scale.set(0.26,0.26,1);bGroup.add(sp);yb+=0.28;}}
    if(window.innerWidth>760){const tag=new THREE.Sprite(tagMat(p,h)); tag.position.set(g.position.x,TOP+0.62,g.position.z); tag.scale.set(0.62,0.16,1); bGroup.add(tag);}
    if(jb==='h'+p) popIn(g,g.position.x,g.position.z);
  });
  if(selEdge&&selEdge.army){const a=B.corners.get(selEdge.a),b=B.corners.get(selEdge.b);selRing.position.set((a.x+b.x)/2,TOP+0.02,(a.z+b.z)/2);selRing.scale.set(2.4,1,2.4);selRing.visible=true;} else selRing.visible=false;
  // events on the board
  const ev=G.events, tk=k=>B.tileMap.get(k);
  if(ev.wolf){const wt=tk(ev.wolf.tile), pos=new THREE.Vector3(wt.x-0.38,TOP,wt.z+0.05);
    if(!wolfMesh.visible&&ev.wolf.from&&!reduceMotion()){const f=tk(ev.wolf.from),s0=new THREE.Vector3(f.x-0.38,TOP,f.z+0.05);wolfMesh.rotation.y=Math.atan2(-(pos.z-s0.z),pos.x-s0.x);
      anim(1600,k=>wolfMesh.position.set(s0.x+(pos.x-s0.x)*k,TOP+Math.abs(Math.sin(k*Math.PI*6))*0.08,s0.z+(pos.z-s0.z)*k));}
    else wolfMesh.position.copy(pos);
    wolfMesh.visible=true;} else wolfMesh.visible=false;
  if(ev.bandits){const bt=tk(ev.bandits.tile);banditMesh.position.set(bt.x-0.36,TOP,bt.z-0.1);if(!banditMesh.visible) popIn(banditMesh,bt.x-0.36,bt.z-0.1);banditMesh.visible=true;} else banditMesh.visible=false;
  B.tiles.forEach(x=>{if(x.terrain==='lake') x.capMat.color.set(ev.storm?0x40566a:0x4a8fb5);});
  MAT.river.color.set(ev.flood?0xc8b089:0xffffff);
  updateEventFx(G);
}
/* Legal-spot markers */
let markerMats=[];
function showMarkers(G,kind,list){
  while(mGroup.children.length) mGroup.remove(mGroup.children[0]);
  markerMats.forEach(m=>m.dispose()); markerMats=[];
  robberHL.forEach(t=>t.capMat.emissive.setRGB(0,0,0)); robberHL=[];
  heroHL.forEach(t=>t.capMat.emissive.setRGB(0,0,0)); heroHL=[];
  if(kind==='hero'&&Engine.heroActive(G,G.cur)) heroHL=G.B.edges.get(G.heroes[G.cur].edge).tiles.filter(t=>!t.rim);
  if(kind==='hero') kind='road';
  if(!kind) return;
  if(kind==='robber'){robberHL=list;return;}
  const col=isWhite(G.cur)?0xffffff:PLAYERS[G.cur].color;
  const mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.6,depthWrite:false}); markerMats.push(mat);
  for(const x of list){
    if(x.a!==undefined){const a=G.B.corners.get(x.a),b=G.B.corners.get(x.b),y=TOP+(x.river&&x.road?0.2:0.05)+(kind==='road'?0:0.02);const m=box(a.x+(b.x-a.x)*0.22,y,a.z+(b.z-a.z)*0.22,b.x-(b.x-a.x)*0.22,y,b.z-(b.z-a.z)*0.22,kind==='road'?0.09:0.12,0.03,mat);m.castShadow=false;mGroup.add(m);}
    else{const y=TOP+(kind==='city'?0.44:0.03);const ring=new THREE.Mesh(G3.ring,mat);ring.scale.set(0.68,0.8,0.68);ring.position.set(x.x,y+0.01,x.z);mGroup.add(ring);const dot=new THREE.Mesh(G3.mDisc,mat);dot.scale.set(0.28,0.5,0.28);dot.position.set(x.x,y,x.z);mGroup.add(dot);}
  }
}
function ripple(t,col){
  if(reduceMotion()) return;
  for(let j=0;j<2;j++){const m=new THREE.Mesh(G3.ring,new THREE.MeshBasicMaterial({color:col||0xfff1c4,transparent:true,opacity:0.9,depthWrite:false}));m.position.set(t.x,t.top+0.06,t.z);world.add(m);
    anim(900,k=>{m.scale.setScalar(1.2+k*2.4);m.material.opacity=0.9*(1-k);},()=>{world.remove(m);m.material.dispose();},j*250);}
}
function collect(g,i){
  Snd.play('collect',g.res,0.6+i*0.09);
  setTimeout(()=>react(g.p,'happy'),1300+i*60);
  const delay=i*90;
  if(!g.hero&&g.corner.building!==undefined&&!reduceMotion()){
    const v=new THREE.Group(), m=pMat(g.p); addMesh(v,G3.vBody,m.wall); addMesh(v,G3.vHead,MAT.skin); v.scale.setScalar(1.3);
    const sx=g.corner.x, sz=g.corner.z, ex=sx+(g.tile.x-sx)*0.38, ez=sz+(g.tile.z-sz)*0.38; v.visible=false; world.add(v);
    v.rotation.y=Math.atan2(-(ez-sz),ex-sx);
    anim(1250,k=>{v.visible=true;const q=k<0.3?k/0.3:k<0.6?1:1-(k-0.6)/0.4;v.position.set(sx+(ex-sx)*q,TOP+Math.abs(Math.sin(k*Math.PI*9))*0.025,sz+(ez-sz)*q);if(k>0.3&&k<0.6) v.rotation.z=Math.sin(k*60)*0.25; else v.rotation.z=0;},()=>world.remove(v),delay);
  }
  flyRes(g.tile,g.corner,g.res,g.n,i,350);
  setTimeout(()=>flyToHand(g.corner,g.res,g.p,g.n),delay+1250);
}
function flyToHand(pos,res,p,n){
  if(reduceMotion()||!G) return;
  const v=new THREE.Vector3(pos.x,TOP+0.3,pos.z).project(camera), sx=(v.x+1)/2*innerWidth, sy=(1-v.y)/2*innerHeight;
  const tgt=p===viewer()?$(`#hand .card[data-r="${res}"]`):document.querySelectorAll('#players .prow')[p];
  if(!tgt||!tgt.offsetParent) return;
  const r=tgt.getBoundingClientRect(), tx=r.left+r.width/2, ty=r.top+r.height/2;
  for(let i=0;i<Math.min(n,3);i++){
    const el=document.createElement('div'); el.className='flychip'; el.style.background=RES[res].color; document.body.appendChild(el);
    const a=el.animate([{transform:`translate(${sx}px,${sy}px) scale(.6)`},{transform:`translate(${(sx+tx)/2}px,${Math.min(sy,ty)-80}px) scale(1.15)`,offset:.45},{transform:`translate(${tx}px,${ty}px) scale(.8)`}],{duration:750,delay:i*80,easing:'cubic-bezier(.45,0,.25,1)',fill:'both'});
    a.onfinish=()=>{el.remove();tgt.classList.remove('bump');void tgt.offsetWidth;tgt.classList.add('bump');};
  }
}
function flyRes(fromT,c,res,n,idx,extraDelay=0){
  if(reduceMotion()) return;
  const mat=flyMat(res);
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(G3.flyCube,mat); m.visible=false; world.add(m);
    const sx=fromT.x,sz=fromT.z,sy=fromT.top+0.1,ex=c.x,ez=c.z,ey=TOP+0.3;
    anim(900,k=>{m.visible=true;const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      m.position.set(sx+(ex-sx)*e,sy+(ey-sy)*e+Math.sin(Math.PI*e)*0.9,sz+(ez-sz)*e);m.rotation.set(k*6,k*4,0);m.scale.setScalar(k>0.85?Math.max(0.01,(1-k)/0.15):1);},
      ()=>world.remove(m),(idx+i)*110+extraDelay);
  }
}
const flyMats={};
function flyMat(r){return flyMats[r]||(flyMats[r]=new THREE.MeshStandardMaterial({color:RES[r].color,emissive:new THREE.Color(RES[r].color),emissiveIntensity:0.35,roughness:0.6}));}

const mq=window.matchMedia('(prefers-color-scheme: dark)');
function isDark(){const t=document.documentElement.dataset.theme;if(t==='dark')return true;if(t==='light')return false;return mq.matches;}
let curR=3;
// Day and night: one full day every 6 rounds (a slow cycle in the lobby). Purely a look for now.
const DN={on:true,t:0.18,sky:new THREE.Color(),sunI:1,hemiI:0.65,hemiC:new THREE.Color(),night:new THREE.Color(0x0d1324)};
const moon=new THREE.DirectionalLight(0x9fb4ff,0); scene.add(moon); scene.add(moon.target);
const stars=(()=>{const n=500,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,e=0.08+Math.random()*0.9,r=120;pos[i*3]=Math.cos(a)*Math.cos(e)*r;pos[i*3+1]=Math.sin(e)*r;pos[i*3+2]=Math.sin(a)*Math.cos(e)*r;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  return new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:0.9,transparent:true,opacity:0,depthWrite:false,fog:false}));})();
scene.add(stars);
const glowSprite=(inner,outer)=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,6,64,64,64);gr.addColorStop(0,inner);gr.addColorStop(0.25,inner);gr.addColorStop(1,outer);g.fillStyle=gr;g.fillRect(0,0,128,128);
  return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,fog:false}));};
const sunDisc=glowSprite('rgba(255,236,170,1)','rgba(255,200,90,0)'), moonDisc=glowSprite('rgba(235,240,255,1)','rgba(160,180,255,0)');
sunDisc.scale.set(14,14,1); moonDisc.scale.set(9,9,1); scene.add(sunDisc); scene.add(moonDisc);
const sstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function updateDayNight(now){
  let target;
  if(!DN.on) target=0.25;
  else if(!G||!$('#lobbyScr').hidden) target=(now/90000)%1;
  else target=((G.turnNo||0)/(G.np*6)+0.15)%1;
  let d=target-DN.t; if(d>0.5) d-=1; if(d<-0.5) d+=1; DN.t=(DN.t+d*0.02+1)%1;
  const ang=DN.t*Math.PI*2, el=Math.sin(ang), dayF=sstep(-0.12,0.22,el), dusk=1-Math.abs(el)*3;
  const R=60; sun.position.set(Math.cos(ang)*R*0.6,R*(0.6+0.35*Math.max(el,0)),14+Math.sin(ang)*6); moon.position.set(-Math.cos(ang)*R*0.6,R*(0.6+0.35*Math.max(-el,0)),-14);
  sun.intensity=DN.sunI*(0.3+0.7*dayF); sun.color.setHSL(0.1,0.85,Math.min(0.97,0.72+0.25*dayF+0.0*dusk));
  if(dusk>0&&dayF<0.95) sun.color.lerp(new THREE.Color(0xff8a4a),Math.max(0,dusk)*0.6);
  moon.intensity=0.65*(1-dayF);
  hemi.intensity=DN.hemiI*(0.85+0.15*dayF); hemi.color.copy(DN.hemiC).lerp(new THREE.Color(0x9aa8e0),(1-dayF)*0.8);
  if(dayF<1) sun.color.lerp(new THREE.Color(0xb8c6ff),(1-dayF)*0.7);
  const sky=DN.sky.clone().lerp(DN.night,(1-dayF)*0.6); if(dusk>0&&dayF>0.05) sky.lerp(new THREE.Color(0xd8875a),Math.max(0,dusk)*0.25);
  scene.background=sky; scene.fog.color.copy(sky);
  stars.material.opacity=Math.max(0,1-dayF*1.6)*0.9;
  const cp=camera.position, dir=(v,len)=>v.clone().normalize().multiplyScalar(len).add(cp);
  sunDisc.position.copy(dir(new THREE.Vector3(Math.cos(ang)*R,Math.max(el,-0.2)*R*0.8,14),90)); moonDisc.position.copy(dir(new THREE.Vector3(-Math.cos(ang)*R,Math.max(-el,-0.2)*R*0.8,-14),90));
  sunDisc.material.opacity=sstep(-0.05,0.1,el); moonDisc.material.opacity=sstep(-0.05,0.1,-el);
  MAT.win.emissiveIntensity=0.15+(1-dayF)*1.9;
  renderer.toneMappingExposure=1+(1-dayF)*0.25;
  DN.dayF=dayF;
}
function applySceneTheme(){
  const d=isDark(), sky=d?0x2a3247:0xc9d8dc;
  scene.background=new THREE.Color(sky); scene.fog.color.set(sky); scene.fog.near=16+curR*4; scene.fog.far=42+curR*9;
  sun.color.set(d?0xffb37c:0xfff3df); sun.intensity=d?0.8:1; sun.position.set(d?-14:-10,d?11:18,d?6:8);
  hemi.color.set(d?0x8a9bd0:0xdfeef5); hemi.groundColor.set(d?0x3a2f2a:0x6d6152); hemi.intensity=d?0.55:0.65;
  DN.sky.set(sky); DN.sunI=sun.intensity; DN.hemiI=hemi.intensity; DN.hemiC.copy(hemi.color);
  ground.material.color.set(d?0x323a4c:0xb2c3bd);
}
mq.addEventListener&&mq.addEventListener('change',applySceneTheme);
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  if(h<=520&&w>h) camera.setViewOffset(w,h,(244-76)/2,0,w,h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();}
function overviewPose(R){let d=5.5+R*3.4;const portrait=camera.aspect<1;if(portrait)d*=1.65;
  return {t:new THREE.Vector3(0,0.2,portrait?0.5:0.35),p:new THREE.Vector3(0,d*(portrait?1.02:0.8),d*(portrait?0.6:0.9)+(portrait?0.5:0.35))};}
function frameCamera(R){const o=overviewPose(R);camera.position.copy(o.p);controls.target.copy(o.t);controls.update();}
let userCam=0;
controls.addEventListener&&controls.addEventListener('start',()=>{userCam=performance.now();});
function camTo(t1,p1,ms=900){
  const t0=controls.target.clone(),p0=camera.position.clone();
  if(reduceMotion()){controls.target.copy(t1);camera.position.copy(p1);controls.update();return;}
  anim(ms,k=>{const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;controls.target.lerpVectors(t0,t1,e);camera.position.lerpVectors(p0,p1,e);});
}
function camGo(x,z,dist,ms){const dir=camera.position.clone().sub(controls.target).normalize(),t1=new THREE.Vector3(x,0.2,z);camTo(t1,t1.clone().add(dir.multiplyScalar(dist)),ms);}
function camOverview(){const o=overviewPose(curR);camTo(o.t,o.p);}
// Glide to something happening, then back to where you were, unless you move the camera yourself meanwhile
function focusAction(x,z){
  if(!uiPrefs.follow||!G||!$('#lobbyScr').hidden) return;
  const started=performance.now(); if(started-userCam<4000) return;
  const bt=controls.target.clone(),bp=camera.position.clone();
  camGo(x,z,8.5,800);
  setTimeout(()=>{if(userCam<started) camTo(bt,bp,900);},2900);
}
const smokeDummy=new THREE.Object3D();
function animate(){
  requestAnimationFrame(animate);
  {const t=performance.now(),dt=t-lastFrame;
   if(Q.fps<60&&dt<1000/Q.fps-2) return;
   // if the game keeps running slowly, suggest a lower setting once
   if(lastFrame&&dt>45&&dt<1000) slowFrames++; else if(slowFrames>0) slowFrames-=0.5;
   if(!slowWarned&&slowFrames>150&&uiPrefs.quality!=='low'){slowWarned=true;toast('The game is running slowly on this device. Try Graphics: Low or Medium in the Menu.');}
   lastFrame=t;}
  controls.update();
  const now=performance.now(), rm=reduceMotion();
  if(highlighted.length){
    if(now<hlUntil){const k=0.3+0.22*Math.sin(now/170);highlighted.forEach(t=>t.capMat.emissive.setRGB(k,k*0.85,k*0.45));}
    else{highlighted.forEach(t=>t.capMat.emissive.setRGB(0,0,0));highlighted=[];}
  }
  if(heroHL.length){const k=0.12+0.08*Math.sin(now/260);heroHL.forEach(t=>t.capMat.emissive.setRGB(k*0.5,k,k*0.4));}
  for(const p in heroMeshes){const g=heroMeshes[p];if(g.parent) animateHeroParts(g,now,+p*1.7,!!g.userData.walking,+p);}
  drawPreview(now);
  if(robberHL.length){const k=0.18+0.14*Math.sin(now/220);robberHL.forEach(t=>t.capMat.emissive.setRGB(k*0.4,k*0.4,k*0.9));}
  markerMats.forEach(m=>m.opacity=rm?0.6:0.45+0.25*Math.sin(now/260));
  swayU.uTime.value=rm?0:now/1000;
  updateDayNight(now);
  {const az=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z);for(const t of tokenMeshes) t.rotation.y=az;}
  {const dt=yakLast?Math.min(0.1,(now-yakLast)/1000):0;yakLast=now;updateYaks(now,dt);}
  if(!rm&&Q.fx&&G&&now>nextRipple){nextRipple=now+900+Math.random()*900;const lakes=G.B.tiles.filter(t=>t.terrain==='lake');
    if(lakes.length){const t=lakes[Math.floor(Math.random()*lakes.length)],a=Math.random()*Math.PI*2,r=Math.random()*0.5;rippleAt(t.x+Math.cos(a)*r,WATER+0.006,t.z+Math.sin(a)*r);}}
  if(!rm) for(const r of rods){r.rod.rotation.z=Math.sin(now/700+r.ph)*0.12;r.boat.position.y=WATER+Math.sin(now/900+r.ph)*0.008;}
  if(selRing&&selRing.visible){MAT.glow.opacity=rm?0.4:0.3+0.2*Math.sin(now/220);}
  for(const key in armyMeshes){const sel=((selEdge&&selEdge.key===key)||(hoverEdge&&hoverEdge.key===key))&&!battling;
    for(const g of armyMeshes[key]){const u=g.userData;if(!u.spear||u.busy) continue;
      if(sel){const ph=now/160+u.k;u.spear.position.y=0.07;u.tip.position.y=0.07;u.spear.rotation.z=u.tip.rotation.z=0;g.position.y=u.y0+(rm?0:Math.abs(Math.sin(ph))*0.025);}
      else if(u.spear.position.y){u.spear.position.y=0;u.tip.position.y=0;g.position.y=u.y0;}}}
  robberMesh&&robberMesh.visible&&(MAT.lantern.emissiveIntensity=rm?1.2:1.05+0.25*Math.sin(now/90)*Math.sin(now/37));
  if(rainIM){const t=now/1000;rainData.forEach((d,i)=>{const y=d.top+1.5-(((rm?0.5:t*2.4)+d.ph)%1.5);smokeDummy.position.set(d.x,y,d.z);smokeDummy.scale.set(1,1,1);smokeDummy.rotation.set(0,0,0.15);smokeDummy.updateMatrix();rainIM.setMatrixAt(i,smokeDummy.matrix);});rainIM.instanceMatrix.needsUpdate=true;}
  if(evFx) evFx.children.forEach(o=>{const u=o.userData;
    if(u.shaft) MAT.shaft.opacity=rm?0.16:0.12+0.07*Math.sin(now/500);
    if(u.calf&&!rm) o.position.y=u.calf.y+Math.abs(Math.sin(now/260+u.calf.ph))*0.03;
    if(u.jump){const j=u.jump,ph=((now/1000+j.ph)%2.2);if(rm||ph>0.7){o.visible=false;return;}const k=ph/0.7,dx=Math.cos(j.a),dz=Math.sin(j.a);
      o.visible=true;o.position.set(j.cx+dx*(k-0.5)*0.35,j.top+Math.sin(k*Math.PI)*0.28,j.cz+dz*(k-0.5)*0.35);o.rotation.set(0,-j.a,Math.cos(k*Math.PI)*0.9);}});
  if(!rm) riverTex.offset.y+=0.0035;
  if(G&&G.events.harvest){const k=0.12+0.08*Math.sin(now/300);G.events.harvest.forEach(key=>{const t=G.B.tileMap.get(key);if(t&&!highlighted.includes(t)) t.capMat.emissive.setRGB(k,k*0.8,0);});}
  if(smokeIM){
    const t=rm?2:now/1000, life=3.4; let i=0;
    for(const em of smokeEm) for(let j=0;j<em.n&&i<600;j++){
      const k=((t+em.ph+j*life/em.n)%life+life)%life/life;
      smokeDummy.position.set(em.x+Math.sin(t*0.9+em.ph+j)*0.025+k*0.14,em.y+k*0.6,em.z+k*0.05);
      const s=(0.45+k*1.7)*(k<0.12?k/0.12:1)*(k>0.7?(1-k)/0.3:1);
      smokeDummy.scale.setScalar(Math.max(0.001,s)); smokeDummy.updateMatrix(); smokeIM.setMatrixAt(i++,smokeDummy.matrix);
    }
    smokeIM.count=i; smokeIM.instanceMatrix.needsUpdate=true;
  }
  for(let i=anims.length-1;i>=0;i--){const a=anims[i];if(now<a.t0) continue;const k=Math.min(1,(now-a.t0)/a.dur);a.fn(k);if(k>=1){anims.splice(i,1);a.done&&a.done();}}
  renderer.render(scene,camera);
}

/* =====================================================================
   GAME INTERFACE (turns player input into engine actions)
   ===================================================================== */
let G=null, mode=null, modalKind=null, rolling=false;
const pname=p=>PLAYERS[p].label||PLAYERS[p].name;
// Hero names label each player; if two heroes share a name, the color is added to tell them apart.
function setLabels(heroes){
  heroes.forEach((h,i)=>{const dup=heroes.some((o,j)=>j!==i&&o.name===h.name);PLAYERS[i].label=dup?`${h.name} (${PLAYERS[i].name})`:h.name;});
}
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
function colorNames(txt){
  if(!G) return txt; let out=esc(txt);
  const order=G.players.map((_,i)=>i).sort((a,b)=>pname(b).length-pname(a).length);
  for(const i of order){const n=esc(pname(i)).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');out=out.replace(new RegExp('(^|[^A-Za-z\u00C0-\u024F])'+n+'(?![A-Za-z\u00C0-\u024F])','g'),(m,pre)=>pre+'\u0000'+i+'\u0000');}
  return out.replace(/\u0000(\d+)\u0000/g,(_,i)=>`<b class="pnm" style="--pc:${PLAYERS[+i].css}">${uiPrefs.cb?`<img src="${sigilURL(+i)}" alt="">`:''}${esc(pname(+i))}</b>`);
}
const EV_LOOK={calving:{c:'#9a6b45',i:'C'},fishrun:{c:'#3d7fa8',i:'R'},commission:{c:'#6b6f78',i:'E'},muster:{c:'#8a2f2f',i:'A'},wolf:{c:'#6f6a66',i:'W'},harvest:{c:'#c99a1e',i:'H'},merchant:{c:'#7a4fa3',i:'M'},bandits:{c:'#8a2f2f',i:'B'},storm:{c:'#3d6f93',i:'S'},flood:{c:'#6f7a52',i:'F'}};
let freshEv=new Set();
function evLeft(k){const e=G.events[k];if(!e) return '';
  if(k==='wolf'||k==='bandits'||k==='flood') return `${e.rolls} ${e.rolls===1?'roll':'rolls'} left`;
  if(k==='storm') return `${G.events.storm.rolls} ${G.events.storm.rolls===1?'roll':'rolls'} left`;
  if(k==='merchant') return `until ${pname(e.until)}’s turn`;
  if(k==='calving') return `${e.length} pastures to go`;
  if(k==='fishrun') return `${e.rolls} ${e.rolls===1?'roll':'rolls'} left`;
  if(k==='commission'||k==='muster') return `${e.players.length} waiting, ${e.rolls} rolls left`;
  if(k==='harvest') return `${e.length} fields to go`;
  return '';}
function renderEvChips(){
  $('#evchips').innerHTML=Object.keys(G.events).map(k=>`<div class="evchip${freshEv.has(k)?' fresh':''}" style="--evc:${EV_LOOK[k].c}" title="${EVENTS[k].desc}"><span class="ico" style="background:${EV_LOOK[k].c}">${svgI(k)}</span><b>${EVENTS[k].name}</b><span class="left">${evLeft(k)}</span></div>`).join('');
  freshEv.clear();
}
const annQ=[]; let annT=null;
function announce(o){annQ.push(o); if(!annT) nextAnn();}
function nextAnn(){
  const b=$('#evbanner'); clearTimeout(annT); annT=null;
  const o=annQ.shift(); if(!o){b.hidden=true;return;}
  b.style.setProperty('--evc',o.color);
  b.classList.toggle('big',!!o.big);
  b.innerHTML=`<span class="ico" style="background:${o.color}">${o.art?svgI(o.art):o.icon}</span><span class="kicker">${o.kicker}</span><h3>${o.title}</h3><p style="grid-column:2">${o.text||''}</p><span class="skip">${annQ.length?`Click for next (${annQ.length} more)`:'Click to close'}</span>`;
  b.hidden=false; b.classList.remove('anim'); void b.offsetWidth; b.classList.add('anim');
  annT=setTimeout(nextAnn,o.ms||5000);
}
$('#evbanner').addEventListener('click',nextAnn);
const FX_ART={
  wolf:`<svg viewBox="0 0 200 100" width="240" height="120"><path fill="#3b3734" d="M18 58 Q6 44 26 46 L42 50 Q66 34 112 40 L136 30 L141 16 L149 29 L162 27 L182 38 L172 47 L152 49 L142 58 L138 82 L129 82 L128 63 L97 65 L88 84 L79 84 L80 65 L56 63 L50 84 L41 84 L43 61 Q30 62 18 58 Z"/><circle cx="168" cy="36" r="2.4" fill="#ffd27a"/></svg>`,
  merchant:`<svg viewBox="0 0 240 120" width="260" height="130"><path fill="#7a4fa3" d="M60 40 Q120 0 180 40 Z"/><rect x="58" y="40" width="124" height="40" rx="4" fill="#8a6440"/><circle cx="85" cy="88" r="16" fill="#4a3628"/><circle cx="155" cy="88" r="16" fill="#4a3628"/><circle cx="85" cy="88" r="5" fill="#c8a25a"/><circle cx="155" cy="88" r="5" fill="#c8a25a"/><rect x="182" y="58" width="44" height="6" fill="#4a3628"/><circle cx="214" cy="42" r="8" fill="#d9ae86"/><path d="M206 50 L222 50 L226 92 L202 92 Z" fill="#5b3e7a"/></svg>`,
  calving:`<svg viewBox="0 0 160 100" width="170" height="106"><path fill="#6a4a34" d="M30 50 Q30 34 50 36 L104 36 Q122 36 124 48 L136 40 L142 44 L134 56 L130 70 L122 70 L120 60 L112 62 L110 86 L102 86 L100 64 L60 64 L58 86 L50 86 L48 62 Q36 60 30 50 Z"/><path fill="#e9e0cc" d="M128 40 L122 32 L126 32 Z M136 38 L140 30 L142 34 Z"/></svg>`,
  fishrun:`<svg viewBox="0 0 120 60" width="120" height="60"><path fill="#7fa6c0" d="M8 30 Q40 6 80 30 Q40 54 8 30 Z"/><path fill="#5d87a3" d="M78 30 L112 12 L112 48 Z"/><circle cx="24" cy="27" r="3" fill="#fff"/></svg>`,
  commission:`<svg viewBox="0 0 220 120" width="230" height="125"><rect x="30" y="20" width="160" height="80" rx="6" fill="#efe3c4" stroke="#b89a5e" stroke-width="4"/><rect x="18" y="14" width="18" height="92" rx="9" fill="#c9b48a"/><rect x="184" y="14" width="18" height="92" rx="9" fill="#c9b48a"/><g stroke="#8a7a5a" stroke-width="4"><line x1="56" y1="44" x2="164" y2="44"/><line x1="56" y1="60" x2="150" y2="60"/><line x1="56" y1="76" x2="130" y2="76"/></g><circle cx="160" cy="84" r="14" fill="#b0412e"/></svg>`,
  muster:`<svg viewBox="0 0 320 120" width="320" height="120"><g fill="#3a2a2a">${[0,1,2,3].map(i=>`<g transform="translate(${20+i*72},0)"><circle cx="20" cy="40" r="10"/><path d="M8 118 L12 54 Q20 48 28 54 L32 118 Z"/><rect x="34" y="10" width="4" height="108"/><path d="M36 4 L42 16 L30 16 Z"/></g>`).join('')}</g></svg>`,
  bandits:`<svg viewBox="0 0 300 120" width="300" height="120"><g fill="#3b1f1f"><path d="M20 118 L34 50 Q44 18 56 50 L70 118 Z"/><path d="M110 118 L124 44 Q136 10 148 44 L162 118 Z"/><path d="M200 118 L214 52 Q224 22 236 52 L250 118 Z"/></g><g fill="#111"><rect x="36" y="44" width="20" height="6"/><rect x="126" y="38" width="22" height="6"/><rect x="216" y="46" width="20" height="6"/></g></svg>`,
};
function screenFx(k){
  if(reduceMotion()) return;
  const fx=$('#fx'); let el=document.createElement('div'), dur=1700;
  if(k==='wolf'||k==='merchant'||k==='bandits'){
    el.style.cssText=`bottom:${k==='merchant'?14:22}%;left:0;animation:${k==='bandits'?'runBack':'runAcross'} ${k==='merchant'?2.4:1.5}s linear forwards`;
    el.innerHTML=`<div style="animation:hop ${k==='merchant'?0.5:0.28}s ease-in-out infinite">${FX_ART[k]}</div>`; dur=k==='merchant'?2500:1600;
  } else if(k==='storm'){
    el.style.cssText='inset:0;background:linear-gradient(rgba(40,60,80,.35),rgba(40,60,80,.2)),repeating-linear-gradient(105deg,rgba(220,235,250,.45) 0 2px,transparent 2px 14px);background-size:auto,60px 240px;animation:fadeInOut 1.8s ease-out forwards,rainFall .4s linear infinite';dur=1800;
  } else if(k==='calving'||k==='muster'||k==='commission'){
    const anim=k==='commission'?'runAcross 2.2s ease-in-out forwards':`${k==='muster'?'runBack':'runAcross'} ${k==='muster'?2.2:1.8}s linear forwards`;
    el.style.cssText=`bottom:${k==='commission'?40:18}%;left:0;animation:${anim}`;
    el.innerHTML=`<div style="animation:hop ${k==='muster'?0.4:0.3}s ease-in-out infinite">${FX_ART[k]}</div>`; dur=2300;
  } else if(k==='fishrun'){
    el.style.cssText='left:0;right:0;bottom:8%;height:40vh';
    el.innerHTML=[0,1,2,3,4].map(i=>`<div style="position:absolute;left:${8+i*19}%;bottom:0;animation:leap 1.1s ease-in-out ${i*0.18}s both">${FX_ART.fishrun}</div>`).join(''); dur=2200;
  } else if(k==='harvest'){
    el.style.cssText='top:0;bottom:0;width:45vw;background:linear-gradient(90deg,transparent,rgba(255,214,110,.45),transparent);animation:sweep 1.6s ease-in-out forwards';
  } else if(k==='flood'){
    el.style.cssText='left:0;right:0;bottom:0;height:30vh;animation:rise 1.8s ease-in-out forwards';
    el.innerHTML='<svg viewBox="0 0 400 100" preserveAspectRatio="none" width="100%" height="100%"><path d="M0 30 Q50 10 100 30 T200 30 T300 30 T400 30 V100 H0 Z" fill="rgba(110,140,120,.55)"/><path d="M0 45 Q50 28 100 45 T200 45 T300 45 T400 45 V100 H0 Z" fill="rgba(80,115,130,.55)"/></svg>';dur=1800;
  } else return;
  fx.appendChild(el); setTimeout(()=>el.remove(),dur+100);
}
const EV_HERO={harvest:['Helps','farmer'],calving:['Helps','herder'],fishrun:['Helps','angler'],commission:['Helps','engineer'],muster:['Helps','warlord'],merchant:['Helps','merchant'],
  wolf:['Countered by','herder'],bandits:['Countered by','warlord'],storm:['Countered by','angler'],flood:['Countered by','engineer']};
const evIntro={}, evEnded=[];
const wideScreen=()=>window.innerWidth>760;
function renderEvCards(){
  const box=$('#evcards'); if(!box||!G) return;
  const now=performance.now(); for(let i=evEnded.length-1;i>=0;i--) if(evEnded[i].until<now) evEnded.splice(i,1);
  const card=(k,ended)=>{const L=EV_LOOK[k],hl=EV_HERO[k];
    return `<div class="evc${!ended&&evIntro[k]>now?' intro':''}${ended?' ended':''}" style="--evc:${L.c}" title="${EVENTS[k].desc}"><div class="art">${svgI(k)}</div><div class="kind">${ended?'EVENT OVER':'EVENT'}</div><h4>${EVENTS[k].name}</h4>
      <p>${EVENTS[k].desc}</p>${!ended&&evLeft(k)?`<span class="left">${evLeft(k)}</span>`:''}${hl?`<span class="hl">${hl[0]} ${ABILITIES[hl[1]].name}s</span>`:''}</div>`;};
  box.innerHTML=Object.keys(G.events).map(k=>card(k,false)).join('')+evEnded.filter(e=>!G.events[e.k]).map(e=>card(e.k,true)).join('');
}
function eventBanner(k,ended,extra){
  const L=EV_LOOK[k];
  if(!ended) screenFx(k);
  if(!ended&&G&&G.events[k]&&G.events[k].tile){const t=G.B.tileMap.get(G.events[k].tile);if(t) setTimeout(()=>focusAction(t.x,t.z),400);}
  Snd.play(ended?'evend':'ev_'+k);
  if(wideScreen()){
    if(ended){evEnded.push({k,until:performance.now()+3200});setTimeout(renderEvCards,3300);if(extra) toast(extra);}
    else evIntro[k]=performance.now()+2600;
    renderEvCards(); return;
  }
  announce({icon:L.i,art:k,color:L.c,kicker:ended?'Event over':'New event',title:ended?EV_END_TITLE[k]:EVENTS[k].name,text:ended?(extra||''):EVENTS[k].desc+(extra?' '+extra:''),ms:ended?3500:6500});
}
const GOOD='#2f7d4f', BAD='#b0412e';
const ICON={
  timber:'<path d="M4 14.4h12a3.3 3.3 0 0 1 0 6.6H4a3.3 3.3 0 0 1 0-6.6z"/><path d="M8 7.3h12a3.3 3.3 0 0 1 0 6.6H8a3.3 3.3 0 0 1 0-6.6z" fill-opacity=".85"/><path d="M4.5 16.2h8.5M8.6 9.1h8" stroke="#000" stroke-opacity=".28" stroke-width=".9" stroke-linecap="round"/><path d="M3.5 19.6h9" stroke="#fff" stroke-opacity=".25" stroke-width=".8" stroke-linecap="round"/><circle cx="16" cy="17.7" r="2.5" fill="#f3d9a8"/><circle cx="16" cy="17.7" r="1.5" fill="none" stroke="#8a5f35" stroke-width=".6"/><circle cx="16" cy="17.7" r=".5" fill="#8a5f35"/><circle cx="20" cy="10.6" r="2.5" fill="#f3d9a8"/><circle cx="20" cy="10.6" r="1.5" fill="none" stroke="#8a5f35" stroke-width=".6"/><circle cx="20" cy="10.6" r=".5" fill="#8a5f35"/>',
  clay:'<rect x="2" y="14.8" width="9.4" height="5.8" rx="1.3"/><rect x="12.6" y="14.8" width="9.4" height="5.8" rx="1.3"/><rect x="7.3" y="8.4" width="9.4" height="5.8" rx="1.3" fill-opacity=".88"/><path d="M5.8 3.6 Q12 1.6 18.2 3.6 Q19 6.6 12 7.2 Q5 6.6 5.8 3.6Z" fill-opacity=".7"/><g fill="#fff" fill-opacity=".38"><rect x="2.8" y="15.5" width="7.8" height="1.3" rx=".65"/><rect x="13.4" y="15.5" width="7.8" height="1.3" rx=".65"/><rect x="8.1" y="9.1" width="7.8" height="1.3" rx=".65"/><ellipse cx="10" cy="3.7" rx="2.6" ry=".7"/></g><g fill="#000" fill-opacity=".22"><rect x="2.8" y="19" width="7.8" height=".9" rx=".45"/><rect x="13.4" y="19" width="7.8" height=".9" rx=".45"/><rect x="8.1" y="12.6" width="7.8" height=".9" rx=".45"/></g>',
  leather:'<path d="M5 3.5 Q8.5 5.6 12 4.6 Q15.5 5.6 19 3.5 Q18 7.6 20.5 11 Q18 14.6 19 20.5 Q15.5 18.6 12 20.2 Q8.5 18.6 5 20.5 Q6 14.6 3.5 11 Q6 7.6 5 3.5Z"/><path d="M7.4 6.9 Q9.6 7.9 12 7.3 Q14.4 7.9 16.6 6.9 Q16 9.4 17.6 11.4 Q16 14 16.6 17.2 Q14.4 16.3 12 17.2 Q9.6 16.3 7.4 17.2 Q8 14 6.4 11.4 Q8 9.4 7.4 6.9Z" fill="none" stroke="#f3d9a8" stroke-opacity=".85" stroke-width=".9" stroke-dasharray="1.3 1.1"/><ellipse cx="9.6" cy="9.4" rx="2.8" ry="1.4" fill="#fff" fill-opacity=".2"/><ellipse cx="14.5" cy="15" rx="3" ry="1.5" fill="#000" fill-opacity=".15"/>',
  wheat:'<g stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M12 22V9.5"/><path d="M12 22 Q10.6 15.5 7.6 10"/><path d="M12 22 Q13.4 15.5 16.4 10"/></g><ellipse cx="12" cy="4.2" rx="1.5" ry="2.4"/><ellipse cx="10.5" cy="7" rx="1.3" ry="2.1" transform="rotate(-25 10.5 7)"/><ellipse cx="13.5" cy="7" rx="1.3" ry="2.1" transform="rotate(25 13.5 7)"/><ellipse cx="6.8" cy="6.4" rx="1.3" ry="2.2" transform="rotate(-35 6.8 6.4)"/><ellipse cx="6.6" cy="9.4" rx="1.2" ry="2" transform="rotate(-55 6.6 9.4)"/><ellipse cx="17.2" cy="6.4" rx="1.3" ry="2.2" transform="rotate(35 17.2 6.4)"/><ellipse cx="17.4" cy="9.4" rx="1.2" ry="2" transform="rotate(55 17.4 9.4)"/><g fill="#fff" fill-opacity=".45"><ellipse cx="11.6" cy="3.6" rx=".5" ry="1"/><ellipse cx="6.4" cy="5.9" rx=".45" ry=".9" transform="rotate(-35 6.4 5.9)"/><ellipse cx="16.8" cy="5.9" rx=".45" ry=".9" transform="rotate(35 16.8 5.9)"/></g><rect x="9.3" y="15.2" width="5.4" height="2" rx=".8" fill="#8a5f35"/>',
  iron:'<path d="M8.6 8.2 L10.6 3.8 H17.2 L19.2 8.2 Z" fill-opacity=".7"/><path d="M2.5 18.8 L6.6 9.6 H17.4 L21.5 18.8 Z"/><path d="M6.6 9.6 H17.4 L15.9 12.8 H8.1 Z" fill="#fff" fill-opacity=".38"/><path d="M2.5 18.8 L8.1 12.8 H15.9 L21.5 18.8 Z" fill="#000" fill-opacity=".14"/><path d="M8.1 12.8 L2.5 18.8 M15.9 12.8 L21.5 18.8" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/><path d="M10.6 3.8 H17.2 L16.6 5.2 H11.2 Z" fill="#fff" fill-opacity=".35"/>',
  fish:'<path d="M2 12 Q8.5 4.2 15.6 12 Q8.5 19.8 2 12 Z"/><path d="M15 12 L22 6.4 Q20.4 12 22 17.6 Z" fill-opacity=".85"/><path d="M9.6 5.9 L12.6 3.4 L13.6 7.7 Z" fill-opacity=".8"/><path d="M8.2 7.6 Q9.8 9.8 9.5 12.2" stroke="#000" stroke-opacity=".3" stroke-width=".9" fill="none"/><path d="M11 9.6 q1.1 1.6 0 3.4 M13 9.6 q1.1 2 0 4.2" stroke="#fff" stroke-opacity=".35" stroke-width=".8" fill="none"/><path d="M3.6 12.8 Q8.4 15.8 14 13.2" stroke="#fff" stroke-opacity=".3" stroke-width=".8" fill="none"/><circle cx="5.6" cy="10.8" r="1.3" fill="#fff"/><circle cx="5.8" cy="10.8" r=".6" fill="#1a1a1a"/>',
  vp:'<path d="M3 18 L4 7 L9 12 L12 5 L15 12 L20 7 L21 18 Z"/><rect x="3" y="19" width="18" height="2.5" rx="1"/>',
  roads:'<path d="M8 22 L10.5 2 H13.5 L16 22 Z"/><rect x="11.4" y="5" width="1.2" height="3" fill="#fff"/><rect x="11.4" y="11" width="1.2" height="3" fill="#fff"/><rect x="11.4" y="17" width="1.2" height="3" fill="#fff"/>',
  plenty:'<path d="M4 11 H20 L18 21 H6 Z"/><path d="M7 11 Q12 2 17 11" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="9" r="2.2"/><circle cx="14" cy="8.5" r="2.4"/>',
  scout:'<path d="M2 12 Q12 3 22 12 Q12 21 2 12 Z"/><circle cx="12" cy="12" r="3.6" fill="#fff"/><circle cx="12" cy="12" r="1.8"/>',
  march:'<path d="M7 3 H13 V13 L20 15 Q22 16 21 19 H5 Z"/><rect x="5" y="20" width="16" height="1.8" rx=".9"/>',
  reinf:'<path d="M12 2 L20 5 V11 Q20 18 12 22 Q4 18 4 11 V5 Z"/><rect x="11" y="7" width="2" height="9" fill="#fff"/><rect x="7.5" y="10.5" width="9" height="2" fill="#fff"/>',
  rally:'<rect x="5" y="2" width="1.8" height="20"/><path d="M7 3 H19 L16 7.5 L19 12 H7 Z"/>',
  catch:'<path d="M2 14 Q8 8 14 14 Q8 20 2 14 Z"/><path d="M13 14 L18 10 V18 Z"/><path d="M18 2 V7 Q18 10 15 10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  switch:'<path d="M4 10 A8 8 0 0 1 18 6 L20 4 V10 H14 L16 8 A5.5 5.5 0 0 0 6.6 10.5 Z"/><path d="M20 14 A8 8 0 0 1 6 18 L4 20 V14 H10 L8 16 A5.5 5.5 0 0 0 17.4 13.5 Z"/>',
  wolf:'<path d="M4 3 L9 8 H15 L20 3 L19 12 L15 19 H9 L5 12 Z"/><circle cx="9.5" cy="11" r="1.2" fill="#fff"/><circle cx="14.5" cy="11" r="1.2" fill="#fff"/>',
  merchant:'<path d="M3 8 Q11 2 19 8 V15 H3 Z"/><circle cx="7" cy="18" r="2.6"/><circle cx="15" cy="18" r="2.6"/><rect x="19" y="11" width="3" height="1.6"/>',
  bandits:'<path d="M2 9 Q12 5 22 9 Q21 15 16 15 Q13 15 12 12 Q11 15 8 15 Q3 15 2 9 Z"/><ellipse cx="7.5" cy="10.5" rx="2" ry="1.4" fill="#fff"/><ellipse cx="16.5" cy="10.5" rx="2" ry="1.4" fill="#fff"/>',
  storm:'<path d="M6 13 A4 4 0 0 1 7 5.2 A5 5 0 0 1 16.5 6 A3.5 3.5 0 0 1 18 13 Z"/><rect x="7" y="15" width="1.6" height="5" transform="rotate(15 8 17)"/><rect x="11.5" y="15" width="1.6" height="5" transform="rotate(15 12 17)"/><rect x="16" y="15" width="1.6" height="5" transform="rotate(15 16.5 17)"/>',
  flood:'<path d="M2 9 Q5 6 8 9 T14 9 T20 9 T23 9 V12 Q20 15 17 12 T11 12 T5 12 T2 12 Z"/><path d="M2 16 Q5 13 8 16 T14 16 T20 16 T23 16 V19 Q20 22 17 19 T11 19 T5 19 T2 19 Z"/>',
  swords:'<path d="M3 2 L14 13 L12.5 14.5 L1.5 3.5 Z"/><path d="M21 2 L10 13 L11.5 14.5 L22.5 3.5 Z"/><rect x="2.5" y="16" width="8" height="2.2" transform="rotate(-45 6.5 17)"/><rect x="13.5" y="16" width="8" height="2.2" transform="rotate(45 17.5 17)"/>',
  turn:'<path d="M6 2 H18 V6 L13.5 12 L18 18 V22 H6 V18 L10.5 12 L6 6 Z"/>',
  hero:'<circle cx="12" cy="6.5" r="4"/><path d="M4 22 Q4 12.5 12 12.5 Q20 12.5 20 22 Z"/>',
  dev:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7 L13.5 11 L17.5 11 L14.3 13.4 L15.5 17.4 L12 15 L8.5 17.4 L9.7 13.4 L6.5 11 L10.5 11 Z" fill="#fff"/>',
};
ICON.harvest=ICON.wheat; ICON.calving=ICON.leather; ICON.fishrun=ICON.fish; ICON.commission=ICON.roads; ICON.muster=ICON.reinf;
const svgI=(k,c='#fff')=>`<svg viewBox="0 0 24 24" fill="${c}" style="color:${c}" aria-hidden="true">${ICON[k]||''}</svg>`;
const darker=hex=>{const c=new THREE.Color(hex);c.multiplyScalar(0.62);return '#'+c.getHexString();};
function watchMilestones(){
  if(!G) return;
  const w=watchMilestones, lr=G.longest.holder, la=G.armyHolder;
  if(w.g===G){
    if(lr!==w.lr||la!==w.la) Snd.play('fanfare');
    if(lr!==w.lr){if(lr!==null) react(lr,'cheer');if(w.lr!==null&&w.lr!==undefined) react(w.lr,'sad');}
    if(la!==w.la){if(la!==null) react(la,'cheer');if(w.la!==null&&w.la!==undefined) react(w.la,'sad');}
    if(lr!==w.lr) announce(lr!==null?{icon:'LR',art:'roads',color:PLAYERS[lr].css,kicker:'Longest Road',title:`${pname(lr)} takes Longest Road`,text:`${G.longest.len[lr]} roads in a row. Worth 2 points.${w.lr!==null&&w.lr!==undefined?` ${pname(w.lr)} loses it.`:''}`}
      :{icon:'LR',art:'roads',color:'#6b6f78',kicker:'Longest Road',title:'Longest Road is up for grabs',text:`${pname(w.lr)}’s road was cut. Nobody holds it now.`});
    if(la!==w.la) announce(la!==null?{icon:'LA',art:'swords',color:PLAYERS[la].css,kicker:'Largest Army',title:`${pname(la)} takes Largest Army`,text:`${Engine.count(G,la,'army')} armies on the board. Worth 2 points.${w.la!==null&&w.la!==undefined?` ${pname(w.la)} loses it.`:''}`}
      :{icon:'LA',art:'swords',color:'#6b6f78',kicker:'Largest Army',title:'Largest Army is up for grabs',text:`${pname(w.la)} has fewer than 3 armies now.`});
  }
  const sg=new Map(Engine.sieges(G).map(x=>[x.c.key,x]));
  if(w.g===G&&w.sg){
    for(const [k,x] of sg) if(!w.sg.has(k)){const o=x.c.building.p;Snd.play('siege');focusAction(x.c.x,x.c.z);react(o,'angry');react(x.by,'cheer');
      announce({icon:'S',art:'swords',color:PLAYERS[x.by].css,kicker:'Siege',title:`${pname(x.by)} besieges ${pname(o)}’s ${x.c.building.type}`,text:`It produces nothing while ${pname(x.by)}’s army stands on its roads. ${pname(o)} can break the siege by attacking. (A village needs 1 army to besiege, a city 2.)`,big:true});}
    for(const [k,x] of w.sg) if(!sg.has(k)){const c=G.B.corners.get(k);if(!c.building) continue;Snd.play('evend');
      announce({icon:'S',art:'swords',color:GOOD,kicker:'Siege lifted',title:`${pname(c.building.p)}’s ${c.building.type} is free`,text:'It produces again.',ms:3500});}
  }
  w.sg=sg;
  w.g=G; w.lr=lr; w.la=la;
}
const EV_END_TITLE={calving:'Calving season is over',fishrun:'The fish run is over',commission:'The royal commission is over',muster:'The call to arms is over',wolf:'The wolf has left the pasture',bandits:'The bandits have moved on',storm:'The storm has passed',flood:'The flood has drained away',merchant:'The merchant has moved on',harvest:'The harvest is in'};
const EV_END={calving:'Every pasture has paid out.',fishrun:'Fishing is back to normal.',commission:'No free roads or bridges are left to claim.',muster:'No free armies are left to claim.',wolf:'The wolf has gone back into the forest. The pasture produces again.',bandits:'The bandits have moved on. The tile produces again.',storm:'The lakes are calm. Fishing is back.',flood:'The water has drained. Armies can cross bridges again.',merchant:'The travelling merchant has moved on. Bank trades are back to normal.',harvest:'Every field has paid out its double harvest.'};
const dot=r=>`<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${RES[r].color};margin:0 2px 0 4px"></i>`;
const costDots=c=>Object.entries(c).map(([r,n])=>Array.from({length:n},()=>`<span class="mc" style="background:${RES[r].color}" title="${RES[r].name}">${svgI(r)}</span>`).join('')).join('');
function toast(s,kind){
  const isErr=kind==='err'||/^(Too close|Roads must|Click one|You need|You have no|You don’t|That would|A road holds|Only one|Armies can|Heroes can|You can’t|Roll first|Roll the dice|Choose|This army|These armies|Cards bought|New villages|An army costs|A village costs|A city costs|A road costs|A bridge costs|A fisherman costs|Play .* after|There’s nowhere|Buildings need|Villages need|Armies are raised|The flood|The bank)/.test(s);
  toastFx(s,isErr);
  if(G&&!isBot(G.cur)&&/^(Too close|Roads must|Click one|You need|That would|A road holds|Only one|Armies can|Heroes can|You can’t|Roll|Choose|This army|Cards bought|New villages|An army costs|A village costs|A city costs)/.test(s)) react(G.cur,'no');
  if(/^(Too close|Roads must|Click one|You need|That would|A road holds|Only one|Armies can|Heroes can)/.test(s)) Snd.play('error');}
function toastFx(s,isErr){
  const el=$('#toast'); el.classList.toggle('err',isErr); el.innerHTML=isErr?`<span class="ti">!</span>${colorNames(s)}`:colorNames(s); el.classList.remove('shake'); void el.offsetWidth;
  el.classList.add('show'); if(isErr&&!reduceMotion()) el.classList.add('shake');
  if(isErr){Snd.play('error');try{navigator.vibrate&&navigator.vibrate(70);}catch(e){}
    if(!reduceMotion()){const f=$('#errflash');f.classList.remove('on');void f.offsetWidth;f.classList.add('on');}}
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show','shake'),isErr?3800:2600);
}

const FACES={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const DIE_ROT={1:[0,0],6:[0,180],3:[0,-90],4:[0,90],2:[-90,0],5:[90,0]};
function drawDie(el,n,spin){
  if(!el.querySelector('.cube')) el.innerHTML='<div class="cube">'+[1,2,3,4,5,6].map(f=>`<div class="face f${f}">${Array.from({length:9},(_,i)=>`<span class="${FACES[f].includes(i)?'on':''}"></span>`).join('')}</div>`).join('')+'</div>';
  el.classList.toggle('blank',!n);
  el.spinX=(el.spinX||0)+(spin?720+360*Math.floor(Math.random()*2):0); el.spinY=(el.spinY||0)+(spin?720+360*Math.floor(Math.random()*2):0);
  const [rx,ry]=DIE_ROT[n||1]; el.querySelector('.cube').style.transform=`rotateX(${rx+el.spinX}deg) rotateY(${ry+el.spinY}deg)`;
}

const HERO_NAMES=['Aldric','Brenna','Corwin','Dagny','Edric','Fenna','Gareth','Hilde','Ivo','Jora','Kestrel','Lio','Maren','Nils','Orla','Pell','Runa','Soren','Tamsin','Ulf','Vera','Wren'];
const SKINS=['#f1d1b5','#d9ae86','#b07d56','#7a4f33'], HAIRS=['#2b211b','#6b4423','#c8a25a','#a8442a','#d9d4cc'], SIGILS=['shield','star','tree','crown','wave','sun'];
const pickR=a=>a[Math.floor(Math.random()*a.length)];
function loadSeats(){try{const s=JSON.parse(localStorage.getItem('hexworld.seats')||'null');if(Array.isArray(s)) return s.map(x=>x&&PALETTE.some(c=>c.name===x.color)?x:Object.assign({},x,{color:undefined}));}catch(e){}return [];}
function saveSeats(seats){try{localStorage.setItem('hexworld.seats',JSON.stringify(seats));}catch(e){}}
function randomHero(){return {name:pickR(HERO_NAMES),ability:pickR(Object.keys(ABILITIES)),look:{skin:pickR(SKINS),hair:pickR(HAIRS),sigil:pickR(SIGILS),hairStyle:pickR(['short','short','long','bun','braids','bald']),headwear:pickR(['none','none','hood','hat']),cape:Math.random()<0.4}};}
let lobby=null;
function startGame(){showLobby('play');}
function startGameOld(){
  const np=+$('#np').value, saved=loadSeats();
  const def=['Red','Blue','White','Orange'];
  lobby=Array.from({length:np},(_,i)=>{const sv=saved[i]||{};const h=sv.hero||randomHero();return {bot:sv.bot!==undefined?!!sv.bot:i>0,color:sv.color||def[i],hero:{name:h.name||pickR(HERO_NAMES),ability:ABILITIES[h.ability]?h.ability:'farmer',look:Object.assign({skin:SKINS[1],hair:HAIRS[0],sigil:'shield'},h.look||{})}};});
  // a favorite color that clashes goes to the earlier seat; the later seat gets a random free color
  lobby.forEach((s,i)=>{if(lobby.slice(0,i).some(o=>o.color===s.color)){const free=PALETTE.map(c=>c.name).filter(n=>!lobby.some(o=>o.color===n));s.color=pickR(free);s.bumped=true;}});
  openLobby();
}
function openLobby(){
  const seatHtml=(s,i)=>{const col=PALETTE.find(c=>c.name===s.color), h=s.hero, a=ABILITIES[h.ability];
    return `<div class="seat" style="--sc:${col.css}"><h4><span>Player ${i+1}: ${s.color}</span><button class="btn" data-rand="${i}" style="padding:2px 9px;font-size:.8rem">Random hero</button></h4>
      <div class="tabs" role="group" aria-label="Who plays this seat" style="margin-bottom:8px"><button data-who="${i}|h" aria-pressed="${!s.bot}">Human</button><button data-who="${i}|b" aria-pressed="${!!s.bot}">Bot</button></div>
      ${s.bumped?'<p class="adesc" style="min-height:0">That color was taken, so you got a random one.</p>':''}
      <div class="swrow" role="group" aria-label="Color">${PALETTE.map(c=>`<button class="swb" data-col="${i}|${c.name}" aria-pressed="${c.name===s.color}" title="${c.name}" style="background:${c.css}"></button>`).join('')}</div>
      <div class="row" style="grid-template-columns:62px 1fr;margin:4px 0"><label for="hn${i}">Hero</label><input id="hn${i}" type="text" maxlength="16" value="${h.name.replace(/"/g,'')}" data-name="${i}"></div>
      <div class="abil" role="group" aria-label="Ability">${Object.entries(ABILITIES).map(([k,x])=>`<button data-ab="${i}|${k}" aria-pressed="${k===h.ability}"><span class="lt" style="background:${x.color}">${x.letter}</span>${x.name}</button>`).join('')}</div>
      <p class="adesc">${a.desc}</p>
      <div class="mini"><span class="ml">Skin</span>${SKINS.map(c=>`<button data-skin="${i}|${c}" aria-pressed="${c===h.look.skin}" style="background:${c}" title="Skin tone"></button>`).join('')}</div>
      <div class="mini"><span class="ml">Hair</span>${HAIRS.map(c=>`<button data-hair="${i}|${c}" aria-pressed="${c===h.look.hair}" style="background:${c}" title="Hair color"></button>`).join('')}</div>
      <div class="mini"><span class="ml">Banner</span>${SIGILS.map(g=>`<button class="sig" data-sig="${i}|${g}" aria-pressed="${g===h.look.sigil}" title="${g}"><canvas width="52" height="52" data-sigc="${g}|${col.css}"></canvas></button>`).join('')}</div></div>`;};
  openModal('lobby',`<h3>Choose colors and heroes</h3><p>Each player picks a color and creates a hero. If you pick a color someone else has, they get a random free one. Your choices are remembered for next time.</p>
    <div class="seats">${lobby.map(seatHtml).join('')}</div><div class="mact"><button class="primary" id="lgo">Roll for who goes first</button></div>`,()=>{
    $('#mbox').classList.add('wide');
    $('#mbox').querySelectorAll('canvas[data-sigc]').forEach(cv=>{const [g,css]=cv.dataset.sigc.split('|');const x=cv.getContext('2d');x.fillStyle=css;x.fillRect(0,0,52,52);drawSigil(x,g,26,26,16,css==='#f6f4ee'?'#46505e':'#fff');});
    const Q=(sel,fn)=>$('#mbox').querySelectorAll(sel).forEach(b=>b.addEventListener('click',()=>{fn(b);openLobby();}));
    Q('[data-col]',b=>{const [i,c]=b.dataset.col.split('|');const me=lobby[+i];const other=lobby.find(o=>o!==me&&o.color===c);me.color=c;me.bumped=false;
      if(other){const free=PALETTE.map(x=>x.name).filter(n=>!lobby.some(o=>o.color===n));other.color=pickR(free);other.bumped=true;}});
    Q('[data-ab]',b=>{const [i,k]=b.dataset.ab.split('|');lobby[+i].hero.ability=k;});
    Q('[data-skin]',b=>{const [i,c]=b.dataset.skin.split('|');lobby[+i].hero.look.skin=c;});
    Q('[data-hair]',b=>{const [i,c]=b.dataset.hair.split('|');lobby[+i].hero.look.hair=c;});
    Q('[data-sig]',b=>{const [i,g]=b.dataset.sig.split('|');lobby[+i].hero.look.sigil=g;});
    Q('[data-rand]',b=>{const i=+b.dataset.rand;lobby[i].hero=randomHero();});
    Q('[data-who]',b=>{const [i,w]=b.dataset.who.split('|');lobby[+i].bot=w==='b';});
    $('#mbox').querySelectorAll('[data-name]').forEach(inp=>inp.addEventListener('input',()=>{lobby[+inp.dataset.name].hero.name=inp.value.trim()||'Hero';}));
    $('#lgo').addEventListener('click',()=>{$('#mbox').classList.remove('wide');saveSeats(lobby.map(s=>({color:s.color,hero:s.hero,bot:s.bot})));beginGame();});
  });
}
function beginGame(){
  const seed=$('#seed').value.trim()||randomSeed(); $('#seed').value=seed;
  if(lobby&&lobby[0]&&lobby[0].type){
    try{localStorage.setItem('hexworld.seats2',JSON.stringify(lobby.map(s=>({type:s.type,color:s.color,hero:s.hero,ai:s.ai}))));}catch(e){}
    // empty online seats become bots
    lobby.forEach((s,i)=>{if(s.type==='online'&&!(NET.mode==='host'&&NET.conns.some(g=>g.seat===i))){s.type='bot';s.ai='';}});
    lobby=lobby.map(s=>({ai:s.type==='bot'&&s.ai?s.ai:null,color:s.color,bot:s.type==='bot',you:s.type==='you',hero:JSON.parse(JSON.stringify(s.type==='you'?profile.hero:s.hero))}));
  }
  hideLobby();
  const R=+$('#size').value, np=lobby.length;
  lobby.forEach((s,i)=>{PLAYERS[i]=Object.assign({},PALETTE.find(c=>c.name===s.color));});
  setLabels(lobby.map(s=>s.hero));
  const B=Board.generate(seed,R,$('#balanced').checked,$('#mapStyle').value);
  G=Engine.newGame(B,np,seed,lobby.map(s=>s.hero),{diceDeck:$('#dicedeck').checked,nightRules:$('#nightRules').checked,friendly:$('#friendly').checked,timer:$('#timerOn').checked?+$('#timerSec').value:0,bots:lobby.map(s=>s.bot),ai:lobby.map(s=>s.ai||null)}); curR=R; mode=null; selEdge=null; modalKind=null; $('#modal').hidden=true;
  G.you=lobby.findIndex(s=>s.you);
  startRecordingAndShare=true;
  startRecording({ruleset:RULESET,seed,R,style:$('#mapStyle').value,balanced:$('#balanced').checked,np,heroes:lobby.map(s=>s.hero),opts:JSON.parse(JSON.stringify(G.opts)),colors:lobby.map(s=>s.color)});
  buildScene(B); renderPieces(G); frameCamera(R);
  if(NET.mode==='host') hostStartGame();
  drawDie($('#d1'),0); drawDie($('#d2'),0);
  refresh.prev=[]; $('#evbanner').hidden=true;
  refresh(); openFirst();
}
function openFirst(){
  const rounds=G.firstRolls.map((r,i)=>`<p class="lbl">${i===0?'Everyone rolls':'Tie, those players roll again'}</p>`+r.map(x=>`<div class="rr" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)"><span><span class="sw" style="background:${PLAYERS[x.p].css};vertical-align:-2px"></span> ${pname(x.p)}</span><span>${x.a} + ${x.b} = <strong>${x.v}</strong></span></div>`).join('')).join('');
  openModal('first',`<h3>${pname(G.first)} goes first</h3><p>The highest roll starts. Setup goes round from ${pname(G.first)} and back again, and ${pname(G.first)} also takes the first turn.</p>${rounds}<div class="mact"><button class="primary" id="fok">Start placing</button></div>`,()=>{
    $('#fok').addEventListener('click',()=>closeModal());
  });
}
function effectiveMode(){
  if(!G) return null;
  if(G.phase==='setup') return G.setup.step;
  if(G.phase==='robber'||G.phase==='scout') return 'robber';
  if(G.phase==='main'&&G.freeRoads>0) return 'road';
  if(G.phase==='main'&&G.freeArmy>0) return 'army';
  if(G.phase==='main') return mode;
  return null;
}
function legalFor(m){
  if(!m) return [];
  if(m==='robber') return Engine.legal.robber(G);
  const p=G.cur;
  if(m==='road'){const L=Engine.legal.road(G,p);return G.phase!=='main'||G.freeRoads>0||Engine.hasCredit(G,p,'commission')?L:L.filter(e=>Engine.canAfford(G,p,Engine.costFor(G,p,e.river?'bridge':'road')));}
  if(m==='village') return G.phase==='main'&&!Engine.canAfford(G,p,COSTS.village)?[]:Engine.legal.village(G,p);
  if(m==='city') return Engine.canAfford(G,p,COSTS.city)?Engine.legal.city(G,p):[];
  if(m==='fisher') return Engine.canAfford(G,p,COSTS.fisher)?Engine.legal.fisher(G,p):[];
  if(m==='army') return G.freeArmy>0||Engine.hasCredit(G,p,'muster')||Engine.canAfford(G,p,COSTS.army)?Engine.legal.army(G,p):[];
  if(m==='hero') return Engine.legal.hero(G,p);
  if(m==='move') return selEdge&&selEdge.army&&selEdge.army.p===p?Engine.legal.moves(G,selEdge):Engine.legal.movable(G,p);
  return [];
}
function phaseText(){
  const n=pname(G.cur);
  if(isBot(G.cur)&&!['over','discard'].includes(G.phase)) return `${n} (bot) is playing…`;
  switch(G.phase){
    case 'setup': return G.setup.step==='village'?`${n}: place your ${G.setup.i<G.np?'first':'second'} village`:`${n}: place a road next to it`;
    case 'roll': return `${n}: roll the dice (you can play a card first)`;
    case 'main': return mode==='hero'?`${n}: click a highlighted road to move ${G.heroes[G.cur].name} (green tiles are in reach of the ability)`:G.freeArmy>0?`${n}: place your free army next to a city`:mode==='move'?(selEdge?`${n}: click a highlighted road to march`:`${n}: choose an army to move`):G.freeRoads>0?`${n}: place ${G.freeRoads} free ${G.freeRoads===1?'road':'roads'}`:mode?`${n}: click a highlighted spot to build`:`${n}: build, trade or end your turn`;
    case 'discard': return 'Players with more than 7 cards discard half';
    case 'robber': return `${n}: move the robber to a highlighted tile`;
    case 'scout': return `${n}: Scout, move the robber anywhere`;
    case 'steal': return `${n}: choose who to rob`;
    case 'over': return `${pname(G.winner)} wins!`;
  }
  return '';
}
function refresh(){
  setTimeout(checkTips,0);
  if(!G) return;
  const p=G.cur, VW=viewer(), P=G.players[VW];
  // players panel
  renderTop();
  // log
  const lg=$('#log'); lg.innerHTML=G.log.slice(-40).map(s=>`<li>${colorNames(s)}</li>`).join(''); lg.scrollTop=lg.scrollHeight;
  // bar
  $('#whoSw').style.background=PLAYERS[VW].css; $('#whoName').textContent=VW===p?pname(p):`${pname(VW)} (your hand)`;
  $('#phase').textContent=phaseText();
  {const dc={};P.dev.forEach(k=>{dc[k]=dc[k]||{ok:0,nw:0};dc[k].ok++;});P.newDev.forEach(k=>{dc[k]=dc[k]||{ok:0,nw:0};dc[k].nw++;});
   const devHtml=Object.entries(dc).map(([k,c])=>{const n=c.ok+c.nw, note=k==='vp'?'Counts toward your score automatically.':c.ok===0?'Bought this turn: playable from your next turn.':G.devPlayed?'You’ve already played a card this turn.':'Click to play.';
     return `<button class="dcard${k==='vp'?' vp':''}${c.ok===0&&k!=='vp'?' new':''}${n>1?' stack':''}" data-dev="${k}" data-tip="${DEV[k].name}: ${DEV[k].desc} ${note}" aria-label="${DEV[k].name}, ${n} in hand">${svgI(k)}${n>1?`<span class="nb">${n}</span>`:''}</button>`;}).join('');
   $('#hand').innerHTML=RKEYS.map(r=>`<div class="card${P.hand[r]?'':' zero'}${P.hand[r]>1?' stack':''}" data-r="${r}" title="${RES[r].name}: ${P.hand[r]}"><i style="background:${RES[r].color}"></i>${svgI(r,darker(RES[r].color))}${RES[r].name}<b>${P.hand[r]}</b></div>`).join('')+(devHtml?`<span class="hsep" aria-hidden="true"></span>${devHtml}`:'');
   $('#hand').querySelectorAll('[data-dev]').forEach(b=>b.addEventListener('click',()=>playCard(b.dataset.dev)));}
  const main=G.phase==='main'&&G.freeRoads===0&&!isBot(p);
  const can=k=>Engine.canAfford(G,p,COSTS[k]);
  const acts={road:main&&legalFor('road').length>0, village:main&&legalFor('village').length>0, city:main&&legalFor('city').length>0,
    fisher:main&&legalFor('fisher').length>0, army:main&&G.freeArmy===0&&legalFor('army').length>0, move:main&&(mode==='move'||Engine.legal.movable(G,p).length>0), hero:main&&(mode==='hero'||Engine.legal.hero(G,p).length>0)};
  if(mode!=='move') selEdge=null;
  document.querySelectorAll('.act[data-act]').forEach(b=>{const k=b.dataset.act;b.disabled=!acts[k];b.setAttribute('aria-pressed',String(mode===k&&main));});
  if(mode&&!acts[mode]&&G.freeRoads===0) mode=null;
  {const h=G.heroes[p];$('#c-hero').textContent=h.wounded!==false?'resting':`${Math.max(0,HERO_MOVES-h.moves)} moves left`;}
  $('#c-road').innerHTML=costDots(COSTS.road); $('#c-village').innerHTML=costDots(COSTS.village); $('#c-city').innerHTML=costDots(COSTS.city); $('#c-dev').innerHTML=costDots(COSTS.dev);
  $('#buydev').disabled=!(main&&can('dev')&&G.deck.length>0);
  $('#c-fisher').innerHTML=costDots(COSTS.fisher); $('#c-army').innerHTML=costDots(COSTS.army);
  $('#trade').disabled=!main; $('#endturn').disabled=!main;
  watchMilestones();
  const ev=G.events, ek=Object.keys(ev);
  for(const k of refresh.prev||[]) if(!ev[k]&&['merchant','harvest','calving','commission','muster'].includes(k)) eventBanner(k,true,EV_END[k]);
  refresh.prev=ek; renderEvChips(); renderEvCards();
  $('#evsec').hidden=!ek.length && !G.march && !G.rally;
  $('#events').innerHTML=ek.map(k=>{let extra='';if(k==='wolf') extra=` ${ev.wolf.rolls} ${ev.wolf.rolls===1?'roll':'rolls'} left.`;if(k==='storm') extra=' Clears after the next roll.';if(k==='flood') extra=` ${ev.flood.rolls} ${ev.flood.rolls===1?'roll':'rolls'} left.`;if(k==='merchant') extra=` Until ${pname(ev.merchant.until)}’s next turn.`;
    return `<p style="margin:4px 0"><strong>${EVENTS[k].name}.</strong> ${EVENTS[k].desc}${extra}</p>`;}).join('')+(G.march?`<p style="margin:4px 0"><strong>Forced march</strong> is active this turn.</p>`:'')+(G.rally?`<p style="margin:4px 0"><strong>Rally:</strong> +1 strength in your next battle this turn.</p>`:'');
  $('#roll').disabled=G.phase!=='roll'||rolling||isBot(p);
  const m=isBot(p)?null:effectiveMode(); showMarkers(G,m,legalFor(m));
  if(ghost) ghost.material=pMat(p).ghost;
  // phase-driven dialogs
  if(G.phase==='discard'&&modalKind!=='discard'&&!isBot(G.discard[0].p)&&!(NET.mode==='client'&&NET.pendingReq)) openDiscard();
  else if(G.phase==='steal'&&modalKind!=='steal'&&!isBot(G.cur)) openSteal();
  else if(G.phase==='over'&&modalKind!=='over') openWinner();
  scheduleBot();
}
/* ---- player bar along the top: one card per player, drawn as their hero ---- */
const MOUTH={neutral:'M17 26 Q20 27 23 26',smile:'M16 25 Q20 29.5 24 25',open:'M16 25 Q20 31.5 24 25 Z',frown:'M16 28.5 Q20 24.5 24 28.5',flat:'M17 27 L23 27',grr:'M16 27 L24 27',smirk:'M16 26.5 Q21 28 24.5 24'};
function avatarSVG(p,mouth='neutral'){return avatarFrom(G.heroes[p].look,PLAYERS[p].css,mouth,G.heroes[p].ability);}
const MOODS={happy:['smile','bounce'],cheer:['open','jump'],sad:['frown','droop'],no:['flat','shake'],angry:['grr','shake'],think:['flat','tilt'],sly:['smirk','bounce']};
const EMOTE={happy:'+',cheer:'★',sad:'…',no:'✕',angry:'!',think:'?',sly:'♪'};
function react(p,mood){
  if(!G||p===null||p===undefined) return;
  {const f=heroFx[p]=heroFx[p]||{},now=performance.now();if(mood==='cheer') f.cheer=now+1600;if(mood==='no'||mood==='angry') f.shake=now+800;}
  const el=document.querySelector(`#pcards .pc[data-p="${p}"]`); if(!el) return;
  const av=el.querySelector('.av'), bub=el.querySelector('.bubble'), [m,a]=MOODS[mood]||MOODS.happy;
  av.innerHTML=avatarSVG(p,m); bub.textContent=EMOTE[mood]||''; bub.hidden=false;
  av.className='av'; void av.offsetWidth; if(!reduceMotion()) av.classList.add('a-'+a);
  clearTimeout(el._t); el._t=setTimeout(()=>{av.innerHTML=avatarSVG(p);av.className='av';bub.hidden=true;},1900);
}
let topFor=null;
function bindTip(el){
  const show=()=>{const t=$('#ptip'),r=el.getBoundingClientRect();t.innerHTML=el.querySelector('.tip').innerHTML;
    const x=Math.min(Math.max(8,r.left+r.width/2-135),innerWidth-278);t.style.left=x+'px';t.style.top=(r.bottom+10)+'px';t.classList.add('show');};
  const hide=()=>$('#ptip').classList.remove('show');
  el.addEventListener('mouseenter',show);el.addEventListener('mouseleave',hide);el.addEventListener('focus',show);el.addEventListener('blur',hide);
}
function renderTop(){
  const box=$('#pcards'), p=G.cur;
  if(topFor!==G||box.children.length!==G.np){
    topFor=G;
    box.innerHTML=G.players.map((pl,i)=>`<div class="pc glass" data-p="${i}" tabindex="0" style="--pc:${PLAYERS[i].css}">
      <div class="av">${avatarSVG(i)}</div><span class="bubble" hidden></span><span class="abl"></span>
      <div class="pci"><div class="pn"></div><div class="ps"></div></div><div class="pvp" title="Victory points"></div><div class="pst"></div><div class="tip" hidden></div></div>`).join('');
    box.querySelectorAll('.pc').forEach(bindTip);
  }
  G.players.forEach((pl,i)=>{
    const el=box.querySelector(`.pc[data-p="${i}"]`), h=G.heroes[i], a=ABILITIES[h.ability], st=G.stats[i];
    el.classList.toggle('cur',i===p); el.classList.toggle('won',G.winner===i);
    const hidden=Engine.vp(G,i,true)-Engine.vp(G,i,false);
    el.classList.toggle('cb',!!uiPrefs.cb); if(uiPrefs.cb){let sg=el.querySelector('.sgb');if(!sg){sg=document.createElement('img');sg.className='sgb';sg.alt='';el.appendChild(sg);}sg.src=sigilURL(i);}
    el.querySelector('.abl').textContent=a.letter; el.querySelector('.abl').style.background=a.color; el.querySelector('.abl').title=a.name;
    el.querySelector('.pn').innerHTML=`${h.name}${pl.bot?' <small>bot</small>':''}`;
    el.querySelector('.ps').innerHTML=`${PLAYERS[i].name} · ${a.name}${h.wounded!==false?' · resting':''}`;
    el.querySelector('.pvp').innerHTML=`${Engine.vp(G,i,false)}${i===viewer()&&hidden&&!pl.bot?`<small>+${hidden}</small>`:''}`;
    el.querySelector('.pst').innerHTML=`<span title="Resource cards">${svgI('dev','currentColor').replace('<svg','<svg class="si"')}${Engine.total(pl.hand)}</span><span title="Development cards">${svgI('vp','currentColor').replace('<svg','<svg class="si"')}${pl.dev.length+pl.newDev.length}</span><span title="Longest continuous road"${G.longest.holder===i?' class="hold"':''}>${svgI('roads','currentColor').replace('<svg','<svg class="si"')}${G.longest.len[i]}</span><span title="Armies on the board"${G.armyHolder===i?' class="hold"':''}>${svgI('swords','currentColor').replace('<svg','<svg class="si"')}${Engine.count(G,i,'army')}</span>`;
    el.querySelector('.tip').innerHTML=`<strong>${h.name} the ${a.name}</strong><p>${a.desc}</p><p class="m">${pname(i)}${pl.bot?' (bot)':''}: ${Engine.vp(G,i,false)} points shown${G.longest.holder===i?', Longest Road':''}${G.armyHolder===i?', Largest Army':''}. Collected ${st.collected} resources, won ${st.won} ${st.won===1?'battle':'battles'}, made ${st.trades} ${st.trades===1?'trade':'trades'}.</p>`;
  });
}

/* ---- negotiating trades, Catan-style ---- */
let nego=null, botWait=false;
const offerCards=o=>RKEYS.filter(r=>o[r]).map(r=>`<span class="oc" style="--rc:${RES[r].color}" title="${o[r]} ${RES[r].name}">${svgI(r,darker(RES[r].color))}<span>${RES[r].name}</span>${o[r]>1?`<b>×${o[r]}</b>`:''}</span>`).join('')||'<em>nothing</em>';
const offerCardsOld=o=>RKEYS.filter(r=>o[r]).map(r=>Array.from({length:o[r]},()=>`<span class="mc big" style="background:${RES[r].color}" title="${RES[r].name}">${svgI(r)}</span>`).join('')).join('')||'<em>nothing</em>';
function canPay(q,o){return RKEYS.every(r=>(o[r]||0)<=G.players[q].hand[r]);}
function startNego(from,give,get){
  // a guest's offer is run by the host; the guest keeps a copy that the host updates
  if(NET.mode==='client'){netSend(NET.host,{t:'propose',give,get});nego={from,give:{...give},get:{...get},responses:{},viaHost:true};negoUpdate();return;}
  nego={from,give:{...give},get:{...get},responses:{}};
  for(let q=0;q<G.np;q++){
    if(q===from) continue;
    if(isRemote(q)){
      // ask the online player; no answer within 40 seconds counts as a decline
      nego.responses[q]={r:'pending'}; netSendTo(q,{t:'offer',from,give,get});
      const n=nego; setTimeout(()=>{if(nego===n&&nego.responses[q].r==='pending'){nego.responses[q]={r:'decline'};netSendTo(q,{t:'negoEnd'});negoUpdate();}},40000);
      continue;}
    if(isBot(q)&&!canPay(q,get)){nego.responses[q]={r:'cannot'};continue;}
    if(isBot(q)){
      nego.responses[q]={r:'pending'};
      const resp=Bot.respond(G,q,from,give,get), n=nego;
      setTimeout(()=>{if(nego!==n) return;
        nego.responses[q]=resp.r==='counter'?{r:'counter',give:resp.gets,get:resp.gives}:{r:resp.r};
        Snd.play(resp.r==='accept'?'coin':resp.r==='counter'?'offer':'decline'); react(q,resp.r==='accept'?'happy':resp.r==='counter'?'think':'no');
        negoUpdate();},350+Math.random()*900);
    } else nego.responses[q]={r:'pending'};
  }
  negoUpdate();
}
function negoUpdate(){
  if(!nego) return;
  if(NET.mode==='client'){
    if(nego.mirror){const x=nego.responses[NET.mySeat];
      if(x&&x.r!=='pending'){netSend(NET.host,{t:'resp',r:x.r,give:x.give,get:x.get});nego=null;closeModal(true);toast('Your answer was sent.');return;}
      openIncoming();return;}
    if(nego.viaHost){if(modalKind==='trade') openTrade('players');return;}
  }
  if(NET.mode==='host'&&isRemote(nego.from)) netSendTo(nego.from,{t:'nego',responses:nego.responses});
  if(isAI(nego.from)){openIncoming();if(Object.values(nego.responses).every(x=>x.r!=='pending')) setTimeout(resolveBotNego,700);}
  else if(isRemote(nego.from)){
    // an online player's offer: people at this device answer in the incoming window; the proposer chooses on their own device
    const localPending=Object.keys(nego.responses).some(q=>!isBot(+q)&&nego.responses[q].r==='pending');
    if(localPending) openIncoming(); else if(modalKind==='incoming') closeModal(true);
  }
  else if(modalKind==='trade') openTrade('players');
}
function negoEnded(){if(NET.mode==='host') netBroadcast({t:'negoEnd'});}
function execNego(q,counter){
  if(NET.mode==='client'&&nego&&nego.viaHost){netSend(NET.host,{t:'pick',q,counter:!!counter});return false;}
  const o=counter?nego.responses[q]:nego, from=nego.from;
  const r=Engine.playerTrade(G,q,o.give,o.get);
  if(r.err){toast(r.err);return false;}
  Snd.play('coin'); react(from,'happy'); react(q,'happy');
  toast(`${pname(from)} trades with ${pname(q)}.`);
  nego=null; negoEnded(); after(r); return true;
}
function resolveBotNego(){
  if(!nego||!isAI(nego.from)) return;
  const from=nego.from, rs=nego.responses;
  const acc=Object.keys(rs).filter(q=>rs[q].r==='accept').map(Number);
  const ctr=Object.keys(rs).filter(q=>rs[q].r==='counter'&&canPay(+q,rs[q].get)&&canPay(from,rs[q].give)&&Bot.acceptsTrade(G,from,+q,rs[q].get,rs[q].give)).map(Number);
  closeModal(true);
  if(acc.length) execNego(acc[Math.floor(Math.random()*acc.length)],false);
  else if(ctr.length) execNego(ctr[0],true);
  else {toast(`Nobody takes ${pname(from)}’s offer.`);Snd.play('decline');nego=null;negoEnded();}
  botWait=false; refresh();
}
function respRow(q){
  const x=nego.responses[q], mine=!isBot(q)&&x.r==='pending', proposerHuman=!isBot(nego.from);
  let mid, act='';
  if(x.r==='pending') mid=isBot(q)?'<em>thinking…</em>':`<span class="m">${pname(q)}, will you trade?</span>`;
  else if(x.r==='accept') mid='<strong class="result good">accepts</strong>';
  else if(x.r==='decline') mid='<span class="result bad">declines</span>';
  else if(x.r==='cannot') mid='<span class="m">doesn’t have the cards</span>';
  else mid=`<span>counters: ${pname(nego.from)} gives ${offerCards(x.give)} for ${offerCards(x.get)}</span>`;
  if(mine) act=`<button class="btn sm" data-ra="${q}" ${canPay(q,nego.get)?'':'disabled title="You don’t have those cards"'}>Accept</button><button class="btn sm" data-rd="${q}">Decline</button><button class="btn sm" data-rc="${q}">Counter</button>`;
  else if(proposerHuman&&x.r==='accept') act=`<button class="primary sm" data-go="${q}">Trade with ${pname(q)}</button>`;
  else if(proposerHuman&&x.r==='counter') act=`<button class="primary sm" data-gc="${q}" ${canPay(nego.from,x.give)?'':'disabled'}>Accept counter</button>`;
  return `<div class="resp"><span class="mini-av">${avatarSVG(q,x.r==='accept'?'smile':x.r==='decline'?'flat':'neutral')}</span><span class="rn">${pname(q)}</span><span class="rm">${mid}</span><span class="ra">${act}</span></div>`;
}
function bindResp(after_){
  const set=(q,r)=>{nego.responses[q]={r};Snd.play(r==='accept'?'coin':'decline');react(q,r==='accept'?'happy':'no');negoUpdate();};
  $('#mbox').querySelectorAll('[data-ra]').forEach(b=>b.addEventListener('click',()=>set(+b.dataset.ra,'accept')));
  $('#mbox').querySelectorAll('[data-rd]').forEach(b=>b.addEventListener('click',()=>set(+b.dataset.rd,'decline')));
  $('#mbox').querySelectorAll('[data-rc]').forEach(b=>b.addEventListener('click',()=>openCounter(+b.dataset.rc)));
  $('#mbox').querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{if(execNego(+b.dataset.go,false)) openTrade('players');}));
  $('#mbox').querySelectorAll('[data-gc]').forEach(b=>b.addEventListener('click',()=>{if(execNego(+b.dataset.gc,true)) openTrade('players');}));
}
function openCounter(q){
  const from=nego.from, theyGive={...nego.get}, theyGet={...nego.give};
  const draw=()=>openModal('counter',`<h3>${pname(q)}’s counter-offer</h3><p>Change what ${pname(q)} gives and wants, then send it back to ${pname(from)}.</p>
    <p class="lbl">${pname(q)} gives</p>${stepper('cg',theyGive,G.players[q].hand)}<p class="lbl">${pname(q)} wants</p>${stepper('ct',theyGet,null)}
    <div class="mact"><button class="btn" id="ccx">Back</button><button class="primary" id="cok">Send counter-offer</button></div>`,()=>{
      bindStepper('cg',theyGive,G.players[q].hand,draw); bindStepper('ct',theyGet,null,draw);
      $('#ccx').addEventListener('click',()=>back());
      $('#cok').addEventListener('click',()=>{nego.responses[q]={r:'counter',give:{...theyGet},get:{...theyGive}};Snd.play('offer');react(q,'think');back();});
    });
  const back=()=>{if(isBot(from)){negoUpdate();if(isBot(from)) openIncoming();} else openTrade('players');};
  draw();
}
function openIncoming(){
  if(!nego) return;
  const from=nego.from, humans=Object.keys(nego.responses).map(Number).filter(q=>!isBot(q));
  if(!humans.length&&modalKind!=='incoming') return;
  openModal('incoming',`<div style="display:flex;gap:12px;align-items:center"><span class="mini-av big">${avatarSVG(from,'smile')}</span><div><h3>${pname(from)} offers a trade</h3><p>${pname(from)} gives ${offerCards(nego.give)} and wants ${offerCards(nego.get)}.</p></div></div>
    <div class="resps">${Object.keys(nego.responses).filter(q=>!isBot(+q)).map(q=>respRow(+q)).join('')}</div>
    <p class="m" style="color:var(--muted);font-size:.86rem;margin-top:8px">Other players answer privately. ${pname(from)} will choose who to trade with.</p>`,()=>bindResp());
}

/* ---- robbing: choose with full information, and see what was taken ---- */
function stealShow(r){
  if(!r||r.victim===undefined) return;
  const thief=G.cur, v=r.victim, res=r.stolen;
  react(thief,'sly'); react(v,'sad');
  if(!res){toast(`${pname(v)} had no cards to steal.`);return;}
  if(!isBot(thief)){Snd.play('sneak');revealGeneric({art:res,col:RES[res].color,title:`1 ${RES[res].name}`,text:`Stolen from ${pname(v)}.`,small:'Click to add it to your hand',target:()=>$(`#hand .card[data-r="${res}"]`)});}
  else {Snd.play(isBot(v)?'sneak':'robbed');announce({icon:'R',art:res,color:PLAYERS[thief].css,kicker:'Robbed',title:`${pname(thief)} steals from ${pname(v)}`,text:isBot(v)?'1 card was taken.':`${pname(v)} loses 1 ${rname(res)}.`,ms:3500});}
}
function revealGeneric(o){
  const rv=$('#reveal');
  rv.innerHTML=`<div class="rv"><div class="rv-in"><div class="rv-b">${svgI(o.art,'#e9dcbf').replace('<svg','<svg style="width:64px;height:64px;margin-bottom:10px"')}</div>
    <div class="rv-f"><div class="art" style="background:${o.col}">${svgI(o.art)}</div><h4>${o.title}</h4><p>${o.text}</p><small>${o.small||''}</small></div></div></div><div class="hint2">Click to continue</div>`;
  rv.hidden=false; const card=rv.querySelector('.rv');
  if(reduceMotion()) card.classList.add('flip'); else setTimeout(()=>card.classList.add('flip'),120);
  rv.onclick=()=>{rv.onclick=null;const h=rv.querySelector('.hint2');h&&h.remove();after({});
    const tgt=o.target&&o.target();
    if(!tgt||reduceMotion()||!card.animate){rv.hidden=true;return;}
    const a=card.getBoundingClientRect(),b=tgt.getBoundingClientRect();
    const an=card.animate([{transform:'none'},{transform:`translate(${b.left+b.width/2-(a.left+a.width/2)}px,${b.top+b.height/2-(a.top+a.height/2)}px) scale(${b.width/a.width})`}],{duration:550,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'});
    an.onfinish=()=>{rv.hidden=true;tgt.classList.remove('bump');void tgt.offsetWidth;tgt.classList.add('bump');};
  };
}

/* ---- fireworks for the winner ---- */
function fireworks(ms=7000){
  if(reduceMotion()) return;
  const c=document.createElement('canvas'); c.id='fw'; document.body.appendChild(c);
  const g=c.getContext('2d'); let W,H; const size=()=>{W=c.width=innerWidth;H=c.height=innerHeight;}; size();
  const parts=[], cols=['#ffd970','#ff6b5a','#7fd0ff','#b78cff','#8fe388','#ffffff',...G.players.map((_,i)=>PLAYERS[i].css)];
  const burst=()=>{const x=W*(0.15+Math.random()*0.7),y=H*(0.12+Math.random()*0.35),col=cols[Math.floor(Math.random()*cols.length)];
    for(let i=0;i<70;i++){const a=Math.random()*Math.PI*2,v=1.5+Math.random()*4.5;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:60+Math.random()*30,col});}
    Snd.play('pop');};
  const t0=performance.now(); let last=0;
  const step=now=>{
    if(now-t0>ms&&!parts.length){c.remove();return;}
    if(now-t0<ms&&now-last>420){last=now;burst();}
    g.globalCompositeOperation='destination-out'; g.fillStyle='rgba(0,0,0,.22)'; g.fillRect(0,0,W,H); g.globalCompositeOperation='lighter';
    for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.06;p.vx*=0.985;p.life--;
      if(p.life<=0){parts.splice(i,1);continue;}g.globalAlpha=Math.min(1,p.life/40);g.fillStyle=p.col;g.beginPath();g.arc(p.x,p.y,2.2,0,Math.PI*2);g.fill();}
    g.globalAlpha=1; requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let lastHuman=null;
// Whose hand is shown at the bottom: the current player when human, otherwise the last human (or your seat).
function viewer(){
  if(!G) return 0;
  if(!isBot(G.cur)){lastHuman=G.cur;return G.cur;}
  if(lastHuman!==null&&!isBot(lastHuman)&&lastHuman<G.np) return lastHuman;
  if(G.you>=0) return G.you;
  const h=G.players.findIndex(x=>!x.bot); return h>=0?h:G.cur;
}
function armyWhyNot(e){
  if(e.army.fresh===G.turnNo&&e.army.n<=(e.army.freshN||e.army.n)) return 'These armies were raised or retreated this turn. They can move from your next turn.';
  if(G.mover&&G.mover.edge!==e.key) return 'Only one army moves each turn, and you’ve already moved one.';
  const errs=[...G.B.edges.values()].map(t=>Engine.moveInfo(G,e,t).err).filter(x=>x&&!/one road at a time|only move along roads/.test(x));
  return errs[0]||'This army has nowhere it can move right now.';
}
function isBot(p){return !!(G&&G.players[p]&&(G.players[p].bot||isRemote(p)));}
let botTimer=null, botTurn={key:'',trades:0,actions:0,moved:false};
function botActor(){
  if(!G||G.phase==='over') return null;
  if(G.phase==='discard') return isAI(G.discard[0].p)?G.discard[0].p:null;
  return isAI(G.cur)?G.cur:null;
}
function scheduleBot(){
  if(botTimer||botActor()===null) return;
  botTimer=setTimeout(()=>{botTimer=null;
    if(rolling||battling||botWait||!$('#modal').hidden&&['first','lobby','counter'].includes(modalKind)){scheduleBot();return;}
    try{botStep();}catch(e){console.error(e);}
  },+$('#botspeed').value||500);
}
function botStep(){
  const p=botActor(); if(p===null) return;
  const key=G.turnNo+'|'+p; if(botTurn.key!==key) botTurn={key,trades:0,actions:0,moved:false};
  if(G.phase==='setup'){
    if(G.setup.step==='village'){const c=Bot.setupVillage(G,p);justBuilt=c.key;const r=Engine.placeVillage(G,c);if(after(r)&&r.gains) r.gains.forEach((g,i)=>collect(g,i));}
    else{const e=Bot.setupRoad(G,p);justBuilt=e.key;after(Engine.placeRoad(G,e));}
    return;
  }
  if(G.phase==='discard'){after(Engine.discard(G,p,Bot.discard(G,p)));return;}
  if(G.phase==='roll'){doRoll();return;}
  if(G.phase==='robber'||G.phase==='scout'){const r=Engine.moveRobber(G,Bot.robberTile(G,p));if(after(r)&&r.victim!==undefined) stealShow(r);return;}
  if(G.phase==='steal'){const q=Bot.stealFrom(G,p);const r=Engine.steal(G,q);if(after(r)) stealShow(r);return;}
  if(G.phase!=='main') return;
  botTurn.actions++;
  const a=botTurn.actions>40?{t:'end'}:Bot.decide(G,p,botTurn);
  let r;
  switch(a.t){
    case 'city': justBuilt=a.c.key; r=Engine.placeCity(G,a.c); break;
    case 'village': justBuilt=a.c.key; r=Engine.placeVillage(G,a.c); break;
    case 'road': justBuilt=a.e.key; r=Engine.placeRoad(G,a.e); break;
    case 'fisher': justBuilt='f'+a.c.key; r=Engine.placeFisher(G,a.c); break;
    case 'army': justBuilt='a'+a.e.key; r=Engine.raiseArmy(G,a.e); break;
    case 'bank': botTurn.trades++; r=Engine.bankTrade(G,a.give,a.get); if(!r.err) Snd.play('coin'); if(!r.err) toast(`${pname(p)} trades ${Engine.rates(G,p)[a.give]} ${rname(a.give)} with the bank for 1 ${rname(a.get)}.`); break;
    case 'dev': r=Engine.playDev(G,a.k,a.args||{}); if(!r.err) Snd.play('card'); if(!r.err) announce({icon:'D',art:a.k,color:'#2c6a70',kicker:`${pname(p)} plays a development card`,title:DEV[a.k].name,text:DEV[a.k].desc,ms:2600}); break;
    case 'offer': botTurn.offers=(botTurn.offers||0)+1; botWait=true; Snd.play('offer'); startNego(p,a.give,a.get); return;
    case 'buydev': r=Engine.buyDev(G); if(!r.err) toast(`${pname(p)} buys a development card.`); break;
    case 'hero': r=Engine.moveHero(G,a.e); if(!r.err&&r.chased) eventBanner(r.chased,true,`${G.heroes[p].name} chased the ${r.chased==='wolf'?'wolf':'bandits'} away.`); break;
    case 'move': botTurn.moved=true;
      if(Engine.moveInfo(G,a.from,a.to).battle){battleAnim(a.from,a.to,()=>doMove(a.from,a.to));return;}
      doMove(a.from,a.to); return;
    default: doEndTurn(); return;
  }
  if(r&&r.err){botTurn.actions=99;}
  after(r&&r.err?{}:r);
}
function after(r,okMsg){
  if(r&&r.pending){refresh();return false;}
  if(r&&!r.err){
    if(r.plunder){const x=r.plunder,me=viewer();Snd.play(x.l===me&&!isBot(me)?'robbed':'coin');react(x.w,'sly');react(x.l,'sad');
      setTimeout(()=>toast(x.w===me||x.l===me?`${pname(x.w)} plunders 1 ${rname(x.res)} from ${pname(x.l)}.`:`${pname(x.w)} plunders a card from ${pname(x.l)}.`),900);}
    if(r.dusk) setTimeout(()=>toast('Night falls. Wolves and bandits may come out.'),300);
    if(r.dawn) setTimeout(()=>toast('Dawn breaks over Highhorn.'),300);
  }
  if(r&&r.err){toast(r.err,'err');return false;}
  renderPieces(G); refresh(); if(okMsg) toast(okMsg); return true;
}

/* ---- board interaction ---- */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function pick(ev){
  const r=canvas.getBoundingClientRect();
  ndc.set(((ev.clientX-r.left)/r.width)*2-1,-((ev.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(pickables,false)[0];
  return hit?{tile:hit.object.userData.tile,p:hit.point}:null;
}
function nearestIn(list,h,m,maxD){
  let best=null,bd=Infinity;
  for(const x of list){
    let px,pz;
    if(m==='road'||m==='edge'){const a=G.B.corners.get(x.a),b=G.B.corners.get(x.b);px=(a.x+b.x)/2;pz=(a.z+b.z)/2;} else {px=x.x;pz=x.z;}
    const d=Math.hypot(px-h.p.x,pz-h.p.z); if(d<bd){bd=d;best=x;}
  }
  return bd<=maxD?best:null;
}
function nearestCorner(h){return nearestIn(h.tile.corners.map(k=>G.B.corners.get(k)),h,'corner',9);}
function nearestEdge(h){return nearestIn(h.tile.edges.map(k=>G.B.edges.get(k)),h,'edge',9);}
function portText(t){return t==='any'?'3:1 for any resource':`2:1 for ${rname(t)}`;}
function tileCard(t){
  const d=TERRAIN[t.terrain]; let html=`<h3>${t.gap?'River valley':d.name}</h3>`;
  if(t.gap) html+=`<p>Where a river leaves the map. The village corner beside it is a river port.</p>`;
  else if(t.rim) html+=`<p>The mountains ringing Highhorn, where the yaks come from and the rivers spring.</p>`;
  else if(t.terrain==='lake') html+=`<p>Fish on a roll of ${t.num}.</p><p class="m">Villages here need a fisherman to catch anything. A city catches 1 without one, 2 with one.</p>`;
  else if(d.res) html+=`<p>Produces ${rname(d.res)} on a roll of ${t.num}.</p><p class="m">${pips(t.num)} in 36 chance each roll.</p>`;
  else html+=`<p>Produces nothing.</p>`;
  if(t===G.robber) html+=`<p>The robber is blocking this tile.</p>`;
  if(G.events.wolf&&G.events.wolf.tile===t.key) html+=`<p>A wolf is here. No leather until it leaves.</p>`;
  if(G.events.bandits&&G.events.bandits.tile===t.key) html+=`<p>Bandits are blocking this tile.</p>`;
  t.edges.map(k=>G.B.edges.get(k)).filter(e=>e.gate).forEach(e=>html+=`<p class="m">Trade post: ${portText(e.gate)}</p>`);
  return html;
}
function cornerCard(c,why){
  const prodT=c.tiles.filter(t=>t.num&&TERRAIN[t.terrain].res);
  let html=`<h3>${c.building?pname(c.building.p)+' '+c.building.type:'Corner'}</h3>`;
  html+=prodT.length?`<p>Touches ${prodT.map(t=>`${rname(TERRAIN[t.terrain].res)} ${t.num}`).join(', ')}.</p><p class="m">${prodT.reduce((s,t)=>s+pips(t.num),0)} pips in total</p>`:`<p>Touches no producing tiles.</p>`;
  if(c.port) html+=`<p class="m">${c.riverPort?'River port':'Trade post'}: ${portText(c.port)}</p>`;
  if(c.building&&Engine.siegedBy(G,c)!==null) html+=`<p><strong>Under siege by ${pname(Engine.siegedBy(G,c))}.</strong> Produces nothing until the army leaves or is beaten.</p>`;
  if(c.fisher) html+=`<p class="m">Has a fisherman${c.building&&Engine.fishBlocked(G,c)?', but it is blockaded':''}.</p>`;
  if(why) html+=`<p class="m">${why}</p>`;
  return html;
}
function hover(ev){
  if(!G||!ghost||!$('#modal').hidden) return;
  hoverEdge=null; canvas.style.cursor='';
  ghost.visible=false;
  const h=pick(ev); if(!h){$('#card').hidden=true;return;}
  const m=isBot(G.cur)?null:effectiveMode(), card=$('#card'); let html;
  if(m==='road'){
    const L=legalFor('road'), e=nearestIn(L,h,'road',0.75);
    if(e){const a=G.B.corners.get(e.a),b=G.B.corners.get(e.b);ghost.geometry=G3.unit;ghost.scale.set(0.12,0.08,Math.hypot(b.x-a.x,b.z-a.z)*0.62);ghost.position.set((a.x+b.x)/2,TOP+0.07,(a.z+b.z)/2);ghost.lookAt(b.x,TOP+0.07,b.z);ghost.visible=true;
      html=`<h3>${e.river?'Bridge':'Road'}</h3><p>${G.phase==='setup'||G.freeRoads>0?'Free':'Costs '+costText(COSTS[e.river?'bridge':'road'])}.</p>`;}
    else{const ne=nearestEdge(h); const why=ne?Engine.whyNotRoad(G,G.cur,ne):null; html=`<h3>${ne&&ne.river?'River':'Road'}</h3><p class="m">${why||'Not available here.'}</p>`;}
  } else if(m==='village'||m==='city'){
    const L=legalFor(m), c=nearestIn(L,h,'corner',0.6);
    if(c){ghost.geometry=G3.sphere;ghost.scale.set(1,1,1);ghost.rotation.set(0,0,0);ghost.position.set(c.x,TOP+(m==='city'?0.36:0.12),c.z);ghost.visible=true;html=cornerCard(c);}
    else{const nc=nearestCorner(h);html=cornerCard(nc,m==='city'?Engine.whyNotCity(G,G.cur,nc):Engine.whyNotVillage(G,G.cur,nc));}
  } else if(m==='fisher'){
    const c=nearestIn(legalFor('fisher'),h,'corner',0.6);
    if(c){ghost.geometry=G3.sphere;ghost.scale.set(1,1,1);ghost.position.set(c.x,TOP+0.12,c.z);ghost.visible=true;html=cornerCard(c);}
    else{const nc=nearestCorner(h);html=cornerCard(nc,Engine.whyNotFisher(G,G.cur,nc));}
  } else if(m==='hero'){
    const e=nearestIn(legalFor('hero'),h,'road',0.75), hh=G.heroes[G.cur];
    if(e){const a=G.B.corners.get(e.a),b=G.B.corners.get(e.b);ghost.geometry=G3.unit;ghost.scale.set(0.12,0.08,Math.hypot(b.x-a.x,b.z-a.z)*0.62);ghost.position.set((a.x+b.x)/2,TOP+0.07,(a.z+b.z)/2);ghost.lookAt(b.x,TOP+0.07,b.z);ghost.visible=true;
      html=`<h3>Move ${hh.name} here</h3><p>${heroReach(G.cur,e)}</p>`;}
    else{const ne=nearestEdge(h);html=heroCard(G.cur)+(ne?`<p class="m">${Engine.heroMoveInfo(G,G.cur,ne).err||''}</p>`:'');}
  } else if(m==='army'||m==='move'){
    const L=legalFor(m), e=nearestIn(L,h,'road',0.75);
    if(e){
      const a=G.B.corners.get(e.a),b=G.B.corners.get(e.b);ghost.geometry=G3.unit;ghost.scale.set(0.12,0.08,Math.hypot(b.x-a.x,b.z-a.z)*0.62);ghost.position.set((a.x+b.x)/2,TOP+0.07,(a.z+b.z)/2);ghost.lookAt(b.x,TOP+0.07,b.z);ghost.visible=true;
      if(m==='army') html=`<h3>Raise an army</h3><p>${G.freeArmy>0?'Free (Reinforcements).':'Costs '+costText(COSTS.army)+'.'}</p>`;
      else if(selEdge&&selEdge.army){const info=Engine.moveInfo(G,selEdge,e);html=info.battle?`<h3>Attack</h3><p>${info.battle.aS} against ${info.battle.dS}: ${info.battle.attWins?'you win':'you lose'}.</p><p class="m">Costs ${info.cost||'no'} fish.</p>`:`<h3>March here</h3><p>Costs ${info.cost?info.cost+' fish':'nothing'}${e.road.p!==G.cur?' (enemy road)':''}.</p>`;}
      else{hoverEdge=e;canvas.style.cursor='pointer';html=`<h3>Your army</h3><p>${e.army.n} on this road. Click to choose it; one army moves, the rest can support battles.</p>`;}
    } else {const ne=nearestEdge(h);html=ne&&ne.army?`<h3>${pname(ne.army.p)} army</h3><p>${ne.army.n} strong.</p>`:(m==='army'&&ne?`<h3>Army</h3><p class="m">${Engine.whyNotArmy(G,G.cur,ne)||''}</p>`:tileCard(h.tile));}
  } else if(m==='robber'){
    html=legalFor('robber').includes(h.tile)?`<h3>Move the robber here</h3><p>${TERRAIN[h.tile.terrain].name} stops producing until the robber moves.</p>`:tileCard(h.tile);
  } else {
    const ne=nearestEdge(h), a=ne&&G.B.corners.get(ne.a), b=ne&&G.B.corners.get(ne.b);
    const close=ne&&Math.hypot((a.x+b.x)/2-h.p.x,(a.z+b.z)/2-h.p.z)<0.42;
    const heroes=close?G.heroes.map((x,q)=>x.edge===ne.key?q:-1).filter(q=>q>=0):[];
    if(close&&(heroes.length||ne.army)){
      html=heroes.map(q=>heroCard(q).replace('<h3>',`<h3><span class="mini-av" style="width:26px;height:26px;vertical-align:-7px;margin-right:6px">${avatarSVG(q)}</span>`)+`<p class="m">${pname(q)}’s hero</p>`).join('');
      if(ne.army) html+=`<h3>${pname(ne.army.p)} army</h3><p>${ne.army.n} on this road.${ne.army.p===G.cur&&!isBot(G.cur)&&Engine.legal.movable(G,G.cur).includes(ne)?' Click to move one of them.':''}</p>`;
      if(ne.army&&ne.army.p===G.cur&&!isBot(G.cur)&&Engine.legal.movable(G,G.cur).includes(ne)){hoverEdge=ne;canvas.style.cursor='pointer';}
    } else if(h.tile.terrain==='pasture'&&yakNear(h.p,0.2)){
      html=`<h3>Yaks</h3><p>Click to shoo them off the number.</p>`; canvas.style.cursor=BOOT;
    } else html=tileCard(h.tile);
  }
  card.innerHTML=html; card.hidden=false;
}
function click(ev){
  if(!G||battling) return;
  if(isBot(G.cur)&&G.phase!=='discard'){toast(`${pname(G.cur)} is a bot and is taking its turn.`);return;}
  const h=pick(ev); if(!h) return;
  const m=effectiveMode();
  if(m==='road'){
    const e=nearestIn(legalFor('road'),h,'road',0.75);
    if(!e){const ne=nearestEdge(h);toast((ne&&Engine.whyNotRoad(G,G.cur,ne))||'Click one of the highlighted spots.');return;}
    if(G.phase!=='setup'&&!G.freeRoads){if(!sure(e.river?'bridge':'road',()=>{justBuilt=e.key;after(Engine.placeRoad(G,e));})) return;}
    justBuilt=e.key; after(Engine.placeRoad(G,e));
  } else if(m==='village'||m==='city'){
    const c=nearestIn(legalFor(m),h,'corner',0.6);
    if(!c){const nc=nearestCorner(h);toast((nc&&(m==='city'?Engine.whyNotCity(G,G.cur,nc):Engine.whyNotVillage(G,G.cur,nc)))||'Click one of the highlighted spots.');return;}
    const doIt=()=>{justBuilt=c.key;const r=m==='city'?Engine.placeCity(G,c):Engine.placeVillage(G,c);if(after(r)&&r.gains) r.gains.forEach((g,i)=>flyRes(g.tile,g.corner,g.res,g.n,i));};
    if(G.phase!=='setup'&&!sure(m,doIt)) return;
    doIt();
  } else if(m==='fisher'){
    const c=nearestIn(legalFor('fisher'),h,'corner',0.6);
    if(!c){const nc=nearestCorner(h);toast((nc&&Engine.whyNotFisher(G,G.cur,nc))||'Click one of the highlighted spots.');return;}
    const doF=()=>{justBuilt='f'+c.key;after(Engine.placeFisher(G,c));};
    if(!sure('fisher',doF)) return; doF();
  } else if(m==='army'){
    const e=nearestIn(legalFor('army'),h,'road',0.75);
    if(!e){const ne=nearestEdge(h);toast((ne&&Engine.whyNotArmy(G,G.cur,ne))||'Click one of the highlighted roads.');return;}
    const doA=()=>{justBuilt='a'+e.key;after(Engine.raiseArmy(G,e));};
    if(!G.freeArmy&&!sure('army',doA)) return; doA();
  } else if(m==='hero'){
    const e=nearestIn(legalFor('hero'),h,'road',0.75);
    if(!e){const ne=nearestEdge(h);toast((ne&&Engine.heroMoveInfo(G,G.cur,ne).err)||'Click one of the highlighted roads.');return;}
    const r=Engine.moveHero(G,e);
    if(after(r)){if(r.chased==='wolf') eventBanner('wolf',true,`${G.heroes[G.cur].name} the Herder chased the wolf away.`);if(r.chased==='bandits') eventBanner('bandits',true,`${G.heroes[G.cur].name} the Warlord drove the bandits off.`);if(!Engine.legal.hero(G,G.cur).length){mode=null;refresh();}}
  } else if(m==='move'){
    const ne=nearestEdge(h);
    if(ne&&ne.army&&ne.army.p===G.cur&&ne!==selEdge&&!(selEdge&&Engine.legal.moves(G,selEdge).includes(ne))){
      if(!Engine.legal.movable(G,G.cur).includes(ne)){toast(armyWhyNot(ne));return;}
      selEdge=ne;renderPieces(G);refresh();return;}
    if(selEdge&&ne===selEdge){selEdge=null;renderPieces(G);refresh();return;}
    if(!selEdge){toast('Click one of your highlighted armies first.');return;}
    const e=nearestIn(legalFor('move'),h,'road',0.75);
    if(!e){toast((ne&&Engine.moveInfo(G,selEdge,ne).err)||'Click one of the highlighted roads.');return;}
    const info=Engine.moveInfo(G,selEdge,e);
    if(info.battle){openBattle(selEdge,e,info);return;}
    if(info.cost>0){const from=selEdge,f=G.players[G.cur].hand.fish;Snd.play('offer');
      openModal('fishcost',`<div style="display:flex;gap:14px;align-items:center"><span class="mc big" style="background:${RES.fish.color};width:44px;height:58px">${svgI('fish')}</span><div><h3>Spend ${info.cost} fish?</h3>
        <p>${e.road.p!==G.cur?'Marching on another player’s road':'A second move this turn'} costs ${info.cost} fish. You have ${f}, and would have ${f-info.cost} left.</p></div></div>
        <div class="mact"><button class="btn" id="fcno">Stay put</button><button class="primary" id="fcyes">March for ${info.cost} fish</button></div>`,()=>{
        $('#fcno').addEventListener('click',()=>closeModal());$('#fcyes').addEventListener('click',()=>{closeModal();doMove(from,e);});});
      return;}
    doMove(selEdge,e);
  } else if(m==='robber'){
    const r=Engine.moveRobber(G,h.tile);
    if(after(r)&&r.victim!==undefined) stealShow(r);
  } else {
    const ne=nearestEdge(h), a=ne&&G.B.corners.get(ne.a), b=ne&&G.B.corners.get(ne.b);
    if(G.phase==='main'&&ne&&ne.army&&ne.army.p===G.cur&&Math.hypot((a.x+b.x)/2-h.p.x,(a.z+b.z)/2-h.p.z)<0.42&&Engine.legal.movable(G,G.cur).includes(ne)){mode='move';selEdge=ne;renderPieces(G);refresh();return;}
    if(h.tile.terrain==='pasture'&&yakNear(h.p,0.22)&&shooYaks(h.tile)) return;
    $('#card').innerHTML=tileCard(h.tile); $('#card').hidden=false; }
  hover(ev);
}
let down=null;
canvas.addEventListener('pointerdown',ev=>{down={x:ev.clientX,y:ev.clientY,t:performance.now()};});
canvas.addEventListener('pointerup',ev=>{if(down&&Math.hypot(ev.clientX-down.x,ev.clientY-down.y)<7&&performance.now()-down.t<600) click(ev);down=null;});
canvas.addEventListener('pointermove',ev=>{if(ev.pointerType==='mouse') hover(ev);});
canvas.addEventListener('dblclick',ev=>{const h=pick(ev);if(!h) return;userCam=performance.now();
  if(camera.position.distanceTo(controls.target)<10.5) camOverview(); else camGo(h.tile.x,h.tile.z,7.5);});
function myArea(){
  if(!G) return; const me=viewer(); let sx=0,sz=0,n=0;
  for(const c of G.B.corners.values()) if(c.building&&c.building.p===me){sx+=c.x;sz+=c.z;n+=2;}
  for(const e of G.B.edges.values()) if(e.road&&e.road.p===me){const a=G.B.corners.get(e.a),b=G.B.corners.get(e.b);sx+=(a.x+b.x)/2;sz+=(a.z+b.z)/2;n++;}
  if(!n){toast('You have nothing on the board yet.');return;}
  userCam=performance.now(); camGo(sx/n,sz/n,9.5);
}
canvas.addEventListener('pointerleave',()=>{if(ghost) ghost.visible=false;$('#card').hidden=true;});

/* ---- bar actions ---- */
document.querySelectorAll('.act[data-act]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.act;mode=mode===k?null:k;refresh();}));
// Press and hold an action to see what it costs or does (handy on phones, where costs are hidden)
{const ACT_INFO={road:()=>`Road: ${costText(COSTS.road)}. A bridge: ${costText(COSTS.bridge)}.`,village:()=>`Village: ${costText(COSTS.village)}.`,city:()=>`City: ${costText(COSTS.city)}.`,fisher:()=>`Fisherman: ${costText(COSTS.fisher)}.`,army:()=>`Army: ${costText(COSTS.army)}.`,
  move:()=>'Move one army up to 2 roads. Your own road first is free; enemy roads cost fish.',hero:()=>'Move your hero up to 2 roads, free.',buydev:()=>`Development card: ${costText(COSTS.dev)}.`,trade:()=>'Trade with the bank, trade posts or other players.',endturn:()=>'End your turn.'};
 document.querySelectorAll('.act').forEach(b=>{let t=null;const key=b.dataset.act||b.id;
  b.addEventListener('pointerdown',()=>{t=setTimeout(()=>{t=null;b.dataset.lp='1';if(ACT_INFO[key]) toast(ACT_INFO[key]());},450);});
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{if(t){clearTimeout(t);t=null;}}));
  b.addEventListener('click',e=>{if(b.dataset.lp){delete b.dataset.lp;e.stopImmediatePropagation();e.preventDefault();}},true);
  b.addEventListener('contextmenu',e=>e.preventDefault());});}
$('#roll').addEventListener('click',()=>{if(G&&!isBot(G.cur)) doRoll();});
function doRoll(){
  if(!G||G.phase!=='roll'||rolling) return;
  if(NET.mode==='client'){Engine.roll(G);return;}
  rolling=true; refresh(); Snd.play('dice');
  const r=Engine.roll(G);
  rollVisual(r);
}
function rollVisual(r){
  drawDie($('#d1'),r.d1,true); drawDie($('#d2'),r.d2,true);
  const finish=()=>{
    rolling=false;
    highlighted.forEach(t=>t.capMat.emissive.setRGB(0,0,0));
    highlighted=G.B.tiles.filter(t=>t.num===r.sum&&(TERRAIN[t.terrain].res||t.terrain==='lake')); hlUntil=performance.now()+1600;
    {const ev=G.events,bk=[G.robber,ev.wolf&&G.B.tileMap.get(ev.wolf.tile),ev.bandits&&G.B.tileMap.get(ev.bandits.tile)];
     highlighted.forEach(t=>ripple(t,bk.includes(t)?0xff5a4a:null));
     if(bk.some(t=>t&&t.num===r.sum)){Snd.play('thud',null,0.3);bk.filter(t=>t&&t.num===r.sum).forEach(t=>t.corners.forEach(k=>{const c=G.B.corners.get(k);if(c.building) react(c.building.p,'angry');}));}
     if(r.sum===7) Snd.play('seven');
     if(bk.some(t=>t&&t.num===r.sum)) toast('A blocked tile was rolled. It produces nothing until the blocker leaves.');}
    r.gains.forEach((g,i)=>collect(g,i));
    after(r);
    (r.ended||[]).forEach(k=>eventBanner(k,true,EV_END[k]));
    if(r.event){freshEv.add(r.event.key);const e=G.events[r.event.key];eventBanner(r.event.key,false,evLeft(r.event.key)?`(${evLeft(r.event.key)[0].toUpperCase()+evLeft(r.event.key).slice(1)}.)`:'');refresh();}
  };
  if(reduceMotion()){finish();return;}
  setTimeout(finish,1000);
}
// One soldier marches from the road it left to its place on the new road
function walkArmy(fromPos,to){
  const list=armyMeshes[to.key]; if(!list||!list.length||reduceMotion()) return;
  const g=list[list.length-1], end=g.position.clone(), start=new THREE.Vector3(fromPos.x,end.y,fromPos.z), face=g.rotation.y;
  g.rotation.y=Math.atan2(-(end.z-start.z),end.x-start.x)-Math.PI/2+Math.PI/2; g.position.copy(start); g.userData.walking=true;
  Snd.play('march');
  anim(700,k=>{g.position.lerpVectors(start,end,k);g.position.y=end.y+Math.abs(Math.sin(k*Math.PI*5))*0.03;
      if(g.userData.spear) g.userData.spear.rotation.z=Math.sin(k*Math.PI*5)*0.12;},
    ()=>{g.position.copy(end);g.rotation.y=face;g.userData.walking=false;if(g.userData.spear) g.userData.spear.rotation.z=0;
      g.userData.x0=end.x;g.userData.z0=end.z;g.userData.y0=end.y;});
}
function doMove(from,to){
  const fromPos=edgeMid(from.key);
  const r=Engine.moveArmy(G,from,to);
  if(r.pending) return;
  if(r.err){toast(r.err,'err');return;}
  if(!r.battle) setTimeout(()=>walkArmy(fromPos,to),0);
  selEdge=to.army&&to.army.p===G.cur&&Engine.legal.moves(G,to).length?to:null;
  if(!selEdge) mode=null;
  after(r);
  retreatAnim(r.retreats);
  if(r.battle){react(r.battle.winP,'cheer');react(r.battle.loseP,'sad');}
  if(r.wounded) r.wounded.forEach(q=>{react(q,'sad');Snd.play('sad',null,0.6);});
  if(r.battle) Snd.play(r.battle.attacker===G.cur&&r.battle.attWins||r.battle.defender===G.cur&&!r.battle.attWins?'victory':'defeat');
  if(r.battle){const b=r.battle;announce(b.attWins?{icon:'⚔',art:'swords',color:GOOD,kicker:'Victory',title:`${pname(b.attacker)} wins the battle`,text:`${b.aS} against ${b.dS}. ${pname(b.attacker)} takes the road; ${pname(b.defender)} retreats.`,big:true}:{icon:'⚔',art:'swords',color:BAD,kicker:'Defeat',title:`${pname(b.defender)} holds the road`,text:`${b.dS} against ${b.aS}. ${pname(b.attacker)}’s attack fails and the army retreats.`,big:true});}
  else if(r.chased==='wolf') eventBanner('wolf',true,`${pname(G.cur)}’s army chased the wolf away.`);
  else if(r.chased==='bandits') eventBanner('bandits',true,`${pname(G.cur)}’s army drove the bandits off.`);
  else if(r.chased==='robber') toast('The robber flees! Click a tile to move it.');
  if(r.wounded) r.wounded.forEach(q=>announce({icon:ABILITIES[G.heroes[q].ability].letter,art:'hero',color:BAD,kicker:'Hero wounded',title:`${G.heroes[q].name} is wounded`,text:`${pname(G.cur)}’s army caught ${pname(q)}’s hero alone. ${G.heroes[q].name} limps home and rests until the end of ${pname(q)}’s next turn.`}));
}
function toastResult(msg,good){const el=$('#toast');el.innerHTML=`<span class="result ${good?'good':'bad'}">${msg}</span>`;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3200);}
function openBattle(from,to,info){
  const b=info.battle, A=pname(b.attacker), D=pname(b.defender);
  const rp=(p,n,ok)=>n<=0?'':ok?`${n} ${n===1?'army retreats':'armies retreat'} to ${pname(p)}’s nearest connected city.`:`${n} ${n===1?'army is':'armies are'} lost, with no city to fall back to.`;
  const defDesc=`${to.army.n} ${to.army.n===1?'army':'armies'} on the road${b.supD?` + ${b.supD} supporting`:''}${b.bonus?' + 1 home bonus':''}${b.wd?' + 1 Warlord':''}`, attDesc=`1 army moving${b.supA?` + ${b.supA} supporting`:''}${b.rally?' + 1 rally':''}${b.wa?' + 1 Warlord':''}`;
  let html=`<h3>This move starts a battle</h3><p><strong>${A} ${b.aS}</strong> (${attDesc}) against <strong>${D} ${b.dS}</strong> (${defDesc}). The move costs ${info.cost||'no'} fish.</p>`;
  html+=`<p class="m" style="color:var(--muted);font-size:.86rem">Your other armies on roads touching this one support the attack; so do the defender’s.</p>`;
  if(b.attWins) html+=`<p class="result good">${A} wins.</p><p>The moving army takes the road. ${b.depleted?`${b.depleted} worn-out supporting ${b.depleted===1?'army':'armies'}: `:''}${rp(b.attacker,b.depleted,b.winnerRetreat)}</p><p>${D}: ${rp(b.defender,b.loserN,b.loserRetreat)}</p>`;
  else html+=`<p class="result bad">${D} ${b.aS===b.dS?'wins the tie as defender':'wins'}.</p><p>${b.keep} ${b.keep===1?'army holds':'armies hold'} the road. ${rp(b.defender,b.depleted,b.winnerRetreat)}</p><p>${A}: ${rp(b.attacker,b.loserN,b.loserRetreat)}</p>`;
  openModal('battle',html+`<div class="mact"><button class="btn" id="bcancel">Cancel</button><button class="primary" id="bok">${b.attWins?'Attack':'Attack anyway'}</button></div>`,()=>{
    $('#bcancel').addEventListener('click',()=>closeModal());
    $('#bok').addEventListener('click',()=>{closeModal();battleAnim(from,to,()=>doMove(from,to));});
    $('#mbox').classList.add('battle');
  });
}
$('#buydev').addEventListener('click',()=>{const go=()=>{const r=Engine.buyDev(G);if(r.pending) return;if(r.err){toast(r.err,'err');return;}revealCard(r.card);};if(!canAffordUi(COSTS.dev)){go();return;}if(sure('dev',go)) go();});
function revealCard(k){
  Snd.play('card');
  const rv=$('#reveal'), col=k==='vp'?'#c99a1e':'#2c6a70';
  rv.innerHTML=`<div class="rv"><div class="rv-in"><div class="rv-b">${svgI('dev','#e9dcbf').replace('<svg','<svg style="width:64px;height:64px;margin-bottom:10px"')}Development card</div>
    <div class="rv-f"><div class="art" style="background:${col}">${svgI(k)}</div><h4>${DEV[k].name}</h4><p>${DEV[k].desc}</p><small>${k==='vp'?'Counts right away, kept hidden.':'Playable from your next turn.'}</small></div></div></div><div class="hint2">Click to add it to your hand</div>`;
  rv.hidden=false;
  const card=rv.querySelector('.rv');
  if(reduceMotion()) card.classList.add('flip'); else setTimeout(()=>card.classList.add('flip'),120);
  rv.onclick=()=>{
    rv.onclick=null; rv.querySelector('.hint2').remove();
    after({}); // the card now shows in the hand
    const tgt=$(`#hand [data-dev="${k}"]`);
    if(!tgt||reduceMotion()||!card.animate){rv.hidden=true;return;}
    const a=card.getBoundingClientRect(), b=tgt.getBoundingClientRect();
    tgt.style.visibility='hidden';
    const an=card.animate([{transform:'none'},{transform:`translate(${b.left+b.width/2-(a.left+a.width/2)}px,${b.top+b.height/2-(a.top+a.height/2)}px) scale(${b.width/a.width}) rotate(-8deg)`}],{duration:600,easing:'cubic-bezier(.5,0,.2,1)',fill:'forwards'});
    rv.animate([{background:getComputedStyle(rv).backgroundColor},{background:'transparent'}],{duration:600,fill:'forwards'});
    an.onfinish=()=>{rv.hidden=true;rv.getAnimations&&rv.getAnimations().forEach(x=>x.cancel());tgt.style.visibility='';tgt.classList.remove('bump');void tgt.offsetWidth;tgt.classList.add('bump');};
  };
}
$('#endturn').addEventListener('click',()=>{if(G&&!isBot(G.cur)) doEndTurn();});
function doEndTurn(){mode=null;selEdge=null;if(nego) negoEnded();nego=null;if(after(Engine.endTurn(G))){drawDie($('#d1'),0);drawDie($('#d2'),0);
  const nb=isBot(G.cur), humans=G.players.filter(x=>!x.bot).length;
  Snd.play('turn');
  announce({icon:String(G.turnNo),art:'turn',color:PLAYERS[G.cur].css,kicker:'Next turn',title:`${pname(G.cur)}’s turn`,text:nb?`${pname(G.cur)} is a bot and plays automatically.`:humans>1?`Pass the device to ${pname(G.cur)}.`:'Your turn.',ms:nb?1400:2500});}}
$('#trade').addEventListener('click',()=>{if(nego&&nego.from===G.cur){openTrade('players');return;}Object.assign(tradeState,{give:null,get:null,offer:{give:{},get:{}},partner:null});openTrade('bank');});


/* ---- dialogs ---- */
function openModal(kind,html,bind){modalKind=kind;$('#mbox').classList.toggle('trade',['trade','discard','counter','incoming','plenty'].includes(kind));if(kind!=='lobby'&&kind!=='over') $('#mbox').classList.remove('wide');$('#mbox').classList.remove('battle');$('#mbox').innerHTML=(['discard','steal','over','lobby','incoming','first','counter'].includes(kind)?'':'<button class="mclose" aria-label="Close" title="Close">×</button>')+html;$('#modal').hidden=false;{const x=$('#mbox .mclose');x&&x.addEventListener('click',()=>closeModal());}bind&&bind();const f=$('#mbox').querySelector('button:not(:disabled)');f&&f.focus();}
function closeModal(force){if(!force&&['discard','steal','over','lobby','incoming'].includes(modalKind)) return;$('#modal').hidden=true;modalKind=null;}
$('#modal').addEventListener('keydown',ev=>{if(ev.key==='Escape') closeModal();});
// click outside a dialog to close it (dialogs that need an answer ignore this)
$('#modal').addEventListener('click',ev=>{if(ev.target===$('#modal')) closeModal();});
document.addEventListener('keydown',ev=>{if((ev.key==='Escape'||ev.key==='Enter'||ev.key===' ')&&!$('#reveal').hidden&&$('#reveal').onclick){ev.preventDefault();$('#reveal').onclick();}});
function stepper(prefix,vals,max){
  return `<div class="cpick">${RKEYS.map(r=>{const v=vals[r]||0,have=max?max[r]:null,full=have!==null&&v>=have;
    return `<div class="cp${v?' on':''}${have===0?' none':''}" style="--rc:${RES[r].color}">
      <button class="cpc" data-${prefix}-plus="${r}" aria-label="Add 1 ${rname(r)}" ${full?'disabled':''}>${svgI(r,darker(RES[r].color))}<span>${RES[r].name}</span>${have!==null?`<small>you have ${have}</small>`:''}${v?`<b class="cpn">${v}</b>`:''}</button>
      <div class="cpb"><button data-${prefix}-minus="${r}" aria-label="Less ${rname(r)}" ${v?'':'disabled'}>−</button><button data-${prefix}-plus="${r}" aria-label="More ${rname(r)}" ${full?'disabled':''}>+</button></div></div>`;}).join('')}</div>`;
}
function bindStepper(prefix,vals,max,onChange){
  $('#mbox').querySelectorAll(`[data-${prefix}-plus]`).forEach(b=>b.addEventListener('click',()=>{const r=b.dataset[prefix+'Plus'];if(!max||(vals[r]||0)<max[r]){vals[r]=(vals[r]||0)+1;onChange();}}));
  $('#mbox').querySelectorAll(`[data-${prefix}-minus]`).forEach(b=>b.addEventListener('click',()=>{const r=b.dataset[prefix+'Minus'];if((vals[r]||0)>0){vals[r]--;onChange();}}));
}
function openDiscard(){
  Snd.play('sad'); react(G.discard[0].p,'sad');
  const d=G.discard[0], sel={}, hand=G.players[d.p].hand;
  const draw=()=>{
    const n=RKEYS.reduce((s,r)=>s+(sel[r]||0),0);
    openModal('discard',`<h3>${pname(d.p)} discards ${d.n} cards</h3><p>You hold ${Engine.total(hand)} cards, more than 7, so half go back to the bank. Pass the device to ${pname(d.p)}.</p>
      ${stepper('d',sel,hand)}<div class="mact"><button class="primary" id="dok" ${n===d.n?'':'disabled'}>Discard ${n} of ${d.n}</button></div>`,()=>{
      bindStepper('d',sel,hand,draw);
      $('#dok').addEventListener('click',()=>{const r=Engine.discard(G,d.p,sel);if(r.err){toast(r.err);return;}modalKind=null;$('#modal').hidden=true;after(r);});
    });
  };
  draw();
}
function openSteal(){
  openModal('steal',`<h3>Who do you rob?</h3><p>${pname(G.cur)} takes 1 random card from one of these players.</p>
    ${G.stealFrom.map(q=>{const h=G.heroes[q],a=ABILITIES[h.ability];return `<div class="robrow"><span class="mini-av">${avatarSVG(q,'frown')}</span><div><strong>${h.name} the ${a.name} (${PLAYERS[q].name})</strong>
      <p>${Engine.vp(G,q,false)} points, ${Engine.total(G.players[q].hand)} resource cards, ${G.players[q].dev.length+G.players[q].newDev.length} development cards${G.longest.holder===q?', Longest Road':''}${G.armyHolder===q?', Largest Army':''}</p></div>
      <button class="primary" data-q="${q}">Rob</button></div>`;}).join('')}`,()=>{
    $('#mbox').querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{const q=+b.dataset.q;const r=Engine.steal(G,q);modalKind=null;$('#modal').hidden=true;if(after(r)) stealShow(r);}));
  });
}
function openWinner(){
  Snd.play('win'); fireworks(); react(G.winner,'cheer');
  const prog=recordResult();
  const w=G.winner, rows=G.players.map((pl,i)=>{
    const cs=[...G.B.corners.values()].filter(x=>x.building&&x.building.p===i), vl=cs.filter(x=>x.building.type==='village').length, ct=cs.filter(x=>x.building.type==='city').length;
    const vpc=[...pl.dev,...pl.newDev].filter(x=>x==='vp').length, st=G.stats[i];
    return {i,vp:Engine.vp(G,i,true),vl,ct,vpc,st};
  }).sort((a,b)=>b.vp-a.vp);
  const h=G.heroes[w];
  openModal('over',`<div style="display:flex;gap:14px;align-items:center"><span class="mini-av" style="width:72px;height:72px;box-shadow:0 0 0 4px #ffd970">${avatarSVG(w,'open')}</span>
    <div><p class="kick" style="margin:0;color:var(--muted);font-size:.8rem">Victory after ${Math.ceil(G.turnNo/G.np)} rounds</p><h3 style="font-size:1.7rem;margin:2px 0">${pname(w)} wins!</h3><p style="margin:0">${h.name} the ${ABILITIES[h.ability].name} leads ${pname(w)} to ${Engine.vp(G,w,true)} points.</p></div></div>
    <div style="overflow-x:auto"><table class="wtable"><thead><tr><th>Player</th><th>Points</th><th>Villages</th><th>Cities</th><th>Longest road</th><th>Armies</th><th>VP cards</th><th>Collected</th><th>Stolen</th><th>Battles won</th><th>Trades</th></tr></thead><tbody>
    ${rows.map(r=>`<tr class="${r.i===w?'w':''}"><td><span class="who"><span class="mini-av">${avatarSVG(r.i,r.i===w?'smile':'neutral')}</span>${pname(r.i)}</span></td><td>${r.vp}</td><td>${r.vl}</td><td>${r.ct}</td><td>${G.longest.len[r.i]}${G.longest.holder===r.i?' ★':''}</td><td>${Engine.count(G,r.i,'army')}${G.armyHolder===r.i?' ★':''}</td><td>${r.vpc}</td><td>${r.st.collected}</td><td>${r.st.stole}</td><td>${r.st.won}</td><td>${r.st.trades}</td></tr>`).join('')}
    </tbody></table></div><p class="lbl">★ Longest Road or Largest Army, worth 2 points each.</p>
    ${prog?`<div class="progress"><strong>+${prog.xp} experience</strong>${prog.after>prog.before?` <span class="result good">Level up: level ${prog.after}!</span>`:''}
      <div class="xpbar big"><i style="width:${Math.round(100*levelInfo(profile.xp).into/levelInfo(profile.xp).need)}%"></i></div>
      ${prog.fresh.length||prog.newUnlocks.length?`<div class="chips2">${prog.fresh.map(a=>`<span title="${a.desc}">Achievement: ${a.name}</span>`).join('')}${prog.newUnlocks.map(u=>`<span>Unlocked: ${u.name}</span>`).join('')}</div>`:''}</div>`:''}
    <div class="mact"><button class="btn" id="wclose">Look at the board</button><button class="btn" id="wlobby">Back to the lobby</button><button class="primary" id="wnew">Play again</button></div>`,()=>{
    $('#wlobby').addEventListener('click',()=>{closeModal(true);showLobby('home');});
    $('#mbox').classList.add('wide');
    $('#wclose').addEventListener('click',()=>closeModal(true));
    $('#wnew').addEventListener('click',()=>{closeModal(true);$('#seed').value=randomSeed();showLobby('play');});
  });
}
function openCards(){
  const P=G.players[G.cur], counts={};
  P.dev.forEach(k=>{counts[k]=counts[k]||{ok:0,new:0};counts[k].ok++;}); P.newDev.forEach(k=>{counts[k]=counts[k]||{ok:0,new:0};counts[k].new++;});
  const rows=Object.entries(counts).map(([k,c])=>{
    const can=k!=='vp'&&c.ok>0&&!G.devPlayed&&(k!=='roads'||G.phase==='main');
    const note=k==='vp'?'Counts automatically':c.ok===0?'Bought this turn':G.devPlayed?'One card per turn':(k==='roads'&&G.phase!=='main')?'Roll first':'';
    return `<div class="dev"><strong><span class="mc" style="background:#2c6a70;width:16px;height:21px">${svgI(k)}</span> ${DEV[k].name}${c.ok+c.new>1?` ×${c.ok+c.new}`:''}</strong><p>${DEV[k].desc}${note?` <em>${note}.</em>`:''}</p>${k==='vp'?'<span></span>':`<button class="primary" data-play="${k}" ${can?'':'disabled'}>Play</button>`}</div>`;
  }).join('');
  openModal('cards',`<h3>${pname(G.cur)}’s development cards</h3>${rows||'<p>No cards yet.</p>'}<p class="lbl">${G.deck.length} cards left in the deck.</p><div class="mact"><button class="btn" id="cclose">Close</button></div>`,()=>{
    $('#cclose').addEventListener('click',()=>closeModal());
    $('#mbox').querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>playCard(b.dataset.play,true)));
  });
}
function playCard(k,fromModal){
      if(!G) return;
      const P=G.players[G.cur];
      if(k==='vp'){toast('Victory point cards count toward your score automatically.');return;}
      if(G.phase!=='main'&&G.phase!=='roll'){toast('You can only play cards on your own turn.');return;}
      if(!P.dev.includes(k)){toast(P.newDev.includes(k)?'Cards bought this turn can be played from your next turn.':'You don’t have that card.');return;}
      if(G.devPlayed){toast('Only one development card can be played each turn.');return;}
      if(k==='roads'&&G.phase!=='main'){toast('Roll first, then play Road building.');return;}
      if(!fromModal&&!['plenty','switch'].includes(k)&&!(k==='scout'&&(G.events.wolf||G.events.bandits))){
        openModal('playdev',`<div style="display:flex;gap:14px;align-items:center"><span class="dcard${k==='vp'?' vp':''}" style="width:58px;height:80px;cursor:default;flex:none">${svgI(k)}</span><div><h3>Play ${DEV[k].name}?</h3><p>${DEV[k].desc}</p></div></div><div class="mact"><button class="btn" id="pdno">Keep it</button><button class="primary" id="pdyes">Play card</button></div>`,()=>{
          $('#pdno').addEventListener('click',()=>closeModal());$('#pdyes').addEventListener('click',()=>{closeModal();playCard(k,true);});});
        return;
      }
      if(k==='plenty'){openPlenty();return;}
      if(k==='scout'&&(G.events.wolf||G.events.bandits)){openScout();return;}
      if(k==='switch'){openSwitch();return;}
      closeModal(); const r=Engine.playDev(G,k);
      if(!r.err) Snd.play('card');
      if(after(r)) announce({icon:'D',art:k,color:'#2c6a70',kicker:`${pname(G.cur)} plays a development card`,title:DEV[k].name,text:DEV[k].desc,ms:3500});
      if(r&&!r.err) toast({roads:'Place 2 free roads.',scout:'Click any land tile to move the robber.',march:'Your army can move up to 3 roads this turn, free.',switch:'',reinf:'Click a highlighted road to place your free army.',rally:'+1 strength in your next battle this turn.',catch:'Your fishermen bring in their catch.'}[k]||'');
}
function openScout(){
  const opts=['robber',...(G.events.wolf?['wolf']:[]),...(G.events.bandits?['bandits']:[])];
  openModal('scout',`<h3>Scout</h3><p>What do you want to move?</p><div class="mact" style="justify-content:flex-start">${opts.map(o=>`<button class="btn" data-t="${o}">The ${o}</button>`).join('')}</div><div class="mact"><button class="btn" id="sclose">Cancel</button></div>`,()=>{
    $('#sclose').addEventListener('click',()=>closeModal());
    $('#mbox').querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>{closeModal();const r=Engine.playDev(G,'scout',{target:b.dataset.t});if(after(r)) toast(`Click any land tile to move the ${b.dataset.t}.`);}));
  });
}
function openSwitch(){
  const h=G.heroes[G.cur];
  openModal('switch',`<h3>Ability switch</h3><p>${h.name} is a ${ABILITIES[h.ability].name}. Choose a new ability.</p>${Object.entries(ABILITIES).filter(([k])=>k!==h.ability).map(([k,a])=>`<div class="dev"><strong><span class="lt" style="background:${a.color};vertical-align:1px">${a.letter}</span> ${a.name}</strong><p>${a.desc}</p><button class="primary" data-ab="${k}">Choose</button></div>`).join('')}<div class="mact"><button class="btn" id="swclose">Cancel</button></div>`,()=>{
    $('#swclose').addEventListener('click',()=>closeModal());
    $('#mbox').querySelectorAll('[data-ab]').forEach(b=>b.addEventListener('click',()=>{const r=Engine.playDev(G,'switch',{ability:b.dataset.ab});if(r.err){toast(r.err);return;}closeModal();after(r);toast(`${h.name} is now a ${ABILITIES[b.dataset.ab].name}.`);}));
  });
}
function heroCard(p){const h=G.heroes[p],a=ABILITIES[h.ability];return `<h3>${h.name} the ${a.name}</h3><p>${a.desc}</p>${h.wounded!==false?'<p class="m">Wounded: resting until the end of their next turn.</p>':''}`;}
function heroReach(p,e){
  const a=G.heroes[p].ability, ts=e.tiles.filter(t=>!t.rim);
  if(a==='farmer'){const f=ts.filter(t=>t.terrain==='fields');return f.length?`In reach: fields ${f.map(t=>t.num).join(' and ')}.`:'No fields here.';}
  if(a==='herder'){const f=ts.filter(t=>t.terrain==='pasture');return f.length?`In reach: pasture ${f.map(t=>t.num).join(' and ')}.`:'No pasture here.';}
  if(a==='angler'){return ts.some(t=>t.terrain==='lake')?'Next to a lake: your fishermen there catch +1.':'Not next to a lake.';}
  if(a==='merchant'){const c=[e.a,e.b].map(k=>G.B.corners.get(k)).find(c=>c.port);return c?`Leads into a ${c.port==='any'?'3:1':'2:1 '+rname(c.port)} trade post.`:'No trade post here.';}
  if(a==='warlord'){return e.army&&e.army.p===p?'Your army here gets +1 strength.':'Stand with an army to give it +1 strength.';}
  return 'Engineers’ bridge discount works anywhere.';
}
function openPlenty(){
  const pick=[];
  const draw=()=>openModal('plenty',`<h3>Year of plenty</h3><p>Choose 2 resources from the bank. You can pick the same one twice.</p>
    <div class="rgrid">${RKEYS.map(r=>`<button class="rbtn" data-r="${r}" ${G.bank[r]?'':'disabled'}><i class="band" style="background:${RES[r].color}"></i>${svgI(r,darker(RES[r].color))}<span class="rn">${RES[r].name}</span><small>${pick.filter(x=>x===r).length?'×'+pick.filter(x=>x===r).length:'bank '+G.bank[r]}</small></button>`).join('')}</div>
    <div class="mact"><button class="btn" id="pclear">Clear</button><button class="primary" id="pok" ${pick.length===2?'':'disabled'}>Take ${pick.length?pick.map(rname).join(' and '):'2 resources'}</button></div>`,()=>{
      $('#mbox').querySelectorAll('[data-r]').forEach(b=>b.addEventListener('click',()=>{if(pick.length<2){pick.push(b.dataset.r);draw();}}));
      $('#pclear').addEventListener('click',()=>{pick.length=0;draw();});
      $('#pok').addEventListener('click',()=>{const r=Engine.playDev(G,'plenty',{res:pick});if(r.err){toast(r.err);return;}closeModal();after(r);});
    });
  draw();
}
const tradeState={give:null,get:null,offer:{give:{},get:{}},partner:null};
function openTrade(tab){
  const p=G.cur, hand=G.players[p].hand, rates=Engine.rates(G,p), S=tradeState;
  let body;
  if(tab==='bank'){
    const rate=S.give?rates[S.give]:null, ok=S.give&&S.get&&S.give!==S.get&&hand[S.give]>=rate&&G.bank[S.get]>0;
    body=`<p class="lbl">You give</p><div class="rgrid">${RKEYS.map(r=>`<button class="rbtn" data-give="${r}" aria-pressed="${S.give===r}" ${hand[r]>=rates[r]?'':'disabled'}><i class="band" style="background:${RES[r].color}"></i>${svgI(r,darker(RES[r].color))}<span class="rn">${RES[r].name}</span><small>${rates[r]}:1, you have ${hand[r]}</small></button>`).join('')}</div>
      <p class="lbl">You get</p><div class="rgrid">${RKEYS.map(r=>`<button class="rbtn" data-get="${r}" aria-pressed="${S.get===r}" ${G.bank[r]&&r!==S.give?'':'disabled'}><i class="band" style="background:${RES[r].color}"></i>${svgI(r,darker(RES[r].color))}<span class="rn">${RES[r].name}</span><small>bank ${G.bank[r]}</small></button>`).join('')}</div>
      <p class="m" style="color:var(--muted);font-size:.86rem">Rates are 4:1, or better with a village on a trade post or river port.</p>
      <div class="mact"><button class="btn" id="tclose">Close</button><button class="primary" id="tok" ${ok?'':'disabled'}>${ok?`Trade ${rate} ${rname(S.give)} for 1 ${rname(S.get)}`:'Choose what to trade'}</button></div>`;
  } else if(nego&&nego.from===p){
    body=`<p>You give ${offerCards(nego.give)} and want ${offerCards(nego.get)}.</p><div class="resps">${Object.keys(nego.responses).map(q=>respRow(+q)).join('')}</div>
      <div class="mact"><button class="btn" id="tclose">Close</button><button class="btn" id="tcancel">Cancel offer</button></div>`;
  } else {
    const sum=o=>RKEYS.reduce((s,r)=>s+(o[r]||0),0), ok=sum(S.offer.give)&&sum(S.offer.get);
    body=`<div class="tcols"><div><p class="lbl">You give <small>(your cards)</small></p>${stepper('g',S.offer.give,hand)}</div>
      <div><p class="lbl">You want</p>${stepper('t',S.offer.get,null)}</div></div>
      <p style="color:var(--muted);font-size:.86rem">Your offer goes to every other player. Each can accept, decline or make a counter-offer, and you choose who to trade with.</p>
      <div class="mact"><button class="btn" id="tclose">Close</button><button class="primary" id="tsend" ${ok?'':'disabled'}>Offer to everyone</button></div>`;
  }
  openModal('trade',`<h3>Trade</h3><div class="tabs" role="group"><button data-tab="bank" aria-pressed="${tab==='bank'}">Bank and posts</button><button data-tab="players" aria-pressed="${tab==='players'}">Players</button></div>${body}`,()=>{
    $('#mbox').querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>openTrade(b.dataset.tab)));
    $('#tclose').addEventListener('click',()=>closeModal());
    if(tab==='bank'){
      $('#mbox').querySelectorAll('[data-give]').forEach(b=>b.addEventListener('click',()=>{S.give=b.dataset.give;if(S.get===S.give)S.get=null;openTrade('bank');}));
      $('#mbox').querySelectorAll('[data-get]').forEach(b=>b.addEventListener('click',()=>{S.get=b.dataset.get;openTrade('bank');}));
      $('#tok').addEventListener('click',()=>{const r=Engine.bankTrade(G,S.give,S.get);if(r.err){toast(r.err);return;}Snd.play('coin');after(r);if(G.players[p].hand[S.give]<Engine.rates(G,p)[S.give])S.give=null;openTrade('bank');});
    } else if(nego&&nego.from===p){
      bindResp(); $('#tcancel').addEventListener('click',()=>{if(NET.mode==='client'&&nego&&nego.viaHost) netSend(NET.host,{t:'cancel'});nego=null;negoEnded();openTrade('players');});
    } else {
      bindStepper('g',S.offer.give,hand,()=>openTrade('players'));
      bindStepper('t',S.offer.get,null,()=>openTrade('players'));
      $('#tsend').addEventListener('click',()=>{Snd.play('offer');startNego(p,S.offer.give,S.offer.get);S.offer={give:{},get:{}};});
    }
  });
}

/* ---- panel & start ---- */
/* =====================================================================
   SAVE AND RESUME: every engine action is recorded and the game is rebuilt by replaying them.
   The rules engine takes all its randomness from the game seed, so a replay is exact.
   ===================================================================== */
const SAVE_KEY='hexworld.save';
const MUTATORS=['placeVillage','placeRoad','placeCity','placeFisher','raiseArmy','moveArmy','moveHero','buyDev','playDev','roll','discard','moveRobber','steal','bankTrade','playerTrade','endTurn'];
// Ask before spending, unless switched off. Returns true to go ahead now; otherwise the action runs from the dialog.
const SURE_NAME={road:'a road',bridge:'a bridge',village:'a village',city:'a city',fisher:'a fisherman',army:'an army',dev:'a development card'};
const canAffordUi=c=>G&&RKEYS.every(r=>(G.players[G.cur].hand[r]||0)>=(c[r]||0));
function sure(kind,doIt){
  if(!uiPrefs.confirm) return true;
  const cost=Engine.costFor(G,G.cur,kind)||COSTS[kind];
  if(!canAffordUi(cost)) return true;
  openModal('sure',`<div class="cfm"><span class="lbic" style="width:52px;height:52px;flex:none">${svgI(kind==='dev'?'dev':kind==='fisher'?'fish':kind==='army'?'swords':kind==='bridge'?'road':kind==='city'?'vp':'road')}</span>
    <div><h3 style="margin:0">${kind==='dev'?'Buy':'Build'} ${SURE_NAME[kind]}${kind==='dev'?'':' here'}?</h3><div class="costs2">${costRow(cost)}</div></div></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="sureOff"> Don’t ask again (switch back on in the Menu)</label>
    <div class="mact"><button class="btn" id="sureNo">Cancel</button><button class="primary" id="sureYes">${kind==='dev'?'Buy':'Build'}</button></div>`,()=>{
    $('#sureNo').addEventListener('click',()=>closeModal());
    $('#sureYes').addEventListener('click',()=>{if($('#sureOff').checked){uiPrefs.confirm=false;saveUi();applyUi();}closeModal();doIt();});
  });
  return false;
}
const UI_ACTS={clearFree:G=>{G.freeRoads=0;G.freeArmy=0;}};
let replaying=false, saveMeta=null, saveTimer=null, startRecordingAndShare=false;
function encArg(a){
  if(a&&typeof a==='object'){
    if(a.key!==undefined&&G){if(G.B.corners.get(a.key)===a) return {__c:a.key};if(G.B.edges.get(a.key)===a) return {__e:a.key};if(G.B.tileMap.get(a.key)===a) return {__t:a.key};}
    if(Array.isArray(a)) return a.map(encArg);
    const o={}; for(const k in a) o[k]=encArg(a[k]); return o;
  }
  return a;
}
function decArg(a){
  if(a&&typeof a==='object'){
    if(a.__c!==undefined) return G.B.corners.get(a.__c); if(a.__e!==undefined) return G.B.edges.get(a.__e); if(a.__t!==undefined) return G.B.tileMap.get(a.__t);
    if(Array.isArray(a)) return a.map(decArg);
    const o={}; for(const k in a) o[k]=decArg(a[k]); return o;
  }
  return a;
}
for(const name of MUTATORS){
  const orig=Engine[name];
  Engine[name]=function(g,...args){
    if(NET.mode==='client'&&!replaying&&g===G){if(NET.lost) return {err:'The connection to the host was lost.'};netReq(name,args);return {pending:true};}
    const r=orig(g,...args);
    if(!replaying&&g===G&&saveMeta&&!(r&&r.err)){const a=[name,args.map(encArg)];G.actions.push(a);scheduleSave();if(NET.mode==='host') netBroadcast({t:'act',a});}
    return r;
  };
}
function recordUi(name){if(NET.mode==='client'){netSend(NET.host,{t:'req',a:['ui:'+name,[]]});return;}if(!replaying&&G&&saveMeta){UI_ACTS[name](G);G.actions.push(['ui:'+name,[]]);scheduleSave();if(NET.mode==='host') netBroadcast({t:'act',a:['ui:'+name,[]]});}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(writeSave,250);}
function writeSave(){
  if(!G||!saveMeta) return;
  if(G.phase==='over'){clearSave();return;}
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(Object.assign({},saveMeta,{actions:G.actions,you:G.you,savedAt:Date.now(),round:Math.max(1,Math.ceil(G.turnNo/G.np)),
    names:G.heroes.map(h=>h.name),points:G.players.map((_,i)=>Engine.vp(G,i,false))})));}catch(e){}
}
function clearSave(){try{localStorage.removeItem(SAVE_KEY);}catch(e){}}
function readSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return s&&s.ruleset===RULESET?s:null;}catch(e){return null;}}
function startRecording(meta){saveMeta=meta;G.actions=[];writeSave();}
function loadSaved(){
  const sv=readSave(); if(!sv){toast('That saved game can no longer be loaded.','err');return false;}
  sv.colors.forEach((c,i)=>{PLAYERS[i]=Object.assign({},PALETTE.find(x=>x.name===c));});
  setLabels(sv.heroes);
  const B=Board.generate(sv.seed,sv.R,sv.balanced,sv.style||'classic');
  replaying=true;
  try{
    G=Engine.newGame(B,sv.np,sv.seed,sv.heroes,sv.opts);
    for(const [name,args] of sv.actions){
      if(name.startsWith('ui:')){UI_ACTS[name.slice(3)](G);continue;}
      const r=Engine[name](G,...args.map(decArg)); if(r&&r.err) throw new Error(name+': '+r.err);
    }
  }catch(e){replaying=false;console.warn('Replay failed',e);toast('Sorry, that saved game could not be restored.','err');clearSave();G=null;return false;}
  replaying=false;
  G.you=sv.you; G.actions=sv.actions; saveMeta={ruleset:sv.ruleset,seed:sv.seed,R:sv.R,style:sv.style,balanced:sv.balanced,np:sv.np,heroes:sv.heroes,opts:sv.opts,colors:sv.colors};
  hideLobby(); curR=B.R;
  buildScene(B); renderPieces(G); frameCamera(B.R);
  drawDie($('#d1'),0); drawDie($('#d2'),0);
  refresh.prev=[]; $('#evbanner').hidden=true; nego=null; mode=null; selEdge=null; topFor=null;
  refresh(); toast(`Welcome back! Round ${Math.max(1,Math.ceil(G.turnNo/G.np))}, ${pname(G.cur)} to play.`);
  return true;
}

/* =====================================================================
   ONLINE PLAY (host in the browser): the host runs the real game; guests keep an exact copy
   by replaying every move the host sends. Guests send their moves to the host, which checks
   them, applies them and passes them on. Players connect directly (WebRTC via PeerJS).
   ===================================================================== */
const NET={mode:null,peer:null,conns:[],host:null,code:'',mySeat:null,remote:new Set(),guests:[],queue:[],busy:false};
const ROOM_PREFIX='highhorn-room-';
const netOK=()=>typeof Peer!=='undefined';
function isRemote(p){return NET.mode==='host'?NET.remote.has(p):NET.mode==='client'?p!==NET.mySeat:false;}
function isAI(p){return !!(G&&G.players[p]&&G.players[p].bot)&&NET.mode!=='client';}
function roomCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++) s+=A[Math.floor(Math.random()*A.length)];return s;}
function netSend(conn,msg){try{conn.open&&conn.send(msg);}catch(e){}}
function netBroadcast(msg){NET.conns.forEach(c=>netSend(c.conn,msg));}

/* ---- host ---- */
function hostRoom(){
  if(!netOK()){toast('Online play needs the website version of Highhorn.','err');return;}
  if(NET.peer) return;
  NET.code=roomCode(); NET.mode='host';
  const peer=new Peer(ROOM_PREFIX+NET.code); NET.peer=peer;
  peer.on('open',()=>{renderOnline();toast(`Room ${NET.code} is open. Share the code with your friends.`);});
  peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();NET.peer=null;hostRoom();return;}toast('Online error: '+(e.type||e.message),'err');});
  peer.on('connection',conn=>{
    conn.on('data',m=>hostReceive(conn,m));
    conn.on('close',()=>guestLeft(conn));
  });
  renderOnline();
}
function hostReceive(conn,m){
  if(!m||typeof m!=='object') return;
  if(m.t==='hello'){
    if(G&&saveMeta&&G.phase!=='over'&&!$('#lobbyScr').hidden===false){netSend(conn,{t:'refused',why:'The game has already started.'});return;}
    const g={conn,name:String(m.name||'Guest').slice(0,16),hero:m.hero,seat:null};
    NET.conns.push(g); assignGuests(); netSend(conn,{t:'welcome',code:NET.code}); hostLobbyUpdate();
    toast(`${g.name} joined the room.`); Snd.play('offer'); return;
  }
  if(['propose','resp','pick','cancel'].includes(m.t)){
    const g=NET.conns.find(x=>x.conn===conn); if(!g||g.seat===null||!G) return;
    if(m.t==='propose'&&G.cur===g.seat&&G.phase==='main'&&!nego){Snd.play('offer');startNego(g.seat,m.give||{},m.get||{});}
    if(m.t==='resp'&&nego&&nego.responses[g.seat]&&nego.responses[g.seat].r==='pending'){
      nego.responses[g.seat]=m.r==='counter'?{r:'counter',give:m.give||{},get:m.get||{}}:{r:m.r==='accept'?'accept':'decline'};
      Snd.play(m.r==='accept'?'coin':m.r==='counter'?'offer':'decline'); react(g.seat,m.r==='accept'?'happy':m.r==='counter'?'think':'no'); negoUpdate();}
    if(m.t==='pick'&&nego&&nego.from===g.seat&&nego.responses[m.q]) execNego(+m.q,!!m.counter);
    if(m.t==='cancel'&&nego&&nego.from===g.seat){nego=null;negoEnded();if(modalKind==='incoming') closeModal(true);}
    return;
  }
  if(m.t==='req'){
    const g=NET.conns.find(x=>x.conn===conn); if(!g||g.seat===null||!G) return;
    const [name,args]=m.a||[];
    if(!MUTATORS.includes(name)&&name!=='ui:clearFree') return;
    const actor=G.phase==='discard'?G.discard[0].p:G.cur;
    if(actor!==g.seat){netSend(conn,{t:'err',msg:'It isn’t your turn.'});return;}
    netQueue({name,args,from:g.seat});
  }
}
// Guests fill the seats marked "Online" in Play, in order
function assignGuests(){
  if(!lobby||!lobby[0]||!lobby[0].type) return;
  const seats=lobby.map((s,i)=>s.type==='online'?i:-1).filter(i=>i>=0);
  NET.conns.forEach(g=>{g.seat=null;});
  NET.conns.forEach((g,k)=>{if(k<seats.length){g.seat=seats[k];const s=lobby[seats[k]];
    if(g.hero&&ABILITIES[g.hero.ability]) s.hero={name:String(g.hero.name||g.name).slice(0,16),ability:g.hero.ability,look:g.hero.look||{}};s.guestName=g.name;}});
  if(lbSec==='play') renderSeats();
}
function hostLobbyUpdate(){
  const seats=(lobby||[]).map((s,i)=>({seat:i,color:s.color,type:s.type,name:s.type==='you'?profile.hero.name:(s.hero&&s.hero.name)||'',who:s.type==='online'?(NET.conns.find(g=>g.seat===i)||{}).name||'(waiting)':s.type}));
  NET.conns.forEach(g=>netSend(g.conn,{t:'lobby',seats,you:g.seat,code:NET.code}));
  renderOnline();
}
function guestLeft(conn){
  const g=NET.conns.find(x=>x.conn===conn); NET.conns=NET.conns.filter(x=>x.conn!==conn); if(!g) return;
  if(G&&g.seat!==null&&NET.remote.has(g.seat)&&G.phase!=='over'){NET.remote.delete(g.seat);G.players[g.seat].bot=true;toast(`${g.name} left. A bot takes over their seat.`);refresh();scheduleBot();}
  else{assignGuests();hostLobbyUpdate();toast(`${g.name} left the room.`);}
}
// Called by beginGame on the host once the game exists
function hostStartGame(){
  if(NET.mode!=='host') return;
  NET.remote=new Set(NET.conns.filter(g=>g.seat!==null).map(g=>g.seat));
  NET.conns.forEach(g=>{if(g.seat!==null) netSend(g.conn,{t:'start',meta:saveMeta,seat:g.seat});else netSend(g.conn,{t:'refused',why:'There was no seat for you in this game.'});});
}

/* ---- guest ---- */
function joinRoom(code){
  if(!netOK()){toast('Online play needs the website version of Highhorn.','err');return;}
  code=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); if(code.length<4){toast('Enter the room code from the host.','err');return;}
  if(NET.peer) NET.peer.destroy();
  NET.mode='client'; NET.code=code; const peer=new Peer(); NET.peer=peer;
  peer.on('open',()=>{const conn=peer.connect(ROOM_PREFIX+code,{reliable:true}); NET.host=conn;
    conn.on('open',()=>{netSend(conn,{t:'hello',name:profile.hero.name,hero:profile.hero});});
    conn.on('data',clientReceive);
    conn.on('close',()=>{toast('The connection to the host was lost. The game is paused.','err');NET.lost=true;refresh();});
  });
  peer.on('error',e=>toast(e.type==='peer-unavailable'?`No room with the code ${code}. Check the code and try again.`:'Online error: '+(e.type||e.message),'err'));
  NET.lobby=null; renderOnline();
}
function clientReceive(m){
  if(!m||typeof m!=='object') return;
  if(m.t==='welcome'){toast(`Joined room ${m.code}. Waiting for the host to start.`);Snd.play('offer');}
  if(m.t==='lobby'){NET.lobby=m;NET.mySeat=m.you;renderOnline();}
  if(m.t==='refused'){toast(m.why,'err');leaveOnline();}
  if(m.t==='err'){NET.pendingReq=0;toast(m.msg,'err');}
  if(m.t==='start') clientStart(m.meta,m.seat);
  if(m.t==='offer'&&G){nego={from:m.from,give:m.give,get:m.get,responses:{[NET.mySeat]:{r:'pending'}},mirror:true};Snd.play('offer');openIncoming();}
  if(m.t==='nego'&&nego&&nego.viaHost){nego.responses=m.responses;if(modalKind==='trade') openTrade('players');}
  if(m.t==='negoEnd'&&nego&&(nego.mirror||nego.viaHost)){const was=nego;nego=null;if(modalKind==='incoming') closeModal(true);if(was.viaHost&&modalKind==='trade') openTrade('players');}
  if(m.t==='act'&&G){NET.pendingReq=0;netQueue({name:m.a[0],args:m.a[1],echo:true});}
}
function clientStart(meta,seat){
  NET.mySeat=seat;
  meta.colors.forEach((c,i)=>{PLAYERS[i]=Object.assign({},PALETTE.find(x=>x.name===c));});
  setLabels(meta.heroes);
  const B=Board.generate(meta.seed,meta.R,meta.balanced,meta.style||'classic');
  replaying=true; G=Engine.newGame(B,meta.np,meta.seed,meta.heroes,meta.opts); replaying=false;
  G.you=seat; G.actions=[]; saveMeta=null;
  hideLobby(); curR=B.R; buildScene(B); renderPieces(G); frameCamera(B.R);
  drawDie($('#d1'),0); drawDie($('#d2'),0); topFor=null; refresh.prev=[];
  toast(`The game begins! You are ${pname(seat)}.`); Snd.play('fanfare');
}
// One move at a time: further moves wait until the host has answered the last one (or 4 seconds pass)
function netReq(name,args){if(NET.pendingReq&&Date.now()-NET.pendingReq<4000) return;NET.pendingReq=Date.now();netSend(NET.host,{t:'req',a:[name,args.map(encArg)]});}
function leaveOnline(){try{NET.peer&&NET.peer.destroy();}catch(e){}Object.assign(NET,{mode:null,peer:null,conns:[],host:null,code:'',mySeat:null,remote:new Set(),lobby:null,queue:[],busy:false});renderOnline();}

/* ---- applying moves in order, with the same animations everyone sees ---- */
function netQueue(job){NET.queue.push(job);if(!NET.busy) netNext();}
function netNext(){
  const job=NET.queue.shift(); if(!job){NET.busy=false;return;}
  NET.busy=true;
  const done=()=>setTimeout(netNext,30);
  try{applyAndPresent(job,done);}catch(e){console.warn('online move failed',e);done();}
}
function applyAndPresent(job,done){
  const {name,echo}=job, args=job.args.map(decArg);
  const exec=()=>{if(name.startsWith('ui:')){if(echo) UI_ACTS[name.slice(3)](G); else recordUi(name.slice(3));return {};}
    if(echo){replaying=true;try{return Engine[name](G,...args);}finally{replaying=false;}} return Engine[name](G,...args);};
  const mine=echo&&(G.phase==='discard'?G.discard[0].p:G.cur)===NET.mySeat, actor=G.phase==='discard'?G.discard[0].p:G.cur;
  if(name==='moveArmy'){
    const [from,to]=args, info=Engine.moveInfo(G,from,to);
    if(info.battle){battleAnim(from,to,()=>{const r=exec();after(r);done();});return;}
    const fromPos=edgeMid(from.key); const r=exec(); if(!r.err) setTimeout(()=>walkArmy(fromPos,to),0); after(r); done(); return;
  }
  if(name==='placeVillage'||name==='placeCity') justBuilt=args[0].key;
  if(name==='placeRoad') justBuilt=args[0].key;
  if(name==='placeFisher') justBuilt='f'+args[0].key;
  if(name==='raiseArmy') justBuilt='a'+args[0].key;
  if(name==='roll'){rolling=true;refresh();Snd.play('dice');const r=exec();if(r.err){rolling=false;after(r);done();return;}rollVisual(r);setTimeout(done,reduceMotion()?0:1050);return;}
  const r=exec();
  if(r&&r.err){if(!echo) netSendTo(job.from,{t:'err',msg:r.err});done();return;}
  switch(name){
    case 'buyDev': if(echo&&mine) revealCard(r.card); else toast(`${pname(actor)} buys a development card.`); break;
    case 'playDev': Snd.play('card'); if(!mine) announce({icon:'D',art:args[0],color:'#2c6a70',kicker:`${pname(actor)} plays a development card`,title:DEV[args[0]].name,text:DEV[args[0]].desc,ms:3000}); break;
    case 'bankTrade': Snd.play('coin'); if(!mine) toast(`${pname(actor)} trades with the bank.`); break;
    case 'playerTrade': Snd.play('coin'); break;
    case 'moveHero': if(r.chased) eventBanner(r.chased,true,`${G.heroes[actor].name} chased the ${r.chased==='wolf'?'wolf':'bandits'} away.`); break;
    case 'endTurn': drawDie($('#d1'),0); drawDie($('#d2'),0); if(nego){nego=null;negoEnded();if(modalKind==='incoming') closeModal(true);} break;
  }
  after(r);
  if(r&&r.gains&&(name==='placeVillage')) r.gains.forEach((g,i)=>collect(g,i));
  if(r&&r.victim!==undefined&&(name==='moveRobber'||name==='steal')) stealShow(r);
  done();
}
function netSendTo(seat,msg){const g=NET.conns.find(x=>x.seat===seat);if(g) netSend(g.conn,msg);}

/* ---- lobby: Online section ---- */
function renderOnline(){
  const el=$('#lb-online'); if(!el) return;
  if(!netOK()){el.innerHTML=`<h3>Online play</h3><p>Online play works on the website version of Highhorn, where players can connect to each other. In this preview it isn’t available.</p>`;return;}
  if(NET.mode==='host'){
    const online=(lobby||[]).filter(s=>s.type==='online').length;
    el.innerHTML=`<h3>Hosting a game</h3><p>Share this room code with your friends. They open Highhorn, choose <strong>Online</strong> and enter it.</p>
      <div class="roomcode">${NET.code||'…'}</div>
      <p class="m">${online?`${NET.conns.length} of ${online} online ${online===1?'seat':'seats'} filled.`:'In Play, set the seats your friends will take to <strong>Online</strong>.'} Joined: ${NET.conns.map(g=>`<strong>${esc(g.name)}</strong>`).join(', ')||'nobody yet'}.</p>
      <div class="mact" style="justify-content:flex-start"><button class="primary" id="onPlay">Set up seats and start</button><button class="btn" id="onClose">Close the room</button></div>
      <p class="m" style="font-size:.85rem">Keep this tab open while you play: your browser runs the game for everyone.</p>`;
    $('#onPlay').addEventListener('click',()=>renderLobby('play'));
    $('#onClose').addEventListener('click',()=>{netBroadcast({t:'refused',why:'The host closed the room.'});leaveOnline();});
    return;
  }
  if(NET.mode==='client'){
    const L=NET.lobby;
    el.innerHTML=`<h3>Room ${esc(NET.code)}</h3>${L?`<p>You’re in! Waiting for the host to start the game.</p>
      <div class="olist">${L.seats.map(s=>`<div><span class="sw" style="background:${(PALETTE.find(c=>c.name===s.color)||{}).css}"></span> ${s.seat===L.you?'<strong>You</strong>':esc(s.who==='you'?'Host':s.who==='bot'?'Bot':s.who==='guest'?'Guest at the host':s.who)}</div>`).join('')}</div>`
      :'<p>Connecting…</p>'}<div class="mact" style="justify-content:flex-start"><button class="btn" id="onLeave">Leave</button></div>`;
    $('#onLeave').addEventListener('click',leaveOnline);
    return;
  }
  el.innerHTML=`<h3>Online play</h3><p>Play with friends on their own devices. One player hosts, and the others join with a room code.</p>
    <div class="lbgrid">
      <div class="lbcard"><strong>Host a game</strong><span>Open a room and get a code to share. Your browser runs the game, so keep the tab open while you play.</span><button class="primary" id="onHost" style="margin-top:8px">Open a room</button></div>
      <div class="lbcard"><strong>Join a game</strong><span>Enter the code from the host.</span><input id="onCode" maxlength="8" placeholder="Room code" autocomplete="off" style="text-transform:uppercase;margin-top:8px;font-size:1.2rem;letter-spacing:.15em"><button class="primary" id="onJoin" style="margin-top:8px">Join</button></div>
    </div>
    <p class="m" style="font-size:.85rem;margin-top:10px">Players connect directly to each other. A few strict networks (some offices and schools) block this.</p>`;
  $('#onHost').addEventListener('click',hostRoom);
  $('#onJoin').addEventListener('click',()=>joinRoom($('#onCode').value));
  $('#onCode').addEventListener('keydown',e=>{if(e.key==='Enter') joinRoom($('#onCode').value);});
}

/* =====================================================================
   HOW TO PLAY and first-game tips
   ===================================================================== */
function costRow(c){return Object.entries(c).map(([r,n])=>Array.from({length:n},()=>`<span class="oc sm" style="--rc:${RES[r].color}" title="${RES[r].name}">${svgI(r,darker(RES[r].color))}</span>`).join('')).join('');}
function renderRules(){
  const sec=(icon,title,body)=>`<div class="rcard"><div class="rch"><span class="lbic">${svgI(icon)}</span><h4>${title}</h4></div>${body}</div>`;
  $('#lb-rules').innerHTML=`<div class="rintro"><h3>How to play Highhorn</h3><p>Settle the highlands, gather resources, build villages and cities, and be the first to reach <strong>${WIN_VP} points</strong>.</p>
    <label class="check" style="margin-top:6px"><input type="checkbox" id="tipsOn" ${profile.tipsOff?'':'checked'}> Show tips during games</label> <button class="btn sm" id="tipsReset">Show all tips again</button></div>
    <div class="rgrid2">
    ${sec('turn','Your turn',`<ol><li><strong>Roll the dice.</strong> Every tile with that number pays its resource to each village (1) and city (2) on its corners.</li><li><strong>Trade</strong> with the bank (4 for 1), at trade posts you own (3 for 1 or 2 for 1), or with other players.</li><li><strong>Build</strong>, buy development cards, raise and move armies, and move your hero.</li><li><strong>End your turn.</strong></li></ol>`)}
    ${sec('vp','Winning',`<p>First to ${WIN_VP} points wins.</p><ul><li>Village: 1 point. City: 2 points.</li><li>Longest Road (5 or more): 2 points.</li><li>Largest Army (3 or more armies on the board): 2 points.</li><li>Victory point cards: 1 point each, kept secret.</li></ul>`)}
    ${sec('dev','What things cost',`<div class="costs">${[['Road','road'],['Bridge','bridge'],['Village','village'],['City','city'],['Fisherman','fisher'],['Army','army'],['Development card','dev']].map(([n,k])=>`<div><span>${n}</span><span>${costRow(COSTS[k])}</span></div>`).join('')}</div>`)}
    ${sec('road','Building',`<ul><li>Roads connect to your roads, villages or cities. Bridges cross rivers.</li><li>Villages go on corners at least two roads from any other building, and must touch your road.</li><li>A city upgrades one of your villages.</li><li>Fishermen work from a village or city beside a lake.</li></ul>`)}
    ${sec('robber','The robber and 7s',`<p>On a 7, anyone holding more than 7 cards discards half. The roller moves the robber to a tile, which stops it paying, and steals a card from someone with a building there.</p>`)}
    ${sec('swords','Armies and battles',`<ul><li>Raise armies on your roads next to your cities.</li><li>One army moves per turn, up to 2 steps. The first step along your own roads or over <strong>open ground</strong> (paths with no road) is free; a second step costs 1 fish. Enemy roads cost fish from the first step. Rivers need a bridge.</li><li>Moving onto an enemy army starts a battle. Your armies on touching roads support the attack. <strong>The winner plunders 1 random card from the loser.</strong></li><li>Armies next to an enemy building besiege it: it produces nothing, and <strong>the besieger takes 1 of its resource as tribute</strong> each time it would produce.</li><li>A red warning sign appears over your building when an enemy army is close enough to besiege it next turn.</li></ul>`)}
    ${sec('hero','Heroes',`<p>Your hero walks your roads (2 moves a turn, free) and helps the tiles beside their road. Each ability also has its own events.</p><ul>${Object.values(ABILITIES).map(a=>`<li><strong>${a.name}:</strong> ${a.desc}</li>`).join('')}</ul>`)}
    ${sec('wolf','Events',`<p>With night rules on, wolves and bandits only come at night and leave at dawn. A full day passes every 6 rounds.</p><p>Rolling 2 or 12 brings an event: wolves on a pasture, bandits in the hills, storms on the lakes, floods, or a lucky event for one kind of hero. Event cards show what is happening and how long it lasts.</p>`)}
    ${sec('fish','Fishing and lakes',`<p>Each lake has a number. A city beside a lake catches 1 fish on its roll; a fisherman adds 1 more. Fish pays for army marches and trades like any resource, but is not used to build.</p>`)}
    </div>`;
  $('#tipsOn').addEventListener('change',e=>{profile.tipsOff=!e.target.checked;saveProfile();});
  $('#tipsReset').addEventListener('click',()=>{profile.tipsSeen={};profile.tipsOff=false;saveProfile();$('#tipsOn').checked=true;toast('Tips will show again in your next game.');});
}
const has=(p,c)=>RKEYS.every(r=>(G.players[p].hand[r]||0)>=(c[r]||0));
const TIPS=[
  {id:'setupVillage',when:p=>G.phase==='setup'&&G.setup.step==='village',text:'Place your first village on a corner. The best corners touch tiles whose numbers roll often: 6 and 8 most, then 5 and 9. The dots under each number show the odds.'},
  {id:'setupRoad',when:p=>G.phase==='setup'&&G.setup.step==='road',text:'Now place a road from your village. Roads lead to new village spots, and villages must be at least two roads apart.'},
  {id:'roll',when:p=>G.phase==='roll',text:'Each turn starts with a roll. Every tile with that number pays its resource to each village (1) and city (2) on its corners. Tap Roll.'},
  {id:'build',when:p=>G.phase==='main'&&(has(p,COSTS.road)||has(p,COSTS.village)),text:'You have enough to build. Roads cost timber and clay; a village costs timber, clay, leather and wheat. Press and hold any action to see its cost.'},
  {id:'trade',when:p=>G.phase==='main'&&Engine.total(G.players[p].hand)>=5,text:'Short of something? Trade 4 for 1 with the bank, cheaper at trade posts you own, or offer a trade to the other players.'},
  {id:'robber',when:p=>G.phase==='robber',text:'A 7! Move the robber onto a tile: it stops paying until the robber moves on, and you steal a card from someone with a building there.'},
  {id:'hero',when:p=>G.phase==='main'&&G.turnNo>G.np*2,text:'Your hero walks your roads for free, 2 moves a turn, and helps the tiles beside their road. Hover over a hero to see their ability.'},
  {id:'army',when:p=>G.phase==='main'&&has(p,COSTS.army)&&Engine.count(G,p,'city')>0,text:'You can raise an army on your road next to a city. Armies protect roads, besiege enemy buildings and chase off wolves and bandits.'},
  {id:'dev',when:p=>G.phase==='main'&&has(p,COSTS.dev),text:'Development cards give a surprise: victory points, free roads, extra resources and more. You can play one per turn, from the turn after you buy it.'},
];
let tipShown=null;
function checkTips(){
  const box=$('#tipbox'); if(!box) return;
  if(!G||profile.tipsOff||!$('#lobbyScr').hidden||isBot(G.cur)||G.phase==='over'||!$('#modal').hidden){box.hidden=true;return;}
  profile.tipsSeen=profile.tipsSeen||{};
  const t=TIPS.find(x=>!profile.tipsSeen[x.id]&&x.when(G.cur));
  if(!t){box.hidden=true;tipShown=null;return;}
  if(tipShown!==t.id){tipShown=t.id;box.innerHTML=`<span class="tipi">💡</span><p>${t.text}</p><div class="tipb"><button class="btn sm" id="tipOff">No more tips</button><button class="primary sm" id="tipOk">Got it</button></div>`;
    $('#tipOk').addEventListener('click',()=>{profile.tipsSeen[t.id]=1;saveProfile();box.hidden=true;tipShown=null;checkTips();});
    $('#tipOff').addEventListener('click',()=>{profile.tipsOff=true;saveProfile();box.hidden=true;});}
  box.hidden=false;
}

/* =====================================================================
   LOBBY: home, play setup, hero creator and profile (saved on this device)
   ===================================================================== */
function avatarFrom(L,css,mouth='neutral',ability){
  {const ex={smile:'smile',smirk:'smile',open:'open',frown:'frown',grr:'grr'}[mouth]||'neutral';const url=heroPortrait(L,css,ability,ex);if(url) return `<img src="${url}" alt="" draggable="false">`;}
  L=L||{}; const skin=L.skin||'#d9ae86',hair=L.hair||'#3b2a1e',out=L.outfit||css;
  const brows=mouth==='frown'?'<path d="M14 17.5 L18 16.5 M26 17.5 L22 16.5" stroke="#2a2420" stroke-width="1.2"/>':mouth==='grr'?'<path d="M14 16 L18 17.5 M26 16 L22 17.5" stroke="#2a2420" stroke-width="1.4"/>':'';
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="${css}" opacity=".28"/><path d="M5 40 Q7 28.5 20 28.5 Q33 28.5 35 40 Z" fill="${out}"/><circle cx="20" cy="19" r="9.5" fill="${skin}"/><path d="M10.4 18 Q11 8.4 20 8.4 Q29 8.4 29.6 18 Q26 13 20 13 Q14 13 10.4 18 Z" fill="${hair}"/><circle cx="16.5" cy="20" r="1.25" fill="#2a2420"/><circle cx="23.5" cy="20" r="1.25" fill="#2a2420"/>${brows}<path d="${MOUTH[mouth]||MOUTH.neutral}" stroke="#2a2420" stroke-width="1.4" fill="${mouth==='open'?'#7a2a20':'none'}" stroke-linecap="round"/></svg>`;
}
const BASE_OUTFITS=[null,'#3d6b4a','#6b4a8a','#8a5a2b','#40576e'];
const UNLOCKS=[{lvl:2,kind:'sigil',id:'moon',name:'Moon banner'},{lvl:4,kind:'head',id:'circlet',name:'Gold circlet'},{lvl:3,kind:'outfit',id:'#c9a227',name:'Gold outfit'},{lvl:3,kind:'sigil',id:'anchor',name:'Anchor banner'},
  {lvl:4,kind:'sigil',id:'flame',name:'Flame banner'},{lvl:5,kind:'outfit',id:'#26262b',name:'Midnight outfit'},{lvl:6,kind:'outfit',id:'#ece6d8',name:'Ivory outfit'}];
const ACH=[
  {id:'first_win',name:'First victory',desc:'Win a game.',test:(G,p)=>G.winner===p},
  {id:'quick',name:'Swift rise',desc:'Win within 15 rounds.',test:(G,p)=>G.winner===p&&Math.ceil(G.turnNo/G.np)<=15},
  {id:'cities4',name:'City builder',desc:'Have 4 cities in one game.',test:(G,p)=>Engine.count(G,p,'city')>=4},
  {id:'road8',name:'All roads lead home',desc:'Hold Longest Road with 8 or more roads.',test:(G,p)=>G.longest.holder===p&&G.longest.len[p]>=8},
  {id:'trader',name:'Merchant prince',desc:'Make 8 trades in one game.',test:(G,p)=>G.stats[p].trades>=8},
  {id:'collector',name:'Bountiful',desc:'Collect 60 resources in one game.',test:(G,p)=>G.stats[p].collected>=60},
  {id:'conqueror',name:'Conqueror',desc:'Win 3 battles in one game.',test:(G,p)=>G.stats[p].won>=3},
  {id:'thief',name:'Light fingers',desc:'Steal 4 cards in one game.',test:(G,p)=>G.stats[p].stole>=4},
  {id:'fisher3',name:'Fisher king',desc:'Have 3 fishermen.',test:(G,p)=>Engine.count(G,p,'fisher')>=3},
  {id:'versatile',name:'Jack of all trades',desc:'Win with 3 different hero abilities.',test:(G,p,pr)=>Object.values(pr.byAbility).filter(x=>x.wins>0).length>=3},
];
const PROF_KEY='hexworld.profile';
function defaultProfile(){const h=randomHero();return {name:'Player',color:'Red',hero:{name:h.name,ability:h.ability,look:{skin:h.look.skin,hair:h.look.hair,sigil:h.look.sigil,outfit:null}},xp:0,games:0,wins:0,best:0,byAbility:{},achievements:{},history:[]};}
function loadProfile(){try{const p=JSON.parse(localStorage.getItem(PROF_KEY)||'null');if(p&&p.hero) return Object.assign(defaultProfile(),p);}catch(e){}return defaultProfile();}
let profile=loadProfile();
const saveProfile=()=>{try{localStorage.setItem(PROF_KEY,JSON.stringify(profile));}catch(e){}};
function levelInfo(xp){let lvl=1,need=250,acc=0;while(xp>=acc+need){acc+=need;lvl++;need=250+100*(lvl-1);}return {lvl,into:xp-acc,need};}
const unlocked=u=>levelInfo(profile.xp).lvl>=u.lvl;
const colorCss=n=>(PALETTE.find(c=>c.name===n)||PALETTE[0]).css;

/* ---- show and hide ---- */
let lbSec='home';
function showLobby(sec){
  if(G&&!G.recorded&&G.phase==='over') recordResult();
  $('#lobbyScr').hidden=false; controls.autoRotate=!reduceMotion(); controls.autoRotateSpeed=0.5; setMenu(false);
  renderLobby(sec||'home');
}
function hideLobby(){$('#lobbyScr').hidden=true;controls.autoRotate=false;}
function renderLobby(sec){
  lbSec=sec;
  document.querySelectorAll('#lbNav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sec===sec)));
  ['home','play','hero','profile','rules','online'].forEach(k=>$('#lb-'+k).hidden=k!==sec);
  renderLbHead();
  if(sec==='home') renderHome();
  if(sec==='play') renderSeats();
  if(sec==='hero') renderCreator();
  if(sec==='profile') renderProfile();
  if(sec==='rules') renderRules();
  if(sec==='online') renderOnline();
}
function renderLbHead(){
  const L=levelInfo(profile.xp);
  $('#lbProf').innerHTML=`<span class="mini-av" style="width:40px;height:40px">${avatarFrom(profile.hero.look,colorCss(profile.color))}</span><span class="lpn"><strong>${profile.hero.name}</strong><small>Level ${L.lvl} · ${ABILITIES[profile.hero.ability].name}</small><span class="xpbar"><i style="width:${Math.round(100*L.into/L.need)}%"></i></span></span>`;
}
document.querySelectorAll('#lbNav button').forEach(b=>b.addEventListener('click',()=>renderLobby(b.dataset.sec)));
$('#lbProf').addEventListener('click',()=>renderLobby('profile'));

/* ---- home ---- */
const UPDATE_NOTES=[
  {v:'0.24',items:['Trading between online players: offers, answers and counter-offers travel between devices','Menus in yak chestnut and horn ochre instead of teal']},
  {v:'0.23',items:['Online play: host a room and share its code, or join a friend’s room from your own device','Seats in Play can be set to Online for friends who join','Empty online seats are taken by bots, and a bot steps in if a player leaves']},
  {v:'0.22.1',items:['Dropdown menus are readable in dark mode','Close button on every dialog; click outside or press Escape to close','Roads can join a bridge where a river meets a lake']},
  {v:'0.22',items:['Map styles in Play: Classic, Clustered, River country, Lakeland and Rugged highlands','Armies march step by step to their new road','No more long streaky shadows at night']},
  {v:'0.21',items:['A big sound upgrade: wooden pieces, dice rattling in a cup, papery cards, ringing coins, deep frame drums, footsteps and brassy horns','A warm room sound on every effect','Birdsong by day, crickets and the odd owl at night, and quieter music after dark','Ambience follows the music switch in the Menu']},
  {v:'0.20: Marching Banners',items:['Armies can march over open ground, off the roads','Battle winners plunder 1 card from the loser','Sieges pay tribute: the besieger takes 1 resource each time the besieged building would produce','Red warning signs over your buildings when an enemy army can reach them','Smarter armies: bots defend, raise armies when threatened and attack for plunder','Night rules: wolves and bandits only come at night and leave at dawn']},
  {v:'0.19',items:['Players are called by their hero names, in color, in messages and the log','Banner badges on pieces and player cards to tell colors apart (Menu, Display)','Ask before building or buying, with the cost shown (can be switched off)']},
  {v:'0.18.1',items:['Graphics quality setting (Low, Medium, High) in the Menu','Phones start on Medium; Low halves the scenery, turns off shadows and runs at 30 frames a second','A gentle suggestion if the game runs slowly on your device']},
  {v:'0.18',items:['Games save automatically: continue where you left off from the lobby','How to play: the rules in one page','Tips during your first games (switch off any time)','Landscape side panels on phones','Painted resource icons and matching bank trade cards','Brighter, moonlit nights']},
  {v:'0.17',items:['Named AI opponents with their own personalities, including Aracanus, the Ageless Blade from Perisno','Day and night: sun, moon, stars and glowing windows (switch off in the Menu)','Wooden resource and development cards','The Shaggy Peaks and the iron mountains now look distinct','Roads with wheel ruts and little fences','Other players answer trade offers privately']},
  {v:'0.16',items:['Landscape layout on phones','Number tokens face the camera and are easier to read','Big cards in the trade screens','Clear red alerts when something is not allowed','Shoo the yaks off the numbers']},
  {v:'0.15',items:['Bigger pieces and a closer camera','Double-click to zoom, My area and Whole map buttons','Interface size setting','Compact 19-tile map']},
  {v:'0.14',items:['Grazing yaks and livelier lakes','Event cards with a soft glow','Chunkier carved soldiers and villagers']},
  {v:'0.13',items:['Carved-miniature style for tiles, houses, trees and yaks','Carved wooden number tokens']},
  {v:'0.12',items:['3D heroes with hairstyles, headwear and capes']},
];
function openNotes(){
  openModal('notes',`<h3>Update notes</h3>${UPDATE_NOTES.map(n=>`<p class="lbl" style="margin-top:12px">Version ${n.v}</p><ul style="margin:4px 0;padding-left:18px">${n.items.map(i=>`<li>${i}</li>`).join('')}</ul>`).join('')}<div class="mact"><button class="primary" id="ncl">Close</button></div>`,()=>{$('#ncl').addEventListener('click',()=>closeModal());});
  $('#lobbyScr').style.zIndex='19';
  const restore=()=>{if($('#modal').hidden){$('#lobbyScr').style.zIndex='';}else setTimeout(restore,300);}; setTimeout(restore,300);
}
function renderHome(){
  const live=G&&G.phase!=='over'&&!G.recorded&&G.phase!==undefined, sv=!live&&readSave();
  $('#lb-home').innerHTML=`<div class="lbgrid">
    ${live?`<button class="lbcard hl" data-go="continue"><span class="lbic">${svgI('turn')}</span><strong>Continue game</strong><span>Back to the game in progress (round ${Math.max(1,Math.ceil(G.turnNo/G.np))}).</span></button>`:''}
    ${sv?`<button class="lbcard hl" data-go="resume"><span class="lbic">${svgI('turn')}</span><strong>Continue saved game</strong><span>Round ${sv.round}: ${sv.names.map((n,i)=>`${n} ${sv.points[i]}`).join(', ')}. Saved ${new Date(sv.savedAt).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}.</span></button>`:''}
    <button class="lbcard" data-go="rules"><span class="lbic">${svgI('dev')}</span><strong>How to play</strong><span>The rules in a few minutes, and tips for your first games.</span></button>
    <button class="lbcard hl" data-go="play"><span class="lbic">${svgI('dev')}</span><strong>Play</strong><span>Against bots, or with friends passing one device.</span></button>
    <button class="lbcard" data-go="online"><span class="lbic">${svgI('merchant')}</span><strong>Online</strong><span>Play with friends on their own devices: host a room or join with a code.</span></button>
    <button class="lbcard" data-go="hero"><span class="lbic">${svgI('hero')}</span><strong>Hero</strong><span>Create and customize ${profile.hero.name}: looks, banner and ability.</span></button>
    <button class="lbcard" data-go="profile"><span class="lbic">${svgI('vp')}</span><strong>Profile</strong><span>Level ${levelInfo(profile.xp).lvl}, ${Object.keys(profile.achievements).length} of ${ACH.length} achievements, unlocks and recent games.</span></button>
  </div>`;
  {const n=UPDATE_NOTES[0];$('#lb-home .lbgrid').insertAdjacentHTML('beforeend',`<div class="lbcard notes"><span class="lbic">${svgI('dev')}</span><strong>What's new in ${n.v}</strong><ul>${n.items.map(i=>`<li>${i}</li>`).join('')}</ul><button class="btn sm" id="allNotes" style="margin-top:6px">All update notes</button></div>`);
   $('#allNotes').addEventListener('click',openNotes);}
  $('#lb-home').querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.go;
    if(g==='online'){renderLobby('online');return;}
    if(g==='continue') hideLobby(); else if(g==='resume') loadSaved(); else if(g==='online') toast('Online play arrives once the game is on its own website. Hosting from your browser will come first.'); else renderLobby(g);}));
}

/* ---- play setup ---- */
function seatsDefault(np){
  let saved=[];try{saved=JSON.parse(localStorage.getItem('hexworld.seats2')||'[]');}catch(e){}
  const def=['Red','Blue','White','Orange'];
  const out=Array.from({length:np},(_,i)=>{const sv=saved[i]||{};return {ai:sv.ai&&AI_DEFS[sv.ai]?sv.ai:'',type:sv.type||(i===0?'you':'bot'),color:sv.color&&PALETTE.some(c=>c.name===sv.color)?sv.color:def[i],hero:sv.hero&&ABILITIES[sv.hero.ability]?sv.hero:randomHero()};});
  if(!out.some(s=>s.type==='you')) out[0].type='you';
  out.forEach((s,i)=>{if(s.type==='you') s.color=profile.color;});
  fixColors(out); return out;
}
function fixColors(seats,keep){
  seats.forEach((s,i)=>{if(s!==keep&&seats.some((o,j)=>o!==s&&o.color===s.color&&(o===keep||j<i))){const free=PALETTE.map(c=>c.name).filter(n=>!seats.some(o=>o.color===n));s.color=pickR(free);s.bumped=true;}});
}
function renderSeats(){
  const np=+$('#np').value;
  if(!lobby||lobby.length!==np||!lobby[0].type) lobby=seatsDefault(np);
  $('#seats').innerHTML=lobby.map((s,i)=>{
    const h=s.type==='you'?profile.hero:s.hero, a=ABILITIES[h.ability], css=colorCss(s.color);
    return `<div class="seat2" style="--sc:${css}">
      <span class="mini-av" style="width:44px;height:44px">${avatarFrom(h.look,css)}</span>
      <div class="s2main"><div class="s2top"><strong>Player ${i+1}</strong>
        <span class="tabs s2type" role="group" aria-label="Who plays seat ${i+1}">${['you','guest','bot','online'].map(t=>`<button data-st="${i}|${t}" aria-pressed="${s.type===t}">${t==='you'?'You':t==='guest'?'Guest':t==='bot'?'Bot':'Online'}</button>`).join('')}</span></div>
        <div class="swrow">${PALETTE.map(c=>`<button class="swb" data-sc="${i}|${c.name}" aria-pressed="${c.name===s.color}" title="${c.name}" style="background:${c.css}"></button>`).join('')}</div>
        ${s.bumped?'<p class="adesc" style="min-height:0;margin:0">That color was taken, so this seat got a random one.</p>':''}
        <div class="s2hero">${s.type==='you'?`<span>${h.name} the ${a.name}</span><button class="btn sm" data-edit="1">Edit hero</button>`
          :s.type==='online'?`<span>${s.guestName?`<strong>${esc(s.guestName)}</strong> as ${esc(h.name)} the ${a.name}`:NET.mode==='host'?'Waiting for a friend to join…':'Open a room in <strong>Online</strong> first'}</span>`
          :s.type==='guest'?`<input type="text" maxlength="16" value="${h.name.replace(/"/g,'')}" data-gn="${i}" aria-label="Guest hero name"><select data-ga="${i}" aria-label="Guest hero ability">${Object.entries(ABILITIES).map(([k,x])=>`<option value="${k}" ${k===h.ability?'selected':''}>${x.name}</option>`).join('')}</select><button class="btn sm" data-rh="${i}">Random</button>`
          :`<select data-ai="${i}" aria-label="Which AI opponent"><option value="">Random bot</option>${Object.entries(AI_DEFS).map(([k,x])=>`<option value="${k}" ${s.ai===k?'selected':''}>${x.name} ${x.title} (${x.diff})</option>`).join('')}</select>${s.ai?'':`<button class="btn sm" data-rh="${i}">New random hero</button>`}`}</div>
        ${s.type==='bot'&&s.ai?`<p class="aibio"><span class="dpill d${AI_DEFS[s.ai].diff}">${AI_DEFS[s.ai].diff}</span> ${AI_DEFS[s.ai].bio}</p>`:''}
      </div></div>`;}).join('');
  const Q=(sel,fn)=>$('#seats').querySelectorAll(sel).forEach(b=>b.addEventListener('click',()=>{fn(b);renderSeats();}));
  Q('[data-st]',b=>{const [i,t]=b.dataset.st.split('|');const s=lobby[+i];
    setTimeout(()=>{if(NET.mode==='host'){assignGuests();hostLobbyUpdate();}},0);
    if(t==='you'){lobby.forEach(o=>{if(o.type==='you') o.type='guest';});s.color=profile.color;fixColors(lobby,s);}
    s.type=t; lobby.forEach(o=>o.bumped=false);});
  Q('[data-sc]',b=>{const [i,c]=b.dataset.sc.split('|');const s=lobby[+i];s.color=c;lobby.forEach(o=>o.bumped=false);fixColors(lobby,s);if(s.type==='you'){profile.color=c;saveProfile();}});
  Q('[data-rh]',b=>{lobby[+b.dataset.rh].hero=randomHero();});
  Q('[data-edit]',()=>{renderLobby('hero');});
  $('#seats').querySelectorAll('[data-gn]').forEach(inp=>inp.addEventListener('input',()=>{lobby[+inp.dataset.gn].hero.name=inp.value.trim()||'Hero';}));
  $('#seats').querySelectorAll('[data-ai]').forEach(sel=>sel.addEventListener('change',()=>{const st=lobby[+sel.dataset.ai];st.ai=sel.value;
    if(st.ai){const d=AI_DEFS[st.ai];st.hero={name:d.name,ability:d.ability,look:JSON.parse(JSON.stringify(d.look))};}renderSeats();}));
  $('#seats').querySelectorAll('[data-ga]').forEach(sel=>sel.addEventListener('change',()=>{lobby[+sel.dataset.ga].hero.ability=sel.value;renderSeats();}));
}
let sizeTouched=false;
$('#size').addEventListener('change',()=>{sizeTouched=true;});
$('#np').addEventListener('change',()=>{lobby=null;if(!sizeTouched) $('#size').value=$('#np').value==='3'?'2':'3';renderSeats();});

/* ---- hero creator ---- */
let draft=null;
function renderCreator(){
  if(!draft) draft=JSON.parse(JSON.stringify(profile.hero));
  const L=draft.look, css=colorCss(profile.color), lvl=levelInfo(profile.xp).lvl;
  const lockOf=(kind,id)=>UNLOCKS.find(u=>u.kind===kind&&u.id===id);
  const outfits=[...BASE_OUTFITS,...UNLOCKS.filter(u=>u.kind==='outfit').map(u=>u.id)];
  const sigils=[...SIGILS,...UNLOCKS.filter(u=>u.kind==='sigil').map(u=>u.id)];
  $('#lb-hero').innerHTML=`<div class="creator">
    <div class="cprev"><div class="bigav">${portraitRig()?'<canvas id="hero3d" width="360" height="360" aria-label="Your hero, turning slowly"></canvas>':avatarFrom(L,css,'smile',draft.ability)}</div><canvas id="cflag" width="120" height="84"></canvas>
      <p class="m">${draft.name} the ${ABILITIES[draft.ability].name}</p><button class="btn" id="crand">Randomize</button></div>
    <div class="cform">
      <label class="lbl" for="cname">Hero name</label><input id="cname" type="text" maxlength="16" value="${draft.name.replace(/"/g,'')}">
      <p class="lbl">Favorite color (used when it's free)</p><div class="swrow">${PALETTE.map(c=>`<button class="swb" data-fc="${c.name}" aria-pressed="${c.name===profile.color}" title="${c.name}" style="background:${c.css}"></button>`).join('')}</div>
      <p class="lbl">Outfit</p><div class="swrow">${outfits.map(o=>{const u=o&&lockOf('outfit',o),lk=u&&lvl<u.lvl;return `<button class="swb${lk?' locked':''}" data-of="${o||''}" aria-pressed="${(L.outfit||null)===o}" ${lk?`disabled title="${u.name}: unlocks at level ${u.lvl}"`:`title="${o?'Outfit':'Team color'}"`} style="background:${o||css}">${o?'':'<small>team</small>'}</button>`;}).join('')}</div>
      <p class="lbl">Skin</p><div class="swrow">${SKINS.map(c=>`<button class="swb round" data-sk="${c}" aria-pressed="${c===L.skin}" style="background:${c}" title="Skin tone"></button>`).join('')}</div>
      <p class="lbl">Hairstyle</p><div class="swrow">${HAIRSTYLES.map(([k,n])=>`<button class="btn sm" data-hs="${k}" aria-pressed="${(L.hairStyle||'short')===k}">${n}</button>`).join('')}</div>
      <p class="lbl">Headwear and cape</p><div class="swrow">${HEADWEAR.map(([k,n])=>{const u=lockOf('head',k),lk=u&&lvl<u.lvl;return `<button class="btn sm${lk?' locked':''}" data-hw="${k}" aria-pressed="${(L.headwear||'none')===k}" ${lk?`disabled title="${u.name}: unlocks at level ${u.lvl}"`:''}>${n}${lk?' (level '+u.lvl+')':''}</button>`;}).join('')}<button class="btn sm" data-cape="1" aria-pressed="${!!L.cape}">${L.cape?'Cape: on':'Cape: off'}</button></div>
      <p class="lbl">Hair color</p><div class="swrow">${HAIRS.map(c=>`<button class="swb round" data-hr="${c}" aria-pressed="${c===L.hair}" style="background:${c}" title="Hair color"></button>`).join('')}</div>
      <p class="lbl">Banner</p><div class="swrow">${sigils.map(g=>{const u=lockOf('sigil',g),lk=u&&lvl<u.lvl;return `<button class="swb sigb${lk?' locked':''}" data-sg="${g}" aria-pressed="${g===L.sigil}" ${lk?`disabled title="${u.name}: unlocks at level ${u.lvl}"`:`title="${g}"`}><canvas width="52" height="52" data-sigc="${g}"></canvas></button>`;}).join('')}</div>
      <p class="lbl">Ability</p><div class="abil2">${Object.entries(ABILITIES).map(([k,x])=>`<button data-ab2="${k}" aria-pressed="${k===draft.ability}"><span class="lt" style="background:${x.color}">${x.letter}</span><strong>${x.name}</strong><small>${x.desc}</small></button>`).join('')}</div>
      <div class="mact"><button class="btn" id="cundo">Discard changes</button><button class="primary" id="csave">Save hero</button></div>
    </div></div>`;
  const fl=$('#cflag').getContext('2d'); fl.fillStyle=css; fl.fillRect(0,0,120,84); drawSigil(fl,L.sigil||'shield',60,40,24,profile.color==='White'?'#46505e':'#fff');
  $('#lb-hero').querySelectorAll('canvas[data-sigc]').forEach(cv=>{const x=cv.getContext('2d');x.fillStyle=css;x.fillRect(0,0,52,52);drawSigil(x,cv.dataset.sigc,26,26,16,profile.color==='White'?'#46505e':'#fff');});
  const Q=(sel,fn)=>$('#lb-hero').querySelectorAll(sel).forEach(b=>b.addEventListener('click',()=>{fn(b);renderCreator();}));
  Q('[data-fc]',b=>{profile.color=b.dataset.fc;saveProfile();});
  Q('[data-of]',b=>{L.outfit=b.dataset.of||null;});
  Q('[data-hs]',b=>{L.hairStyle=b.dataset.hs;}); Q('[data-hw]',b=>{L.headwear=b.dataset.hw;}); Q('[data-cape]',()=>{L.cape=!L.cape;});
  previewHero=buildHero(L,css,draft.ability,'smile');
  Q('[data-sk]',b=>{L.skin=b.dataset.sk;}); Q('[data-hr]',b=>{L.hair=b.dataset.hr;}); Q('[data-sg]',b=>{L.sigil=b.dataset.sg;});
  Q('[data-ab2]',b=>{draft.ability=b.dataset.ab2;});
  $('#crand').addEventListener('click',()=>{const r=randomHero();draft={name:r.name,ability:r.ability,look:{skin:r.look.skin,hair:r.look.hair,sigil:r.look.sigil,hairStyle:r.look.hairStyle,headwear:r.look.headwear,cape:r.look.cape,outfit:L.outfit}};renderCreator();});
  $('#cname').addEventListener('input',e=>{draft.name=e.target.value.trim()||'Hero';});
  $('#cundo').addEventListener('click',()=>{draft=null;renderCreator();});
  $('#csave').addEventListener('click',()=>{profile.hero=JSON.parse(JSON.stringify(draft));saveProfile();draft=null;Snd.play('fanfare');toast(`${profile.hero.name} is saved.`);renderLobby('home');});
}

/* ---- profile ---- */
function renderProfile(){
  const L=levelInfo(profile.xp), fav=Object.entries(profile.byAbility).sort((a,b)=>b[1].games-a[1].games)[0];
  $('#lb-profile').innerHTML=`<div class="prof">
    <div class="pcardbig"><span class="bigav sm">${avatarFrom(profile.hero.look,colorCss(profile.color),'smile')}</span><div><h3>${profile.hero.name}</h3><p class="m">${ABILITIES[profile.hero.ability].name} · Level ${L.lvl}</p>
      <div class="xpbar big"><i style="width:${Math.round(100*L.into/L.need)}%"></i></div><p class="m">${L.into} / ${L.need} experience to level ${L.lvl+1}</p></div></div>
    <div class="pstats">${[['Games',profile.games],['Wins',profile.wins],['Win rate',profile.games?Math.round(100*profile.wins/profile.games)+'%':'–'],['Best score',profile.best||'–'],['Favorite ability',fav?ABILITIES[fav[0]].name:'–']].map(([k,v])=>`<div><strong>${v}</strong><span>${k}</span></div>`).join('')}</div>
    <h4>Achievements (${Object.keys(profile.achievements).length} of ${ACH.length})</h4>
    <div class="achs">${ACH.map(a=>{const got=profile.achievements[a.id];return `<div class="ach${got?' got':''}"><span class="lbic">${svgI(got?'vp':'turn')}</span><div><strong>${a.name}</strong><small>${a.desc}${got?` Unlocked ${new Date(got).toLocaleDateString()}.`:''}</small></div></div>`;}).join('')}</div>
    <h4>Unlocks</h4>
    <div class="achs">${UNLOCKS.map(u=>`<div class="ach${unlocked(u)?' got':''}"><span class="lbic">${svgI(u.kind==='sigil'?'rally':'hero')}</span><div><strong>${u.name}</strong><small>${unlocked(u)?'Unlocked: choose it in the hero creator.':`Reach level ${u.lvl}.`}</small></div></div>`).join('')}</div>
    <h4>Recent games</h4>
    ${profile.history.length?`<div class="hist">${profile.history.map(h=>`<div><span class="${h.win?'result good':'m'}">${h.win?'Won':'Lost'}</span> with ${h.vp} points as ${ABILITIES[h.ability].name}, ${h.rounds} rounds, ${h.players} players <small class="m">${new Date(h.at).toLocaleDateString()}</small></div>`).join('')}</div>`:'<p class="m">No games yet. Finish a game to start your record.</p>'}
    <p class="m" style="margin-top:14px">Your profile is saved in this browser. Online accounts will keep it across devices.</p>
  </div>`;
}

/* ---- results: experience, levels and achievements ---- */
function recordResult(){
  clearSave();
  if(!G||G.recorded||G.you===undefined||G.you<0) return null;
  G.recorded=true;
  const p=G.you, win=G.winner===p, vp=Engine.vp(G,p,true), ab=G.heroes[p].ability, before=levelInfo(profile.xp).lvl;
  const xp=60+vp*12+(win?120:0);
  profile.xp+=xp; profile.games++; if(win) profile.wins++; profile.best=Math.max(profile.best||0,vp);
  const ba=profile.byAbility[ab]=profile.byAbility[ab]||{games:0,wins:0}; ba.games++; if(win) ba.wins++;
  profile.history.unshift({at:Date.now(),win,vp,ability:ab,rounds:Math.ceil(G.turnNo/G.np),players:G.np}); profile.history=profile.history.slice(0,10);
  const fresh=ACH.filter(a=>!profile.achievements[a.id]&&a.test(G,p,profile)); fresh.forEach(a=>profile.achievements[a.id]=Date.now());
  const after=levelInfo(profile.xp).lvl, newUnlocks=UNLOCKS.filter(u=>u.lvl>before&&u.lvl<=after);
  saveProfile();
  return {xp,before,after,fresh,newUnlocks};
}

const ADJ=['amber','misty','iron','quiet','golden','windy','silver','hollow','bright','old','green','stone'];
const NOUN=['ford','vale','reach','moor','crossing','ridge','fen','march','downs','glen','heath','weald'];
function randomSeed(){return ADJ[Math.floor(Math.random()*ADJ.length)]+'-'+NOUN[Math.floor(Math.random()*NOUN.length)]+'-'+(10+Math.floor(Math.random()*90));}
// On phones, ask for landscape: full screen plus orientation lock where the browser allows it,
// otherwise a friendly prompt to turn the phone sideways.
const isPhone=()=>Math.min(screen.width,screen.height)<=820&&matchMedia('(pointer:coarse)').matches;
function wantLandscape(){
  if(!isPhone()) return;
  try{const el=document.documentElement;const req=el.requestFullscreen||el.webkitRequestFullscreen;
    if(req&&!document.fullscreenElement) Promise.resolve(req.call(el)).then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape')).catch(()=>{});
    else if(screen.orientation&&screen.orientation.lock) screen.orientation.lock('landscape').catch(()=>{});}catch(e){}
  setTimeout(checkRotate,600);
}
let keepPortrait=false;
function checkRotate(){const o=$('#rotateMsg');o.hidden=!(isPhone()&&innerHeight>innerWidth&&!keepPortrait&&$('#lobbyScr').hidden);}
window.addEventListener('resize',()=>setTimeout(checkRotate,200));
$('#gen').addEventListener('click',()=>{if(NET.mode==='client'){toast('The host starts the game.','err');return;}if(!lobby||!lobby[0]||!lobby[0].type) renderSeats();wantLandscape();beginGame();});
$('#toLobby').addEventListener('click',()=>showLobby('home'));
$('#newseed').addEventListener('click',()=>{$('#seed').value=randomSeed();});
$('#camMine').addEventListener('click',myArea);
$('#camAll').addEventListener('click',()=>{userCam=performance.now();camOverview();});
const setMenu=open=>{$('#panel').hidden=!open;$('#menuBtn').setAttribute('aria-expanded',String(open));$('#menuBtn').textContent=open?'Close':'Menu';};
$('#menuBtn').addEventListener('click',()=>setMenu($('#panel').hidden));
$('#collapse').addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',ev=>{
  if(ev.target.matches('input,select,textarea')||!$('#modal').hidden||!G) return;
  if(ev.key==='r'||ev.key==='R') $('#roll').click();
  if(ev.key==='Escape'&&mode){mode=null;refresh();}
});
window.addEventListener('resize',resize);
resize();

$('#seed').value=randomSeed();
function fitPanel(){
  const pn=$('#panel'), rf=$('#ref');
  if(rf.hidden){pn.style.maxHeight='';return;}
  const avail=rf.getBoundingClientRect().top-pn.getBoundingClientRect().top-10;
  pn.style.maxHeight=Math.max(64,avail)+'px';
}
{const P=Snd.prefs;$('#sfxOn').checked=P.sfx;$('#musOn').checked=P.music;$('#sfxVol').value=P.sfxVol;$('#musVol').value=P.musVol;
 $('#sfxOn').addEventListener('change',e=>{Snd.unlock();Snd.set('sfx',e.target.checked);});
 $('#musOn').addEventListener('change',e=>{Snd.unlock();Snd.set('music',e.target.checked);});
 $('#sfxVol').addEventListener('input',e=>{Snd.set('sfxVol',+e.target.value);Snd.play('coin');});
 $('#musVol').addEventListener('input',e=>Snd.set('musVol',+e.target.value));}
const clock={key:'',deadline:0,last:-1};
function clockActor(){return G.phase==='discard'?G.discard[0].p:G.cur;}
function clockKey(){return G.phase==='discard'?'d'+G.discard[0].p+'|'+G.turnNo:G.cur+'|'+G.turnNo+'|'+(G.phase==='setup'?G.setup.i+G.setup.step:'');}
setInterval(()=>{
  const el=$('#clock');
  if(!G||!G.opts||!G.opts.timer||G.phase==='over'||!$('#lobbyScr').hidden||isBot(clockActor())){el.hidden=true;return;}
  const k=clockKey(); if(k!==clock.key){clock.key=k;clock.deadline=performance.now()+G.opts.timer*1000;clock.last=-1;}
  if(rolling||battling||!$('#reveal').hidden){clock.deadline+=250;}
  const left=Math.max(0,Math.ceil((clock.deadline-performance.now())/1000));
  el.hidden=false; el.textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`; el.classList.toggle('urgent',left<=10);
  if(left<=5&&left!==clock.last&&left>0) Snd.play('tick');
  clock.last=left;
  if(left===0&&!rolling&&!battling) timeUp(clockActor());
},250);
function timeUp(p){
  clock.key='';
  toast(`Time’s up for ${pname(p)}. The turn is played on automatically.`); react(p,'sad');
  if(!['lobby','first'].includes(modalKind)) closeModal(true);
  nego=null; mode=null; selEdge=null;
  if(G.phase==='setup'){if(G.setup.step==='village'){const c=Bot.setupVillage(G,p);justBuilt=c.key;const r=Engine.placeVillage(G,c);if(after(r)&&r.gains) r.gains.forEach((g,i)=>collect(g,i));}else{const e=Bot.setupRoad(G,p);justBuilt=e.key;after(Engine.placeRoad(G,e));}return;}
  if(G.phase==='discard'){after(Engine.discard(G,p,Bot.discard(G,p)));return;}
  if(G.phase==='roll'){doRoll();return;}
  if(G.phase==='robber'||G.phase==='scout'){const r=Engine.moveRobber(G,Bot.robberTile(G,p));if(after(r)) stealShow(r);return;}
  if(G.phase==='steal'){const r=Engine.steal(G,Bot.stealFrom(G,p));if(after(r)) stealShow(r);return;}
  if(G.phase==='main'){recordUi('clearFree');doEndTurn();}
}
const uiPrefs=(()=>{try{return Object.assign({confirm:true,cb:false,size:window.innerWidth>=1500?1.15:1,follow:true,quality:matchMedia('(pointer:coarse)').matches?'medium':'high'},JSON.parse(localStorage.getItem('hexworld.ui')||'{}'));}catch(e){return {size:1,follow:true};}})();
function applyUi(){
  const wide=window.innerWidth>760&&window.innerHeight>520;
  document.documentElement.style.setProperty('--ui',wide?uiPrefs.size:1);
  document.querySelectorAll('#uisize button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ui===+uiPrefs.size)));
  $('#followCam').checked=!!uiPrefs.follow; $('#sureOn').checked=!!uiPrefs.confirm; $('#cbOn').checked=!!uiPrefs.cb; DN.on=uiPrefs.dayNight!==false; $('#dayNight').checked=DN.on;
}
const saveUi=()=>{try{localStorage.setItem('hexworld.ui',JSON.stringify(uiPrefs));}catch(e){}};
document.querySelectorAll('#uisize button').forEach(b=>b.addEventListener('click',()=>{uiPrefs.size=+b.dataset.ui;saveUi();applyUi();}));
$('#followCam').addEventListener('change',e=>{uiPrefs.follow=e.target.checked;saveUi();});
$('#sureOn').addEventListener('change',e=>{uiPrefs.confirm=e.target.checked;saveUi();});
$('#cbOn').addEventListener('change',e=>{uiPrefs.cb=e.target.checked;saveUi();if(G){renderPieces(G);refresh();}});
function applyQuality(rebuild){
  Q=QUALITY[uiPrefs.quality]||QUALITY.high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,Q.pr));
  renderer.shadowMap.enabled=!!Q.shadows; sun.castShadow=!!Q.shadows;
  if(Q.shadows){sun.shadow.mapSize.set(Q.shadows,Q.shadows);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}
  document.querySelectorAll('#gfxq button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.q===uiPrefs.quality)));
  resize();
  if(rebuild&&curBoard){buildScene(curBoard);if(G) renderPieces(G);scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>m.needsUpdate=true);});}
}
document.querySelectorAll('#gfxq button').forEach(b=>b.addEventListener('click',()=>{uiPrefs.quality=b.dataset.q;saveUi();applyQuality(true);slowFrames=0;}));
$('#dayNight').addEventListener('change',e=>{uiPrefs.dayNight=e.target.checked;DN.on=e.target.checked;saveUi();});
window.addEventListener('resize',applyUi); applyUi(); if(!uiPrefs.quality) uiPrefs.quality='high'; applyQuality(false);
$('#keepPortrait').addEventListener('click',()=>{keepPortrait=true;checkRotate();});
function previewBoard(){if(G&&!G.recorded&&G.phase!=='over') return;const B=Board.generate($('#seed').value||'preview',+$('#size').value,true,$('#mapStyle').value);curR=B.R;buildScene(B);frameCamera(B.R);}
$('#mapStyle').addEventListener('change',previewBoard);
let started=false; const go=()=>{if(!started){started=true;const B=Board.generate($('#seed').value,+$('#size').value,true);curR=B.R;buildScene(B);frameCamera(B.R);showLobby('home');animate();}};
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(go);
setTimeout(go,1500);
