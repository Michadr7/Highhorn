'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const out = path.resolve(__dirname, '../Exports/StyleStudy/2026-11-02/Toon_v2');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const port = process.env.HIGHHORN_DEBUG_PORT || '9247';
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json`, {signal: AbortSignal.timeout(10000)})).json();
  const tab = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map(), errors = [], requests = new Set();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id);
      if (handler) { pending.delete(message.id); message.error ? handler.reject(Error(JSON.stringify(message.error))) : handler.resolve(message.result); }
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(a => a.value || a.description).join(' '));
    } else if (message.method === 'Network.requestWillBeSent') requests.add(message.params.request.url);
  };
  function send(method, params = {}) {
    const key = ++id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(key); reject(Error(`Timed out: ${method}`)); }, 45000);
      pending.set(key, {resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); }});
      ws.send(JSON.stringify({id: key, method, params}));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    const start = Date.now();
    while (Date.now() - start < 60000) { if (await evaluate(expression)) return; await delay(250); }
    throw Error(`Not ready: ${expression}\n${errors.join('\n')}`);
  }
  async function screenshot(name) {
    await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const shot = await send('Page.captureScreenshot', {format: 'png'});
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(shot.data, 'base64'));
  }
  try {
    await send('Page.enable');
    await send('Page.navigate', {url: 'about:blank'});
    await send('Runtime.discardConsoleEntries');
    await send('Runtime.enable'); await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false});
    await send('Page.navigate', {url: 'http://localhost:8012/Exports/StyleStudy/2026-11-02/Toon_v2/'});
    await wait('window.highhornStyleStudy?.inspect().ready');
    const storageBefore = await evaluate('JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))');
    await evaluate('highhornStyleStudy.setPaused(true)');
    const initial = await evaluate('highhornStyleStudy.inspect()');
    assert.equal(initial.error, ''); assert.equal(initial.models.length, 2);
    for (const model of initial.models) {
      assert.equal(model.bones, 24); assert.equal(model.triangles, 175969); assert.equal(model.meshes, 5);
      assert.deepEqual([...model.clips].sort(), ['idle', 'run', 'walk']);
    }
    const cloth=initial.models[1].meshDetails.filter(m=>m.name!=='char1');
    assert(cloth.length===4 && cloth.every(m=>m.toon&&m.flat&&m.material==='MeshToonMaterial'));
    assert(initial.models[1].meshDetails.find(m=>m.name==='char1').material==='MeshStandardMaterial');
    const motion = {}, poses = [];
    for (const clip of ['idle', 'walk', 'run']) {
      let first, maximumMotion = 0;
      for (const progress of [0, .25, .5, .75, .999]) {
        await evaluate(`highhornStyleStudy.setClip('${clip}');highhornStyleStudy.setProgress(${progress})`);
        const state = await evaluate('highhornStyleStudy.inspect()');
        assert.equal(state.models[0].time, state.models[1].time, 'Mixers drifted apart');
        const samples = await evaluate('[highhornStyleStudy.sample(0),highhornStyleStudy.sample(1)]');
        assert(samples.every(points=>points.length>100));
        assert(samples.flat(2).every(Number.isFinite));
        let difference = 0;
        samples[0].forEach((point, i) => {
          // Correspondence is established in the Blender test; flat normals split vertices.
          if (first) maximumMotion = Math.max(maximumMotion, Math.hypot(...point.map((v, axis) => v - first[i][axis])));
        });
        assert(difference < .0121, `Unexpected shape change: ${difference}`);
        first ||= samples[0]; poses.push({clip, progress, finiteVertices: true});
      }
      assert(maximumMotion > (clip === 'idle' ? .00001 : .015));
      motion[clip] = maximumMotion;
    }
    await evaluate('highhornStyleStudy.setClip("idle");highhornStyleStudy.setProgress(.25);highhornStyleStudy.view("full")');
    await screenshot('Comparison');
    for (const view of ['face', 'back']) {
      await evaluate(`highhornStyleStudy.view('${view}')`); await screenshot(`Comparison_${view}`);
    }
    await evaluate('highhornStyleStudy.view("full");highhornStyleStudy.setClip("walk");highhornStyleStudy.setProgress(.25)');
    await screenshot('Comparison_walk');
    await evaluate('highhornStyleStudy.setClip("run");highhornStyleStudy.setProgress(.5)');
    await screenshot('Comparison_run');
    await evaluate('highhornStyleStudy.setPaused(false);highhornStyleStudy.setClip("walk")');
    await wait('highhornStyleStudy.inspect().models[0].time>.15');
    const playing = await evaluate('highhornStyleStudy.inspect()');
    assert.equal(playing.models[0].time, playing.models[1].time);
    await evaluate('highhornStyleStudy.setPaused(true);highhornStyleStudy.setTab("board")');
    await wait('document.querySelector("#boardFrame").contentWindow.highhornStyleBoard?.inspect().heroes.filter(h=>h.ready).length===2');
    const boardExpression = 'document.querySelector("#boardFrame").contentWindow.highhornStyleBoard';
    const board = await evaluate(`${boardExpression}.inspect()`);
    assert(board.memoryOnly && board.fixture && board.tiles > 30);
    assert.deepEqual(board.heroes.map(h => h.model).sort(), ['style-original', 'style-proposed']);
    assert(board.heroes.every(h => h.bones === 24));
    const cameras = [];
    for (const view of ['normal', 'close', 'map']) {
      await evaluate(`${boardExpression}.view('${view}')`); await delay(200);
      cameras.push((await evaluate(`${boardExpression}.inspect()`)).camera);
      await screenshot(`Board_${view}`);
    }
    assert.notDeepEqual(cameras[0], cameras[1]); assert.notDeepEqual(cameras[1], cameras[2]);
    assert.equal(await evaluate('document.querySelector("#boardFrame").contentWindow.localStorage !== localStorage'), true);
    assert.equal(await evaluate('JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))'), storageBefore);
    const config = JSON.parse(fs.readFileSync(path.join(out, 'study.json'), 'utf8'));
    for (const relative of [config.source, config.style]) assert([...requests].some(url => new URL(url).pathname === relative));
    await evaluate('highhornStyleStudy.setTab("reference")');
    await wait('document.querySelector(".art").complete && document.querySelector(".art").naturalWidth>0');
    await screenshot('Reference');
    await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
    await evaluate('highhornStyleStudy.setTab("compare");highhornStyleStudy.view("full");highhornStyleStudy.setClip("idle");highhornStyleStudy.setProgress(.25)');
    await delay(200);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), true);
    await screenshot('Mobile');
    await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false});
    await evaluate('highhornStyleStudy.setPaused(false)');
    const before = JSON.parse(fs.readFileSync(path.join(out, 'Production_Before.json'), 'utf8'));
    for (const [file, digest] of Object.entries(before)) {
      const current = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', file))).digest('hex');
      assert.equal(current, digest, `Production file changed: ${file}`);
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'Browser_Validation.json'), JSON.stringify({passed: true, models: initial.models, motion, poses, board, errors,
      scope: 'Four compiled flat toon clothing materials and smooth skin; two synchronized native skinned GLBs over fifteen poses, camera/animation controls, real board snapshot with two distinct model IDs, memory-only board storage, mobile overflow and production hashes. Visual screenshots retained; no continuous collision or production frame-rate certification.'}, null, 2));
    console.log('STYLE BROWSER CHECKS PASSED', JSON.stringify({motion, boardModels: board.heroes.map(h => h.model), errors}));
  } finally { ws.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
