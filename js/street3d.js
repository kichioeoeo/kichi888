/* ==========================================================
 * 3D 街景：人來人往、走進餃浸腦汁鍋貼店
 * 以 Three.js 建構；載入失敗時頁面保留 2D 版本。
 * ========================================================== */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const stage = document.getElementById('streetStage');
if (stage && hasWebGL()) init().catch(err => console.warn('[street3d] fallback to 2D:', err));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

async function init() {
  const isSmall = () => stage.clientWidth < 640;

  /* ---------- 基本場景 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'street3d-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const SKY = new THREE.Color('#f6e2c4');
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 40, 75);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

  scene.add(new THREE.HemisphereLight('#fff4e0', '#b08a5e', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b8', 1.6);
  sun.position.set(-8, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 12, bottom: -8, near: 1, far: 50 });
  scene.add(sun);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
  const box = (w, h, d, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  };

  /* ---------- 地面：人行道＋馬路 ---------- */
  const ground = new THREE.Group();
  const sidewalk = box(80, 0.2, 5, mat('#dcc09a')); sidewalk.position.set(0, -0.1, 2.5);
  const curb = box(80, 0.25, 0.3, mat('#c9a477')); curb.position.set(0, -0.05, 5.1);
  const road = box(80, 0.1, 12, mat('#5f5045')); road.position.set(0, -0.2, 11);
  ground.add(sidewalk, curb, road);
  for (let x = -38; x < 40; x += 4) {             // 馬路標線
    const line = box(2, 0.02, 0.18, mat('#f3e8d3')); line.position.set(x, -0.14, 9); ground.add(line);
  }
  for (let x = -38; x < 40; x += 2) {             // 人行道磚縫
    const seam = box(0.04, 0.01, 5, mat('#cfb08a')); seam.position.set(x, 0.005, 2.5); ground.add(seam);
  }
  scene.add(ground);

  /* ---------- 兩側建築 ---------- */
  const bColors = ['#e6c79c', '#ead2ad', '#dfbd8e', '#e9cfa5'];
  const winMat = mat('#fff1d6', { emissive: '#ffd9a0', emissiveIntensity: 0.25 });
  const buildingXs = [-30, -22, -14, 14, 22, 30];
  buildingXs.forEach((x, i) => {
    const h = 7 + (i * 37 % 5);
    const w = 7.4;
    const b = box(w, h, 6, mat(bColors[i % bColors.length])); b.position.set(x, h / 2, -3);
    scene.add(b);
    for (let wy = 1.6; wy < h - 1; wy += 2.2) {
      for (let wx = -w / 2 + 1.2; wx < w / 2 - 0.8; wx += 1.8) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), winMat);
        win.position.set(x + wx + 0.2, wy, 0.01); scene.add(win);
      }
    }
  });

  /* ---------- 店面 ---------- */
  const shop = new THREE.Group();
  const SHOP_W = 10, SHOP_H = 6;
  const body = box(SHOP_W, SHOP_H, 6, mat('#75492a')); body.position.set(0, SHOP_H / 2, -3); shop.add(body);
  const roof = box(SHOP_W + 0.4, 0.4, 6.4, mat('#3d2616')); roof.position.set(0, SHOP_H + 0.2, -3); shop.add(roof);

  // 招牌（Canvas 繪製文字）
  if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
  const signTex = makeSignTexture();
  const sign = new THREE.Mesh(new THREE.BoxGeometry(SHOP_W - 0.6, 1.4, 0.3),
    [mat('#3d2616'), mat('#3d2616'), mat('#3d2616'), mat('#3d2616'), new THREE.MeshBasicMaterial({ map: signTex }), mat('#3d2616')]);
  sign.position.set(0, SHOP_H - 0.9, 0.2); sign.castShadow = true; shop.add(sign);

  // 遮雨棚（橘白條紋，斜向外）
  const awning = new THREE.Group();
  const stripes = 12, stripeW = (SHOP_W + 0.6) / stripes;
  for (let i = 0; i < stripes; i++) {
    const s = box(stripeW, 0.08, 2.2, mat(i % 2 ? '#fffaf2' : '#c2601a'));
    s.position.set(-SHOP_W / 2 - 0.3 + stripeW * (i + 0.5), 0, 1.1);
    awning.add(s);
    const flap = new THREE.Mesh(new THREE.ConeGeometry(stripeW / 2, 0.35, 3), mat(i % 2 ? '#fffaf2' : '#c2601a'));
    flap.rotation.x = Math.PI; flap.position.set(s.position.x, -0.2, 2.2); awning.add(flap);
  }
  awning.position.set(0, SHOP_H - 2.0, 0); awning.rotation.x = 0.32; shop.add(awning);

  // 窗戶（溫暖燈光）＋煎台
  const glow = mat('#ffe7b8', { emissive: '#ffcf85', emissiveIntensity: 0.55 });
  const winL = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), glow); winL.position.set(-3.1, 2.4, 0.02); shop.add(winL);
  const winR = winL.clone(); winR.position.x = 3.1; shop.add(winR);
  const counter = box(3, 0.9, 0.8, mat('#fbe3a6')); counter.position.set(-3.1, 0.45, 0.5); shop.add(counter);
  const griddle = box(2.2, 0.12, 0.6, mat('#2b1a10', { roughness: 0.4, metalness: 0.4 })); griddle.position.set(-3.1, 0.96, 0.5); shop.add(griddle);
  const gyozaMat = mat('#e9a443');
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gyozaMat);
    g.scale.set(1.5, 0.8, 0.8); g.position.set(-3.9 + i * 0.4, 1.02, 0.5); shop.add(g);
  }
  // 店員
  const chef = makePerson({ age: 'adult', gender: 'm', skin: '#e8b48a', top: '#fffaf2', bottom: '#3d2616', hair: '#2b1a10', hairStyle: 'short', chef: true });
  chef.position.set(-3.1, 0, -0.3); shop.add(chef);

  // 門（入口）
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.2), mat('#2b1a10', { emissive: '#5a3010', emissiveIntensity: 0.6 }));
  door.position.set(0, 1.6, 0.02); shop.add(door);
  const doorFrame = box(2.3, 0.2, 0.2, mat('#3d2616')); doorFrame.position.set(0, 3.3, 0.1); shop.add(doorFrame);
  // 綠色「現煎」小牌
  const green = box(1.4, 0.6, 0.12, mat('#16873a')); green.position.set(3.1, 3.8, 0.12); shop.add(green);

  // 燈籠
  const lanterns = [];
  [-SHOP_W / 2 + 0.6, SHOP_W / 2 - 0.6].forEach((x, i) => {
    const pivot = new THREE.Group(); pivot.position.set(x, SHOP_H - 2.2, 2.2);
    const string = box(0.03, 0.4, 0.03, mat('#3d2616')); string.position.y = -0.2; pivot.add(string);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat('#e2361b', { emissive: '#e2361b', emissiveIntensity: 0.35 }));
    lantern.scale.y = 1.2; lantern.position.y = -0.85; lantern.castShadow = true; pivot.add(lantern);
    const tassel = box(0.3, 0.12, 0.3, mat('#f3a259')); tassel.position.y = -1.4; pivot.add(tassel);
    pivot.userData.phase = i * 1.7; lanterns.push(pivot); shop.add(pivot);
  });
  scene.add(shop);

  // 熱氣
  const steamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
  const steam = Array.from({ length: 6 }, (_, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), steamMat.clone());
    s.userData.t = i / 6; scene.add(s); return s;
  });

  /* ---------- 路人（寫實比例、各年齡層） ---------- */
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const EDGE = isSmall() ? 14 : 24;   // 從畫面外生成／消失的 x 範圍
  const DOOR = new THREE.Vector3(0, 0, -0.2);
  const walkers = [];

  // 走路參數：速度（單位/秒）、步伐週期（秒）、擺動幅度
  const GAIT = {
    child:  { speed: 0.85, period: 0.75, amp: 0.45 },
    teen:   { speed: 0.9,  period: 0.95, amp: 0.38 },
    adult:  { speed: 0.85, period: 1.0,  amp: 0.34 },
    office: { speed: 0.95, period: 0.95, amp: 0.32 },
    middle: { speed: 0.75, period: 1.05, amp: 0.3 },
    elder:  { speed: 0.5,  period: 1.3,  amp: 0.18 }
  };
  // 隨機組合：單人或結伴（親子、老夫妻、學生同學）
  function makeGroup() {
    const r = Math.random();
    let members;
    if (r < 0.14) members = [randomPerson('adult'), randomPerson('child')];               // 親子
    else if (r < 0.22) members = [randomPerson('elder', 'm'), randomPerson('elder', 'f')]; // 老夫妻
    else if (r < 0.28) members = [randomPerson('teen'), randomPerson('teen')];             // 同學
    else members = [randomPerson(pick(['child', 'teen', 'adult', 'adult', 'office', 'office', 'middle', 'middle', 'elder']))];
    const g = new THREE.Group();
    members.forEach((m, i) => { m.position.set(i ? 0.75 : 0, 0, i ? -0.35 : 0); g.add(m); });
    g.userData.members = members;
    g.userData.limbs = members.map(m => m.userData);
    g.userData.bag = members[0].userData.bag;
    g.userData.gait = members.reduce((slow, m) => (GAIT[m.userData.age].speed < GAIT[slow].speed ? m.userData.age : slow), members[0].userData.age);
    return g;
  }

  function spawn(w, initial) {
    if (w.mesh) {                                       // 每次重新出場都換一組新面孔（釋放舊模型記憶體）
      scene.remove(w.mesh);
      w.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    }
    w.mesh = makeGroup();
    scene.add(w.mesh);
    const gait = GAIT[w.mesh.userData.gait];
    const fromShop = !initial && Math.random() < 0.3;   // 從店裡提著外帶走出來
    w.speed = gait.speed * (0.9 + Math.random() * 0.2);
    w.phase = Math.random() * Math.PI * 2;
    w.lane = 2.4 + Math.random() * 2.1;
    w.dir = Math.random() < 0.5 ? 1 : -1;
    w.enter = !fromShop && Math.random() < 0.35;        // 是否走進店裡
    w.mesh.userData.bag.visible = fromShop;
    if (fromShop) {
      w.state = 'exit';
      w.mesh.position.set(DOOR.x + (Math.random() - 0.5) * 0.4, 0, DOOR.z);
      w.opacity = 0;
    } else {
      w.state = 'walk';
      const x = initial ? (Math.random() * 2 - 1) * EDGE : -w.dir * EDGE;
      w.mesh.position.set(x, 0, w.lane);
      w.opacity = 1;
    }
    setOpacity(w.mesh, w.opacity);
  }

  const count = isSmall() ? 6 : 12;
  for (let i = 0; i < count; i++) {
    const w = {};
    spawn(w, true);
    walkers.push(w);
  }

  // 店門口排隊的人（不同年齡）
  [['middle', -3.7, 1.35], ['child', -3.05, 1.5], ['office', -2.4, 1.7]].forEach(([age, x, z], i) => {
    const p = randomPerson(age);
    p.position.set(x, 0, z); p.rotation.y = Math.PI + 0.12 * (i - 1);
    scene.add(p);
  });

  const tmp = new THREE.Vector3();
  function step(w, dt) {
    const p = w.mesh.position;
    let target;
    if (w.state === 'walk') {
      p.x += w.dir * w.speed * dt;
      target = tmp.set(p.x + w.dir, 0, w.lane);
      // 走到門口附近時轉進店裡
      if (w.enter && Math.abs(p.x - DOOR.x) < 0.3) w.state = 'enter';
      if (Math.abs(p.x) > EDGE + 1) spawn(w, false);
    } else if (w.state === 'enter') {
      target = tmp.set(DOOR.x, 0, DOOR.z - 1);
      moveToward(p, target, w.speed * dt);
      if (p.z < 1.2) { w.opacity -= dt * 1.2; setOpacity(w.mesh, Math.max(w.opacity, 0)); }
      if (p.z <= DOOR.z + 0.05 || w.opacity <= 0) spawn(w, false);
    } else if (w.state === 'exit') {
      target = tmp.set(p.x, 0, w.lane);
      moveToward(p, target, w.speed * dt);
      w.opacity = Math.min(w.opacity + dt * 1.2, 1); setOpacity(w.mesh, w.opacity);
      if (Math.abs(p.z - w.lane) < 0.02) { w.state = 'walk'; w.enter = false; }
    }
    // 走路動作：依年齡調整步伐快慢與幅度（長輩小步慢走、小孩步伐輕快）
    const groupGait = GAIT[w.mesh.userData.gait];
    w.phase += dt * Math.PI * 2 / groupGait.period;
    w.mesh.userData.limbs.forEach((L, i) => {
      const g = GAIT[L.age];
      const sw = Math.sin(w.phase * (groupGait.period / g.period) + i * 1.3);
      L.legL.rotation.x = sw * g.amp; L.legR.rotation.x = -sw * g.amp;
      L.armL.rotation.x = -sw * g.amp * 0.8;
      if (!L.cane) L.armR.rotation.x = sw * g.amp * 0.8;
    });
    // 面向前進方向（平滑轉身）
    const dx = target.x - p.x, dz = target.z - p.z;
    if (dx * dx + dz * dz > 1e-6) {
      const want = Math.atan2(dx, dz);
      let diff = want - w.mesh.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      w.mesh.rotation.y += diff * Math.min(1, dt * 4);
    }
  }
  function moveToward(p, t, dist) {
    const dx = t.x - p.x, dz = t.z - p.z, len = Math.hypot(dx, dz);
    if (len <= dist) { p.x = t.x; p.z = t.z; return; }
    p.x += dx / len * dist; p.z += dz / len * dist;
  }

  /* ---------- 版面與鏡頭 ---------- */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const small = w < 640;
    camera.position.set(0, small ? 6.5 : 6.2, small ? 23 : 21);
    camera.lookAt(0, small ? 2.2 : 2.4, 0);
    camera.updateProjectionMatrix();
  }

  /* ---------- 動畫迴圈（離開畫面時暫停） ---------- */
  const clock = new THREE.Clock();
  let running = false, raf = 0, t = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    walkers.forEach(w => step(w, dt));
    lanterns.forEach(l => { l.rotation.z = Math.sin(t * 1.2 + l.userData.phase) * 0.06; });
    steam.forEach((s, i) => {
      const k = (s.userData.t + t * 0.18) % 1;
      s.position.set(-3.1 + Math.sin(k * 6 + i) * 0.3 + (i % 3 - 1) * 0.5, 1.2 + k * 2.4, 0.6);
      s.scale.setScalar(0.6 + k * 1.4);
      s.material.opacity = Math.sin(k * Math.PI) * 0.45;
    });
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  stage.appendChild(renderer.domElement);
  stage.classList.add('is-3d');
  resize();
  frame();                                           // 先畫一張靜態畫面
  new ResizeObserver(() => { resize(); if (!running) renderer.render(scene, camera); }).observe(stage);
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}

