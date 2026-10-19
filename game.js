import * as THREE from 'three';
import { buildCharacter, animateCharacter, cleanStyle, DEFAULT_STYLE } from './character.js';

/* ---------- start.ng connection ---------- */
const ORIGIN = 'https://start.ng';
let framePromise = null;
function connectFrame() {
  if (!framePromise) {
    framePromise = new Promise((resolve, reject) => {
      const f = document.createElement('iframe');
      f.src = ORIGIN + '/connect';
      f.style.display = 'none';
      f.onload = () => resolve(f);
      f.onerror = reject;
      document.body.appendChild(f);
    });
  }
  return framePromise;
}
async function ask(message, replyType, timeoutMs = 5000) {
  let frame;
  try { frame = await connectFrame(); } catch (e) { return null; }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (v) => { clearTimeout(timer); removeEventListener('message', on); resolve(v); };
    const timer = setTimeout(() => done(null), timeoutMs);
    function on(e) {
      if (e.origin !== ORIGIN || e.source !== frame.contentWindow) return;
      const d = e.data;
      if (!d || d.type !== replyType || d.requestId !== requestId) return;
      done(d);
    }
    addEventListener('message', on);
    frame.contentWindow.postMessage({ ...message, requestId }, ORIGIN);
  });
}

// The sign-in redirect puts a session in the hash. We use the connect page, so just tidy the URL.
if (location.hash.includes('startng_session')) {
  history.replaceState(null, '', location.pathname + location.search);
}
const isGuestMode = new URLSearchParams(location.search).has('guest');
const signInUrl = ORIGIN + '/?return_to=' + encodeURIComponent(location.origin + location.pathname);

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const hudGems = $('gems'), hudTime = $('time');
const menu = $('menu'), over = $('over');
const playerLine = $('playerLine'), signin = $('signin');

/* ---------- three.js scene ---------- */
const ARENA = 11, SPEED = 6, ROUND = 45, GEM_COUNT = 5;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0f172a');
scene.fog = new THREE.Fog('#0f172a', 18, 40);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
camera.position.set(0, 13, 12);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#bcd0ff', '#1e293b', 0.9));
const sun = new THREE.DirectionalLight('#ffffff', 1.1);
sun.position.set(6, 12, 6);
sun.castShadow = true;
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA * 2 + 2, ARENA * 2 + 2),
  new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.GridHelper(ARENA * 2, ARENA * 2, '#334155', '#273449'));
const wallM = new THREE.MeshStandardMaterial({ color: '#6366f1', emissive: '#312e81' });
for (const [x, z, w, d] of [[0, -ARENA - 1, ARENA * 2 + 2, 0.4], [0, ARENA + 1, ARENA * 2 + 2, 0.4],
  [-ARENA - 1, 0, 0.4, ARENA * 2 + 2], [ARENA + 1, 0, 0.4, ARENA * 2 + 2]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), wallM);
  m.position.set(x, 0.3, z);
  scene.add(m);
}

/* gems */
const gemGeo = new THREE.OctahedronGeometry(0.45);
const gems = [];
const rand = (a) => (Math.random() * 2 - 1) * a;
function placeGem(g) { g.position.set(rand(ARENA - 1), 0.9, rand(ARENA - 1)); }
for (let i = 0; i < GEM_COUNT; i++) {
  const g = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({
    color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.2,
  }));
  g.castShadow = true;
  placeGem(g);
  scene.add(g);
  gems.push(g);
}

/* player */
let player = null;
let playerStyle = DEFAULT_STYLE;
let playerName = 'Guest';
let nameSprite = null;

function makeNameSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.font = 'bold 48px system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(15,23,42,0.75)';
  x.fillRect(0, 8, 512, 80);
  x.fillStyle = '#fff';
  x.fillText(text.slice(0, 20), 256, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  s.scale.set(3, 0.56, 1);
  s.position.y = 3.1;
  return s;
}
function setPlayer(name, style) {
  playerName = name || 'Guest';
  playerStyle = cleanStyle(style);
  const prev = player ? player.position.clone() : null;
  if (player) scene.remove(player);
  player = buildCharacter(THREE, playerStyle);
  if (prev) player.position.copy(prev);
  nameSprite = makeNameSprite(playerName);
  player.add(nameSprite);
  scene.add(player);
}
setPlayer('Guest', DEFAULT_STYLE);

/* ---------- input ---------- */
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (state === 'menu' && (e.key === 'Enter' || e.key === ' ')) startRound();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let drag = null;
const dom = renderer.domElement;
dom.style.touchAction = 'none';
dom.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; });
dom.addEventListener('pointermove', (e) => { if (drag) { drag.dx = e.clientX - drag.x; drag.dy = e.clientY - drag.y; } });
const endDrag = () => { drag = null; };
dom.addEventListener('pointerup', endDrag);
dom.addEventListener('pointercancel', endDrag);

