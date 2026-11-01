/* Highhorn: lazy, reusable Male Commoner preview. Three.js r128; no game rules. */
'use strict';
window.HighhornCommoner = (() => {
  const assetURL = 'Models/Heroes/MaleCommoner/commoner.glb';
  const loaderURL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  let shell, viewport, notice, renderer, scene, camera, orbit, root, mixer, action;
  let pending = null, loaderPromise = null, active = false, raf = 0, previous = 0;
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
    if (name === 'rest') for (const saved of restPose) {
      saved.bone.position.copy(saved.position); saved.bone.quaternion.copy(saved.quaternion); saved.bone.scale.copy(saved.scale);
    }
    else { action = mixer.clipAction(clips[name]); action.reset().play(); mixer.update(0); }
    previous = 0;syncButtons();render();
  }
  function tick(now) {
    raf = 0;if (!active || document.hidden || !shell.isConnected) return;
    const elapsed = previous ? now - previous : 0;
    const interval = options.quality === 'low' ? 50 : 1000 / 30;
    if (!previous || elapsed >= interval - 1) {
      if (mixer && action) mixer.update(Math.min(.1, elapsed / 1000));
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
    failure='';setNotice('Loading Male Commoner…');shell.querySelector('.commoner-retry').hidden=true;
    const start=performance.now();
    pending=ensureLoader().then(() => new Promise((resolve,reject) => {
      new THREE.GLTFLoader().load(assetURL,resolve,event=>{if(event.total)setNotice('Loading Male Commoner… '+Math.round(100*event.loaded/event.total)+'%');},reject);
    })).then(gltf => {
      if (!gltf.animations.some(c=>c.name==='walk') || !gltf.animations.some(c=>c.name==='run')) throw new Error('This character is missing an animation.');
      root=gltf.scene;clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
      root.traverse(object=>{
        if(object.isBone)restPose.push({bone:object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()});
        if(object.isSkinnedMesh){object.frustumCulled=false;meshes.push(object);}
      });
      scene.add(root);mixer=new THREE.AnimationMixer(root);loadedMs=performance.now()-start;
      setClip('rest');setNotice('Male Commoner · Level 1');resize();resume();return root;
    }).catch(error=>{
      pending=null;failure='Could not load Male Commoner. Check your connection and try again.';
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
      failure='This device could not open the 3D character view. You can still choose the original prototype.';
      host.textContent=failure;console.warn('Highhorn character preview:',error.message);suspend();
    }
  }
  function capturePortrait() {
    if (!root) return null;
    if(portraitData)return portraitData;
    const saved=selected,time=action?.time || 0,size=renderer.getSize(new THREE.Vector2());
    setClip('rest');const portraitCamera=new THREE.PerspectiveCamera(24,1,.01,50);
    portraitCamera.position.set(.38,1.60,1.5);portraitCamera.lookAt(0,1.52,0);
    renderer.setSize(256,256,false);root.updateMatrixWorld(true);meshes.forEach(m=>m.skeleton.update());
    renderer.render(scene,portraitCamera);portraitData=renderer.domElement.toDataURL('image/png');
    renderer.setSize(size.x,size.y,false);setClip(saved);if(action){action.time=time;mixer.update(0);}render();return portraitData;
  }
  function inspect() {
    const times=[...renderMs].sort((a,b)=>a-b);
    return {ready:!!root,active,clip:selected,actionTime:action?.time || 0,autoRotate:orbit?.autoRotate || false,meshes:meshes.length,clips:Object.keys(clips),loadedMs,frames,medianRenderMs:times.length?times[Math.floor(times.length/2)]:null,rendererTriangles:renderer?.info.render.triangles || 0,error:failure,modelRequests:root?1:0,canvasCount:shell?.querySelectorAll('canvas').length || 0,mountedAt};
  }
  return {mount,suspend,setClip,inspect,capturePortrait};
})();