/* ---------- 小工具 ---------- */
/* 寫實人物：以公尺為單位建模，再整體放大配合場景比例 */
const SKINS = ['#f3cfae', '#e8b48a', '#d49a6a', '#b97d52', '#f6dcc2'];
const HAIR_DARK = ['#1b120c', '#2b1a10', '#3a2416', '#4a2c17', '#6b4423'];
const HAIR_GREY = ['#bdb7ae', '#d8d3cb', '#9e978c', '#efebe4'];
const CASUAL = ['#c2601a', '#16873a', '#3b6fb6', '#8e44ad', '#d7261b', '#e9a443', '#5a7d9a', '#f1e4cf', '#2f4f4f', '#b5651d'];
const PANTS = ['#2c3e50', '#1f2a44', '#3d2616', '#6b4f3a', '#4b4b4b', '#7d8ca3'];
const SCENE_SCALE = 1.35;

function randomPerson(age, gender) {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  gender = gender || (Math.random() < 0.5 ? 'm' : 'f');
  const o = { age, gender, skin: pick(SKINS) };
  if (age === 'child') {
    Object.assign(o, { top: pick(['#f4b400', '#e94b3c', '#4aa3df', '#7bc96f', '#f78fb3']), bottom: pick(['#1f2a44', '#3b6fb6', '#6b4f3a']),
      hair: pick(HAIR_DARK), hairStyle: gender === 'f' ? pick(['pony', 'long']) : 'short', skirt: gender === 'f' && Math.random() < 0.5,
      backpack: Math.random() < 0.6 ? pick(['#d7261b', '#3b6fb6', '#f4b400']) : null });
  } else if (age === 'teen') {
    Object.assign(o, { top: '#f5f5f0', bottom: gender === 'f' ? '#2c3e66' : '#3a3f4a', hair: pick(HAIR_DARK),
      hairStyle: gender === 'f' ? pick(['pony', 'long', 'bob']) : pick(['short', 'cap']), skirt: gender === 'f', backpack: pick(['#1f2a44', '#2b1a10', '#16873a']) });
  } else if (age === 'office') {
    Object.assign(o, { top: pick(['#ffffff', '#dfe9f5', '#f1e4cf']), jacket: pick(['#1f2a44', '#2b2b2b', '#4a4a55', null]), bottom: pick(['#1f2a44', '#2b2b2b', '#4a4a55']),
      hair: pick(HAIR_DARK), hairStyle: gender === 'f' ? pick(['bun', 'bob', 'long']) : 'short', tie: gender === 'm' ? pick(['#a24d12', '#16873a', '#7a1f1f']) : null,
      skirt: gender === 'f' && Math.random() < 0.5, briefcase: Math.random() < 0.5, glasses: Math.random() < 0.35 });
  } else if (age === 'middle') {
    Object.assign(o, { top: pick(CASUAL), jacket: Math.random() < 0.4 ? pick(['#6b4f3a', '#5a7d9a', '#8a7f6a']) : null, bottom: pick(PANTS),
      hair: Math.random() < 0.5 ? pick(HAIR_DARK) : '#5a5048', hairStyle: gender === 'f' ? pick(['bob', 'bun', 'perm']) : pick(['short', 'thin']),
      girth: 1.12, glasses: Math.random() < 0.4, handbag: gender === 'f' && Math.random() < 0.6 });
  } else if (age === 'elder') {
    Object.assign(o, { top: pick(['#8a7f6a', '#a0522d', '#6b7b5e', '#b99c7a', '#7a6a8a']), jacket: Math.random() < 0.5 ? pick(['#5b4a3a', '#4a5560']) : null,
      bottom: pick(['#4b4b4b', '#5b4a3a', '#2c3e50']), hair: pick(HAIR_GREY), hairStyle: gender === 'f' ? pick(['perm', 'bun']) : pick(['thin', 'bald', 'cap']),
      stoop: 0.12 + Math.random() * 0.08, cane: Math.random() < 0.5, glasses: Math.random() < 0.7, girth: 1.05 });
  } else {
    Object.assign(o, { top: pick(CASUAL), bottom: pick(PANTS), hair: pick(HAIR_DARK),
      hairStyle: gender === 'f' ? pick(['long', 'pony', 'bob', 'bun']) : pick(['short', 'short', 'cap']),
      skirt: gender === 'f' && Math.random() < 0.35, handbag: gender === 'f' && Math.random() < 0.4, backpack: Math.random() < 0.2 ? '#2b2b2b' : null });
  }
  return makePerson(o);
}

