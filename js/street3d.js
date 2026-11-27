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
  const chef = makePerson({ top: '#fffaf2', bottom: '#3d2616', skin: '#f2c79b', hair: '#2b1a10', hat: true });
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

  /* ---------- 路人 ---------- */
  const SKIN = ['#f2c79b', '#e0a878', '#c98e5e', '#f6d3b0'];
  const TOP = ['#c2601a', '#16873a', '#3b6fb6', '#8e44ad', '#d7261b', '#2b1a10', '#e9a443', '#5a3a22'];
  const BOTTOM = ['#3d2616', '#2c3e50', '#6b4f3a', '#1f2a44', '#7a7a7a'];
  const HAIR = ['#2b1a10', '#4a2c17', '#111111', '#8a5a2b'];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const EDGE = isSmall() ? 14 : 24;   // 從畫面外生成／消失的 x 範圍
  const DOOR = new THREE.Vector3(0, 0, -0.2);
  const walkers = [];

  function spawn(w, initial) {
    const fromShop = !initial && Math.random() < 0.3;     // 從店裡提著外帶走出來
    w.speed = 0.7 + Math.random() * 0.3;
    w.phase = Math.random() * Math.PI * 2;                  // 每秒移動距離（約 45–70 秒走完全程）
    w.lane = 2.4 + Math.random() * 2.1;
    w.dir = Math.random() < 0.5 ? 1 : -1;
    w.enter = !fromShop && Math.random() < 0.35;           // 是否走進店裡
    w.mesh.scale.setScalar(0.92 + Math.random() * 0.16);
    w.mesh.userData.bag.visible = fromShop || Math.random() < 0.2;
    if (fromShop) {
      w.state = 'exit';
      w.mesh.position.set(DOOR.x + (Math.random() - 0.5) * 0.6, 0, DOOR.z);
      w.opacity = 0;
    } else {
      w.state = 'walk';
      const x = initial ? (Math.random() * 2 - 1) * EDGE : -w.dir * EDGE;
      w.mesh.position.set(x, 0, w.lane);
      w.opacity = 1;
    }
    setOpacity(w.mesh, w.opacity);
  }

  const count = isSmall() ? 7 : 14;
  for (let i = 0; i < count; i++) {
    const mesh = makePerson({ top: pick(TOP), bottom: pick(BOTTOM), skin: pick(SKIN), hair: pick(HAIR), skirt: Math.random() < 0.3 });
    scene.add(mesh);
    const w = { mesh };
    spawn(w, true);
    walkers.push(w);
  }

  // 店門口排隊的人
  [[-3.7, 1.35], [-3.0, 1.55], [-2.3, 1.75]].forEach(([x, z], i) => {
    const p = makePerson({ top: pick(TOP), bottom: pick(BOTTOM), skin: pick(SKIN), hair: pick(HAIR) });
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
    // 走路動作：每 1 秒一步、幅度小，看起來自然不抖
    w.phase += dt * Math.PI * 2 / 1.0;
    const sw = Math.sin(w.phase), L = w.mesh.userData.limbs;
    L.legL.rotation.x = sw * 0.35; L.legR.rotation.x = -sw * 0.35;
    L.armL.rotation.x = -sw * 0.3; L.armR.rotation.x = sw * 0.3;
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
function makePerson({ top, bottom, skin, hair, skirt = false, hat = false }) {
  const g = new THREE.Group();
  const m = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, transparent: true });
  const add = (geo, material, x, y, z) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh;
  };
  // 四肢以關節為軸心，方便做走路擺動
  const limb = (geo, material, x, y, len) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(geo, material); mesh.position.y = -len / 2; mesh.castShadow = true;
    pivot.add(mesh); g.add(pivot); return pivot;
  };
  const legGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.85, 10);
  const legL = limb(legGeo, m(bottom), -0.13, 0.86, 0.85);
  const legR = limb(legGeo, m(bottom), 0.13, 0.86, 0.85);
  if (skirt) add(new THREE.ConeGeometry(0.42, 0.55, 14, 1, true), m(top), 0, 0.95, 0);
  add(new THREE.CapsuleGeometry(0.28, 0.55, 6, 12), m(top), 0, 1.3, 0);
  const armGeo = new THREE.CapsuleGeometry(0.075, 0.5, 4, 8);
  const armL = limb(armGeo, m(top), -0.36, 1.55, 0.6); armL.rotation.z = 0.12;
  const armR = limb(armGeo, m(top), 0.36, 1.55, 0.6); armR.rotation.z = -0.12;
  g.userData.limbs = { legL, legR, armL, armR };
  add(new THREE.SphereGeometry(0.24, 16, 12), m(skin), 0, 1.95, 0);
  const hairMesh = add(new THREE.SphereGeometry(0.255, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m(hair), 0, 1.97, -0.02);
  hairMesh.rotation.x = -0.25;
  if (hat) add(new THREE.CylinderGeometry(0.2, 0.22, 0.3, 14), m('#ffffff'), 0, 2.27, 0);
  const bag = add(new THREE.BoxGeometry(0.28, 0.32, 0.18), m('#fffaf2'), 0.46, 0.85, 0.05);
  bag.visible = false;
  g.userData.bag = bag;
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
