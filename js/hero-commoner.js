/* Highhorn: lazy, reusable whole-character Commoner previews and board figures. */
'use strict';
window.HighhornCommoner = (() => {
  const catalog={
    'male-commoner':{id:'male-commoner',label:'Male Commoner',folder:'MaleCommoner',file:'Toon_v1/hero.glb?v=1',boardFile:'Toon_v1/board.glb?v=1',portraitFile:'Toon_v1/portrait.png?v=1',gender:'male',height:1.8},
    'female-commoner':{id:'female-commoner',label:'Female Commoner',folder:'FemaleCommoner',file:'Toon_v1/hero.glb?v=1',boardFile:'Toon_v1/board.glb?v=1',portraitFile:'Toon_v1/portrait.png?v=1',gender:'female',height:1.68}
  };
  function modelFor(look, identity={}) {
    look=typeof look==='string'?{model:look}:(look||{});
    if(catalog[look.model])return look.model;
    const gender=look.gender||identity.gender;
    if(gender==='female'||gender==='male')return gender+'-commoner';
    if(catalog[identity.model])return identity.model;
    if(!identity.key)return 'male-commoner';
    // Stable legacy fallback; never roll a new appearance while rendering.
    let hash=2166136261;for(const ch of String(identity.key)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
    return (hash>>>0)%2?'female-commoner':'male-commoner';
  }
  const resolve=id=>catalog[modelFor(id)];
  let loaderPromise=null;
  function createCharacter(config){
  const assetURL = 'Models/Heroes/'+config.folder+'/'+config.file;
  const loaderURL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  let shell, viewport, notice, renderer, scene, camera, orbit, root, mixer, action;
  let pending = null, active = false, raf = 0, previous = 0;
  let clips = {}, meshes = [], restPose = [], selected = 'rest', mountedAt = 0;
  let loadedMs = 0, failure = '', observer, options = {}, frames = 0, renderMs = [];
  let portraitData = null;
  function ensureLoader() {
    if (THREE.GLTFLoader) return Promise.resolve();
    if (!loaderPromise) loaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = loaderURL;
      script.onload = resolve;
      script.onerror = () => { script.remove(); loaderPromise = null; reject(new Error('The character loader could not be reached.')); };
      document.head.append(script);
    });
    return loaderPromise;
  }
  function setNotice(text) { if (notice) notice.textContent = text; }
  function syncButtons() {
    shell.querySelectorAll('[data-commoner-clip]').forEach(button => {
      button.disabled = !root;
      button.setAttribute('aria-pressed', String(button.dataset.commonerClip === selected));
    });
  }
  function render() {
    if (!renderer || !root) return;
    root.updateMatrixWorld(true);meshes.forEach(mesh => mesh.skeleton.update());
    renderer.render(scene, camera);
  }
  function setClip(name) {
    if (!root || (name !== 'rest' && !clips[name])) return;
    mixer.stopAllAction(); selected = name; action = null;
    if (name === 'rest' && !clips.idle) for (const saved of restPose) {
      saved.bone.position.copy(saved.position); saved.bone.quaternion.copy(saved.quaternion); saved.bone.scale.copy(saved.scale);
    }
    else { action = mixer.clipAction(clips[name === 'rest' ? 'idle' : name]); action.reset().play(); mixer.update(0); }
    previous = 0;syncButtons();render();
  }
  function tick(now) {
    raf = 0;if (!active || document.hidden || !shell.isConnected) return;
    const elapsed = previous ? now - previous : 0;
    const interval = options.quality === 'low' ? 50 : 1000 / 30;
    if (!previous || elapsed >= interval - 1) {
      if (mixer && action && !(selected === 'rest' && options.reducedMotion)) mixer.update(Math.min(.1, elapsed / 1000));
      previous = now;
      const start = performance.now();orbit.update();render();frames++;
      if (root) {renderMs.push(performance.now() - start);if (renderMs.length > 120) renderMs.shift();}
    }
    raf = requestAnimationFrame(tick);
  }
  function resume() { if (active && !document.hidden && !raf) {previous = 0;raf = requestAnimationFrame(tick);} }
  function suspend() { active = false; if (raf) cancelAnimationFrame(raf);raf = 0;previous = 0; }
  function resize() {
    if (!viewport || !renderer || !viewport.clientWidth) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, options.quality === 'low' ? 1 : 1.5));
    renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
    camera.aspect = viewport.clientWidth / viewport.clientHeight;camera.updateProjectionMatrix();render();
  }
  function createShell() {
    shell = document.createElement('div');shell.className = 'commoner-preview';
    shell.innerHTML = '<div class="commoner-viewport"><canvas aria-label="Male Commoner in a medieval tunic, trousers and boots. Drag to rotate; scroll to zoom."></canvas></div><p class="m commoner-status" role="status" aria-live="polite">Loading Male Commoner…</p><div class="tabs commoner-clips" role="group" aria-label="Character animation"><button data-commoner-clip="rest" aria-pressed="true" disabled>Rest</button><button data-commoner-clip="walk" aria-pressed="false" disabled>Walk</button><button data-commoner-clip="run" aria-pressed="false" disabled>Run</button></div><button class="btn commoner-retry" hidden>Retry loading</button><p class="m commoner-hint">Drag to rotate · scroll to zoom</p>';
    shell.querySelector('canvas').setAttribute('aria-label',config.label+' in medieval clothing. Drag to rotate; scroll to zoom.');
    viewport = shell.querySelector('.commoner-viewport');notice = shell.querySelector('[role=status]');
    shell.querySelectorAll('[data-commoner-clip]').forEach(button => button.addEventListener('click', () => setClip(button.dataset.commonerClip)));
    shell.querySelector('.commoner-retry').addEventListener('click', () => load());
    renderer = new THREE.WebGLRenderer({canvas:viewport.querySelector('canvas'),antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.outputEncoding = THREE.sRGBEncoding;renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = .95;
    renderer.setClearColor(0x000000,0);
    scene = new THREE.Scene();scene.add(new THREE.HemisphereLight(0xdce8f5,0x66513b,.7));
    const key = new THREE.DirectionalLight(0xffe6c5,1.1);key.position.set(-3,5,4);scene.add(key);
    const fill = new THREE.DirectionalLight(0xb4cce8,.45);fill.position.set(3,2,-2);scene.add(fill);
    camera = new THREE.PerspectiveCamera(31,1,.01,50);camera.position.set(1.9,1.45,3.5);
    orbit = new THREE.OrbitControls(camera,renderer.domElement);orbit.target.set(0,.92,0);orbit.enableDamping=true;
    orbit.minDistance=2;orbit.maxDistance=5;orbit.maxPolarAngle=Math.PI*.56;orbit.enablePan=false;orbit.update();
    observer = new ResizeObserver(resize);observer.observe(viewport);
    renderer.domElement.addEventListener('webglcontextlost', event => {event.preventDefault();failure='The character view lost its graphics context. Reload the page to restore it.';setNotice(failure);suspend();});
    document.addEventListener('visibilitychange', () => {if (document.hidden) {if (raf) cancelAnimationFrame(raf);raf=0;previous=0;}else resume();});
  }
  function load() {
    if (root) return Promise.resolve(root);
    if (pending) return pending;
    failure='';setNotice('Loading '+config.label+'…');shell.querySelector('.commoner-retry').hidden=true;
    const start=performance.now();
    pending=ensureLoader().then(() => new Promise((resolve,reject) => {
      new THREE.GLTFLoader().load(assetURL,resolve,event=>{if(event.total)setNotice('Loading '+config.label+'… '+Math.round(100*event.loaded/event.total)+'%');},reject);
    })).then(gltf => {
      if (!gltf.animations.some(c=>c.name==='walk') || !gltf.animations.some(c=>c.name==='run')) throw new Error('This character is missing an animation.');
      HighhornToon.apply(gltf.scene);
      root=gltf.scene;clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
      root.traverse(object=>{
        if(object.isBone)restPose.push({bone:object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()});
        if(object.isSkinnedMesh){object.frustumCulled=false;meshes.push(object);}
      });
      scene.add(root);mixer=new THREE.AnimationMixer(root);loadedMs=performance.now()-start;
      setClip('rest');setNotice(config.label+' · Level 1');resize();resume();return root;
    }).catch(error=>{
      pending=null;failure='Could not load '+config.label+'. Check your connection and try again.';
      setNotice(failure);shell.querySelector('.commoner-retry').hidden=false;
      console.warn('Highhorn character load failed:',error.message || error);return null;
    });
    return pending;
  }
  function mount(host, settings = {}) {
    options=settings;
    try {
      if(!shell)createShell();
      host.replaceChildren(shell);active=true;mountedAt=performance.now();
      orbit.autoRotate=!options.reducedMotion;orbit.autoRotateSpeed=.35;
      resize();syncButtons();load();resume();
    } catch(error) {
      failure='This device could not open the 3D character view. Your hero settings are still available below.';
      host.textContent=failure;console.warn('Highhorn character preview:',error.message);suspend();
    }
  }
  function capturePortrait() {
    if (!root) return null;
    if(portraitData)return portraitData;
    const saved=selected,time=action?.time || 0,size=renderer.getSize(new THREE.Vector2()),pixelRatio=renderer.getPixelRatio();
    setClip('rest');const portraitCamera=new THREE.PerspectiveCamera(24,1,.01,50);
    portraitCamera.position.set(.38,config.height-.20,1.5);portraitCamera.lookAt(0,config.height-.28,0);
    renderer.setPixelRatio(1);renderer.setSize(256,256,false);root.updateMatrixWorld(true);meshes.forEach(m=>m.skeleton.update());
    renderer.render(scene,portraitCamera);portraitData=renderer.domElement.toDataURL('image/png');
    renderer.setPixelRatio(pixelRatio);renderer.setSize(size.x,size.y,false);setClip(saved);if(action){action.time=time;mixer.update(0);}render();return portraitData;
  }
  function inspect() {
    const times=[...renderMs].sort((a,b)=>a-b);
    return {model:config.id,ready:!!root,active,clip:selected,actionTime:action?.time || 0,autoRotate:orbit?.autoRotate || false,meshes:meshes.length,clips:Object.keys(clips),loadedMs,frames,medianRenderMs:times.length?times[Math.floor(times.length/2)]:null,rendererTriangles:renderer?.info.render.triangles || 0,assetURL,triangles:meshes.reduce((n,m)=>n+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0),toon:meshes.every(m=>!!m.material.userData.highhornToon),morphs:Object.fromEntries(meshes.filter(m=>m.morphTargetInfluences).map(m=>[m.name,[...m.morphTargetInfluences]])),error:failure,modelRequests:root?1:0,canvasCount:shell?.querySelectorAll('canvas').length || 0,mountedAt};
  }
  // Each board figure has its own bones and mixer. Geometry, textures and
  // materials are shared; only one lightweight GLB is downloaded for the board.
  let boardPending=null,boardSource=null,boardRetryAt=0;
  const boardHeroes=new Map();
  function cloneSkinned(source) {
    const copy=source.clone(true),mapping=new Map();
    function pair(a,b){mapping.set(a,b);a.children.forEach((c,i)=>pair(c,b.children[i]));}
    pair(source,copy);
    source.traverse(original=>{
      if(!original.isSkinnedMesh)return;
      const mesh=mapping.get(original);mesh.skeleton=original.skeleton.clone();
      mesh.skeleton.bones=original.skeleton.bones.map(b=>mapping.get(b));
      mesh.bindMatrix.copy(original.bindMatrix);mesh.bind(mesh.skeleton,mesh.bindMatrix);
      mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
    });
    return copy;
  }
  function populateBoard(entry) {
    if(entry.model||!boardSource)return;
    const model=cloneSkinned(boardSource.scene);model.scale.setScalar(.31/1.8);model.rotation.y=Math.PI/2;
    entry.group.add(model);entry.model=model;entry.mixer=new THREE.AnimationMixer(model);
    entry.clips=Object.fromEntries(boardSource.animations.map(c=>[c.name,c]));
    entry.placeholder.visible=false;
  }
  function loadBoard() {
    if(boardSource||boardPending||performance.now()<boardRetryAt)return;
    boardPending=ensureLoader().then(()=>new Promise((resolve,reject)=>new THREE.GLTFLoader().load('Models/Heroes/'+config.folder+'/'+config.boardFile,resolve,undefined,reject)))
      .then(gltf=>{
        if(!['idle','walk','run'].every(n=>gltf.animations.some(a=>a.name===n)))throw Error('Board animations missing');
        HighhornToon.apply(gltf.scene,{legacyBoard:true});
        boardSource=gltf;boardHeroes.forEach(populateBoard);
      })
      .catch(error=>{boardRetryAt=performance.now()+10000;console.warn('Highhorn board character:',error.message||error);})
      .finally(()=>{boardPending=null;});
  }
  let boardPortrait;
  function boardHero(slot,color) {
    let entry=boardHeroes.get(slot);
    if(!entry){
      const group=new THREE.Group();
      if(!boardPortrait){boardPortrait=new THREE.TextureLoader().load('Models/Heroes/'+config.folder+'/'+config.portraitFile);boardPortrait.encoding=THREE.sRGBEncoding;}
      const placeholder=new THREE.Sprite(new THREE.SpriteMaterial({map:boardPortrait,transparent:true}));placeholder.position.y=.19;placeholder.scale.set(.15,.15,1);group.add(placeholder);
      const marker=new THREE.Mesh(new THREE.RingGeometry(.045,.061,24),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.y=.003;group.add(marker);
      entry={modelId:config.id,group,marker,placeholder,model:null,mixer:null,last:0,clip:null};group.userData.commoner=entry;boardHeroes.set(slot,entry);
    } else {
      // Game movement tweens may still reference the previous wrapper. Reuse
      // the costly skinned figure, but give each board rebuild a fresh wrapper.
      entry.group=new THREE.Group();entry.group.userData.commoner=entry;
      entry.group.add(entry.placeholder,entry.marker);if(entry.model)entry.group.add(entry.model);
    }
    entry.marker.material.color.set(color);entry.last=0;entry.group.userData.walking=false;
    entry.group.rotation.set(0,0,0);populateBoard(entry);loadBoard();return entry.group;
  }
  function animateBoard(group,now,walking,reducedMotion) {
    const entry=group.userData.commoner;if(!entry?.mixer){loadBoard();return;}
    const name=walking?'walk':'idle';
    if(entry.clip!==name){
      const next=entry.mixer.clipAction(entry.clips[name]);next.reset().play();
      if(entry.action)entry.action.crossFadeTo(next,.18,false);
      entry.action=next;entry.clip=name;
    }
    const dt=entry.last?Math.min(.1,(now-entry.last)/1000):0;entry.last=now;
    if(reducedMotion&&!walking){entry.action.time=0;entry.mixer.update(0);}else entry.mixer.update(dt);
  }
  function inspectBoard(){return {ready:!!boardSource,heroes:[...boardHeroes.entries()].filter(([,e])=>e.group.parent).map(([slot,e])=>({slot,model:config.id,ready:!!e.model,triangles:e.model?(()=>{let n=0;e.model.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});return n;})():0,clip:e.clip,time:e.action?.time||0,bones:e.model?(()=>{let n=0;e.model.traverse(o=>{if(o.isBone)n++;});return n;})():0}))};}
  return {mount,suspend,setClip,inspect,capturePortrait,boardHero,animateBoard,inspectBoard};
  }
  const instances=new Map();let activePreview=null;
  function get(id){const config=resolve(id);if(!instances.has(config.id))instances.set(config.id,createCharacter(config));return instances.get(config.id);}
  return {
    modelFor,
    mount(host,settings={}){const next=get(settings.model);if(activePreview&&activePreview!==next)activePreview.suspend();activePreview=next;next.mount(host,settings);},
    suspend(){activePreview?.suspend();},setClip(name){activePreview?.setClip(name);},
    inspect(){return activePreview?activePreview.inspect():{ready:false,active:false,error:'',frames:0};},
    capturePortrait(){return activePreview?.capturePortrait()||null;},
    portrait(id){return 'Models/Heroes/'+resolve(id).folder+'/'+resolve(id).portraitFile;},
    models(){return Object.values(catalog).map(c=>({id:c.id,label:c.label,gender:c.gender}));},
    boardHero(slot,color,id){return get(id).boardHero(slot,color);},
    animateBoard(group,now,walking,reducedMotion){return get(group.userData.commoner.modelId).animateBoard(group,now,walking,reducedMotion);},
    inspectBoard(){const all=[...instances.values()].map(i=>i.inspectBoard());return {ready:all.some(i=>i.ready),heroes:all.flatMap(i=>i.heroes)};}
  };
})();