function makePerson(o) {
  const { age = 'adult', gender = 'm', skin = '#e8b48a', top = '#c2601a', bottom = '#2c3e50', hair = '#2b1a10', hairStyle = 'short' } = o;
  // 身高與頭身比：小孩約 5 頭身、成人約 7.5 頭身、長輩略矮
  const H = { child: 1.15, teen: 1.62, adult: gender === 'f' ? 1.62 : 1.74, office: gender === 'f' ? 1.63 : 1.75,
    middle: gender === 'f' ? 1.58 : 1.7, elder: gender === 'f' ? 1.52 : 1.62 }[age] * (0.97 + Math.random() * 0.06);
  const headH = age === 'child' ? H / 5.2 : age === 'teen' ? H / 7 : H / 7.5;
  const headR = headH / 2.2;
  const girth = (o.girth || 1) * (age === 'child' ? 0.78 : gender === 'f' ? 0.9 : 1);
  const legLen = H * (age === 'child' ? 0.44 : 0.47);
  const hipY = legLen + 0.06;
  const torsoH = H - hipY - headH - 0.05;
  const shoulderY = hipY + torsoH;
  const shoulderW = (gender === 'f' ? 0.17 : 0.2) * girth * (age === 'child' ? 0.85 : 1);

  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);       // 上半身（長輩駝背用）
  const cache = {};
  const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, transparent: true });
  const mesh = (geo, color, parent, x = 0, y = 0, z = 0) => {
    const me = new THREE.Mesh(geo, m(color)); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me;
  };
  const limb = (parent, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); parent.add(p); return p; };

  // 腿＋鞋
  const legR0 = 0.065 * girth, legR1 = 0.045 * girth;
  const legL = limb(g, -0.085 * girth, hipY), legR = limb(g, 0.085 * girth, hipY);
  [legL, legR].forEach(leg => {
    mesh(new THREE.CylinderGeometry(legR0, legR1, legLen, 10), bottom, leg, 0, -legLen / 2, 0);
    mesh(new THREE.BoxGeometry(0.09, 0.06, 0.22), age === 'child' ? '#ffffff' : (age === 'office' ? '#1a1a1a' : '#3a2a20'), leg, 0, -legLen - 0.03, 0.04);
  });
  if (o.skirt) mesh(new THREE.CylinderGeometry(0.15 * girth, 0.24 * girth, legLen * 0.55, 16, 1, true), bottom, g, 0, hipY - legLen * 0.25, 0).material.side = THREE.DoubleSide;

  // 身體：腰到肩，略寬肩窄腰、前後較薄
  body.position.y = hipY;
  const torso = mesh(new THREE.CylinderGeometry(shoulderW, 0.15 * girth, torsoH, 16), o.jacket || top, body, 0, torsoH / 2, 0);
  torso.scale.z = 0.62;
  if (o.jacket) {           // 外套敞開露出內搭
    const inner = mesh(new THREE.BoxGeometry(shoulderW * 0.55, torsoH * 0.85, 0.02), top, body, 0, torsoH * 0.52, shoulderW * 0.6);
    inner.castShadow = false;
  }
  if (o.chef) mesh(new THREE.BoxGeometry(shoulderW * 1.4, torsoH * 1.15, 0.02), '#ffffff', body, 0, torsoH * 0.4, shoulderW * 0.64);
  if (o.tie) mesh(new THREE.BoxGeometry(0.04, torsoH * 0.6, 0.015), o.tie, body, 0, torsoH * 0.6, shoulderW * 0.64);
  if (o.backpack) mesh(new THREE.BoxGeometry(shoulderW * 1.5, torsoH * 0.7, 0.14), o.backpack, body, 0, torsoH * 0.55, -shoulderW * 0.75);

  // 脖子與頭
  mesh(new THREE.CylinderGeometry(headR * 0.38, headR * 0.42, 0.07, 10), skin, body, 0, torsoH + 0.035, 0);
  const head = new THREE.Group(); head.position.y = torsoH + 0.05 + headR * 1.05; body.add(head);
  const skull = mesh(new THREE.SphereGeometry(headR, 20, 16), skin, head); skull.scale.set(0.92, 1.12, 1);
  // 五官：眼睛、眉毛、鼻子、嘴巴、耳朵
  const eyeY = headR * 0.1, faceZ = headR * 0.93;
  [-1, 1].forEach(sd => {
    mesh(new THREE.SphereGeometry(headR * 0.11, 8, 6), '#1b120c', head, sd * headR * 0.36, eyeY, faceZ - 0.005).castShadow = false;
    mesh(new THREE.BoxGeometry(headR * 0.32, headR * 0.06, 0.01), age === 'elder' ? '#9e978c' : '#2b1a10', head, sd * headR * 0.36, eyeY + headR * 0.22, faceZ - 0.01).castShadow = false;
    mesh(new THREE.SphereGeometry(headR * 0.2, 8, 6), skin, head, sd * headR * 0.9, eyeY - headR * 0.05, 0).scale.set(0.5, 1, 0.7);
  });
  const nose = mesh(new THREE.ConeGeometry(headR * 0.12, headR * 0.3, 6), skin, head, 0, -headR * 0.12, faceZ + headR * 0.05);
  nose.rotation.x = Math.PI / 2; nose.castShadow = false;
  mesh(new THREE.BoxGeometry(headR * 0.42, headR * 0.06, 0.01), '#a0524a', head, 0, -headR * 0.45, faceZ - 0.03).castShadow = false;
  if (age === 'child') [-1, 1].forEach(sd => { mesh(new THREE.SphereGeometry(headR * 0.12, 8, 6), '#f29a8a', head, sd * headR * 0.55, -headR * 0.2, faceZ - 0.04).castShadow = false; });
  if (o.glasses) {
    [-1, 1].forEach(sd => { const r = mesh(new THREE.TorusGeometry(headR * 0.2, headR * 0.03, 6, 14), '#2b2b2b', head, sd * headR * 0.36, eyeY, faceZ + 0.01); r.castShadow = false; });
    mesh(new THREE.BoxGeometry(headR * 0.3, headR * 0.03, 0.01), '#2b2b2b', head, 0, eyeY, faceZ + 0.01).castShadow = false;
  }

  // 髮型
  const hairCap = (thetaLen = Math.PI * 0.55) => {
    const c = mesh(new THREE.SphereGeometry(headR * 1.06, 20, 14, 0, Math.PI * 2, 0, thetaLen), hair, head, 0, headR * 0.05, -headR * 0.04);
    c.scale.set(0.95, 1.12, 1.02); c.rotation.x = -0.35; return c;
  };
  if (hairStyle === 'short') hairCap(Math.PI * 0.5);
  else if (hairStyle === 'thin') hairCap(Math.PI * 0.32);
  else if (hairStyle === 'bald') {
    const ring = mesh(new THREE.TorusGeometry(headR * 0.92, headR * 0.16, 8, 20, Math.PI * 1.3), hair, head, 0, 0, -headR * 0.15);
    ring.rotation.set(Math.PI / 2, 0, Math.PI * 0.85);
  } else if (hairStyle === 'cap') {
    hairCap(Math.PI * 0.45);
    const capColor = age === 'elder' ? '#5b4a3a' : ['#d7261b', '#1f2a44', '#16873a'][Math.floor(Math.random() * 3)];
    mesh(new THREE.SphereGeometry(headR * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4), capColor, head, 0, headR * 0.15, 0);
    mesh(new THREE.BoxGeometry(headR * 1.2, headR * 0.06, headR * 0.8), capColor, head, 0, headR * 0.45, headR * 0.9);
  } else {
    hairCap(Math.PI * 0.6);
    if (hairStyle === 'long') mesh(new THREE.BoxGeometry(headR * 1.8, headR * 2.4, headR * 0.5), hair, head, 0, -headR * 0.9, -headR * 0.6);
    if (hairStyle === 'bob') mesh(new THREE.CylinderGeometry(headR * 1.08, headR * 1.12, headR * 1.1, 16, 1, true), hair, head, 0, -headR * 0.2, -headR * 0.08).material.side = THREE.DoubleSide;
    if (hairStyle === 'pony') { const t = mesh(new THREE.CapsuleGeometry(headR * 0.22, headR * 1.1, 4, 8), hair, head, 0, -headR * 0.3, -headR * 1.1); t.rotation.x = 0.3; }
    if (hairStyle === 'bun') mesh(new THREE.SphereGeometry(headR * 0.38, 12, 10), hair, head, 0, headR * 0.7, -headR * 0.75);
    if (hairStyle === 'perm') for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      mesh(new THREE.SphereGeometry(headR * 0.32, 8, 6), hair, head, Math.cos(a) * headR * 0.85, headR * 0.35 + Math.sin(i) * headR * 0.15, Math.sin(a) * headR * 0.85 - headR * 0.1);
    }
  }
  if (o.chef) mesh(new THREE.CylinderGeometry(headR * 0.95, headR * 0.85, headR * 1.2, 16), '#ffffff', head, 0, headR * 1.3, 0);

  // 手臂（袖子＋手掌），以肩膀為軸心
  const armLen = H * 0.36;
  const sleeve = o.jacket || top;
  const armL = limb(body, -(shoulderW + 0.035), torsoH - 0.03), armR = limb(body, shoulderW + 0.035, torsoH - 0.03);
  [armL, armR].forEach((arm, i) => {
    arm.rotation.z = i ? -0.08 : 0.08;
    mesh(new THREE.CapsuleGeometry(0.038 * girth, armLen - 0.1, 4, 8), sleeve, arm, 0, -armLen / 2, 0);
    mesh(new THREE.SphereGeometry(0.042, 10, 8), skin, arm, 0, -armLen + 0.01, 0);
  });
  // 手上的東西
  if (o.briefcase) mesh(new THREE.BoxGeometry(0.08, 0.26, 0.36), '#3a2a20', armR, 0, -armLen - 0.1, 0);
  if (o.handbag) mesh(new THREE.BoxGeometry(0.1, 0.18, 0.24), ['#a24d12', '#7a1f1f', '#2b2b2b'][Math.floor(Math.random() * 3)], armL, 0, -armLen * 0.55, 0.02);
  let cane = null;
  if (o.cane) { cane = mesh(new THREE.CylinderGeometry(0.014, 0.014, hipY - 0.05, 6), '#5b3a22', g, shoulderW + 0.06, (hipY - 0.05) / 2, 0.12); }
  const bag = mesh(new THREE.BoxGeometry(0.2, 0.22, 0.14), '#fffaf2', armL, 0, -armLen - 0.1, 0);   // 鍋貼外帶袋
  mesh(new THREE.BoxGeometry(0.21, 0.04, 0.15), '#c2601a', bag, 0, 0.04, 0);
  bag.visible = false;

  if (o.stoop) { body.rotation.x = o.stoop; head.rotation.x = -o.stoop * 0.6; }

  g.scale.setScalar(SCENE_SCALE);
  Object.assign(g.userData, { age, legL, legR, armL, armR, bag, cane: !!cane });
  return g;
}

function setOpacity(group, o) {
  group.traverse(obj => { if (obj.material) { obj.material.opacity = o; obj.material.depthWrite = o > 0.98; } });
  group.visible = o > 0.01;
}

function makeSignTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#3d2616'; x.fillRect(0, 0, c.width, c.height);
  x.font = 'italic 900 92px "Noto Sans TC", sans-serif';
  x.fillStyle = '#fffaf2'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('餃浸腦汁鍋貼店', 440, 84);
  x.save(); x.translate(860, 80); x.transform(1, 0, -0.2, 1, 0, 0);
  x.fillStyle = '#16873a'; x.fillRect(-70, -38, 140, 76);
  x.font = '700 52px "Noto Sans TC", sans-serif'; x.fillStyle = '#ffffff';
  x.fillText('現煎', 0, 4); x.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