function readInput() {
  let x = 0, z = 0;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('w')) z -= 1;
  if (keys.has('arrowdown') || keys.has('s')) z += 1;
  if (drag && Math.hypot(drag.dx, drag.dy) > 8) {
    const len = Math.hypot(drag.dx, drag.dy);
    x += drag.dx / len; z += drag.dy / len;
  }
  const l = Math.hypot(x, z);
  return l > 0 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
}

/* ---------- game state ---------- */
let state = 'menu';
let score = 0, timeLeft = ROUND, moving = 0;

function startRound() {
  score = 0; timeLeft = ROUND;
  player.position.set(0, 0, 0);
  gems.forEach(placeGem);
  hudGems.textContent = '0';
  hudTime.textContent = String(ROUND);
  menu.hidden = true; over.hidden = true;
  state = 'playing';
}

async function endRound() {
  state = 'over';
  $('finalGems').textContent = String(score);
  $('saveMsg').textContent = '';
  over.hidden = false;
  const who = await ask({ type: 'startng:whoami' }, 'startng:user');
  if (who && who.user) {
    const res = await ask({ type: 'startng:score', stats: { gems: score } }, 'startng:scoreSaved');
    if (res && res.ok && res.result) {
      $('saveMsg').textContent = res.result.improved
        ? `New personal best! Rank #${res.result.rank}`
        : `Your best is ${res.result.best}. Rank #${res.result.rank}`;
    } else {
      $('saveMsg').textContent = 'Could not save your score this time.';
    }
  } else {
    $('saveMsg').textContent = 'Sign in with start.ng to put your score on the leaderboard.';
  }
  loadBoard($('boardOver'), who && who.user ? who.user.id : null);
}

async function loadBoard(ul, myId) {
  ul.textContent = '';
  const li0 = document.createElement('li');
  li0.textContent = 'Loading...';
  ul.appendChild(li0);
  const r = await ask({ type: 'startng:leaderboard', limit: 10 }, 'startng:leaderboardData', 6000);
  ul.textContent = '';
  if (!r || !r.ok || !Array.isArray(r.entries) || r.entries.length === 0) {
    const li = document.createElement('li');
    li.textContent = r && r.ok ? 'No scores yet. Be the first!' : 'Leaderboard unavailable.';
    ul.appendChild(li);
    return;
  }
  for (const en of r.entries) {
    const li = document.createElement('li');
    if (myId && en.player_id === myId) li.className = 'me';
    const gemsVal = en.stats && en.stats.gems != null ? en.stats.gems : en.score;
    li.textContent = `#${en.rank}  ${en.name}  ${gemsVal}`;
    ul.appendChild(li);
  }
}

/* ---------- identity ---------- */
let myId = null;
async function refreshIdentity() {
  const r = await ask({ type: 'startng:whoami' }, 'startng:user');
  if (!r) {
    playerLine.textContent = 'Playing as Guest (start.ng unreachable)';
    return;
  }
  if (r.user) {
    myId = r.user.id;
    setPlayer(r.user.name, r.user.style);
    playerLine.textContent = `Playing as ${r.user.name} (@${r.user.account})`;
    signin.hidden = true;
  } else {
    myId = null;
    const g = r.guest || {};
    setPlayer(g.name || 'Guest', g.style || DEFAULT_STYLE);
    playerLine.textContent = 'Playing as Guest. Scores are not saved.';
    signin.hidden = isGuestMode;
  }
  loadBoard($('boardMenu'), myId);
}
signin.href = signInUrl;
$('playBtn').addEventListener('click', startRound);
$('againBtn').addEventListener('click', startRound);
$('menuBtn').addEventListener('click', () => { over.hidden = true; menu.hidden = false; state = 'menu'; refreshIdentity(); });
// Pick up a style change made on start.ng in another tab
addEventListener('focus', () => { if (state !== 'playing') refreshIdentity(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && state !== 'playing') refreshIdentity(); });
refreshIdentity();

/* ---------- loop ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.position.set(0, w < h ? 20 : 13, w < h ? 15 : 12);
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  gems.forEach((g, i) => { g.rotation.y += dt * 2; g.position.y = 0.9 + Math.sin(t * 3 + i) * 0.15; });

  let target = 0;
  if (state === 'playing') {
    const inp = readInput();
    target = inp.x || inp.z ? 1 : 0;
    player.position.x = Math.max(-ARENA, Math.min(ARENA, player.position.x + inp.x * SPEED * dt));
    player.position.z = Math.max(-ARENA, Math.min(ARENA, player.position.z + inp.z * SPEED * dt));
    if (target) player.rotation.y = Math.atan2(inp.x, inp.z);
    for (const g of gems) {
      if (Math.hypot(g.position.x - player.position.x, g.position.z - player.position.z) < 0.9) {
        score++; hudGems.textContent = String(score); placeGem(g);
      }
    }
    timeLeft -= dt;
    hudTime.textContent = String(Math.max(0, Math.ceil(timeLeft)));
    if (timeLeft <= 0) endRound();
  } else {
    player.rotation.y += dt * 0.8;
  }
  moving += (target - moving) * Math.min(1, dt * 10);
  animateCharacter(player, t, moving);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
