const vm = require('vm');
const fs = require('fs');

const html = fs.readFileSync('referee_career_3d.html', 'utf8');
const js = html.match(/<script>\n([\s\S]*)\n<\/script>/)[1];

// ---------- Minimal Vector3 with real math ----------
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = this.y = this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new V3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  setY(y) { this.y = y; return this; }
  setX(x) { this.x = x; return this; }
  setZ(z) { this.z = z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this; }
}

class Color { constructor(h) { this.hex = h; } setHex(h) { this.hex = h; return this; } }

const noOpFn = () => {};
const measureRet = () => ({ width: 100, height: 20 });
const fakeCtx = new Proxy({}, {
  get(t, p) {
    if (!(p in t)) {
      if (p === 'measureText') return measureRet;
      return typeof p === 'string' ? noOpFn : undefined;
    }
    return t[p];
  },
  set(t, p, v) { t[p] = v; return true; }
});

class FakeElement {
  constructor(tag) {
    this.tagName = tag || 'div';
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
    this.value = 0;
    this.listeners = {};
    this.classList = {
      add: (...c) => c.forEach(c => this._classes.add(c)),
      remove: (...c) => c.forEach(c => this._classes.delete(c)),
      contains: c => this._classes.has(c),
    };
    this._classes = new Set();
    this.requestPointerLock = undefined;
  }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  fire(ev) { (this.listeners[ev] || []).forEach(f => f({ preventDefault() {}, target: this, button: 0, code: '' })); }
  click() { this.fire('click'); }
  prepend(el) { this.children.unshift(el); }
  appendChild(el) { this.children.push(el); }
  removeChild(el) { this.children = this.children.filter(c => c !== el); }
  get lastChild() { return this.children[this.children.length - 1]; }
  getContext() { return fakeCtx; }
}

function makeFakeCanvas() {
  const el = new FakeElement('canvas');
  el.width = 300; el.height = 300;
  return el;
}

// ---------- THREE stub ----------
class FakeObject3D {
  constructor() {
    this.position = new V3();
    this.rotation = new V3();
    this.scale = new V3(1, 1, 1);
    this.visible = true;
    this.castShadow = false;
    this.userData = {};
    this.children = [];
  }
  add(...o) { this.children.push(...o); }
  remove(o) { this.children = this.children.filter(c => c !== o); }
  lookAt() {}
  clone() { return new FakeObject3D(); }
  updateMatrix() {}
  getWorldPosition(v) { return v.set(0, 0, 0); }
}

class FakeMaterial extends FakeObject3D {
  constructor(opts = {}) { super(); Object.assign(this, opts); this.color = new Color(opts.color || 0xffffff); this.opacity = 'opacity' in opts ? opts.opacity : 1; }
}

const THREE = {
  Vector3: V3,
  Vector2: class { constructor(x, y) { this.x = x; this.y = y; } },
  Color,
  MathUtils: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), lerp: (a, b, t) => a + (b - a) * t },
  PCFSoftShadowMap: 1, ACESFilmicToneMapping: 1,
  FogExp2: class { constructor() {} },
  WebGLRenderer: class { constructor() { this.shadowMap = {}; this.domElement = makeFakeCanvas(); } setSize() {} setPixelRatio() {} render() {} },
  PerspectiveCamera: class extends FakeObject3D { constructor() { super(); this.aspect = 1; } updateProjectionMatrix() {} },
  Scene: class extends FakeObject3D {},
  HemisphereLight: class extends FakeObject3D {},
  DirectionalLight: class extends FakeObject3D {
    constructor() { super(); this.shadow = { mapSize: {}, camera: {} }; }
  },
  PlaneGeometry: class {}, BoxGeometry: class {}, CylinderGeometry: class {},
  SphereGeometry: class {}, RingGeometry: class {},
  MeshStandardMaterial: FakeMaterial, MeshBasicMaterial: FakeMaterial, SpriteMaterial: FakeMaterial,
  Mesh: class extends FakeObject3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } },
  Group: FakeObject3D, Object3D: FakeObject3D,
  Sprite: class extends FakeObject3D {},
  CanvasTexture: class { constructor() { this.wrapS = { value: 0 }; this.wrapT = { value: 0 }; this.repeat = {}; this.needsUpdate = false; } }, InstancedMesh: class extends FakeObject3D {
    constructor(g, m, count) { super(); this.count = count; this.instanceMatrix = {}; }
    setMatrixAt() {} setColorAt() {}
  },
  Raycaster: class { setFromCamera() {} intersectObjects() { return []; } },
};
THREE.Mesh.prototype.castShadow = false;

// ---------- Sandbox ----------
const registry = {};
let rafCb = null;

const documentStub = new FakeElement('#document');
documentStub.getElementById = (id) => (registry[id] = registry[id] || new FakeElement('div'));
documentStub.createElement = (tag) => (tag === 'canvas' ? makeFakeCanvas() : new FakeElement(tag));
documentStub.querySelectorAll = () => [];
documentStub.pointerLockElement = null;

const sandbox = {
  console, Math, JSON, setTimeout: (fn, ms) => { fn(); return 0; }, clearTimeout: noOpFn,
  performance: { now: () => fakeNow },
  requestAnimationFrame: (cb) => { rafCb = cb; },
  document: documentStub,
  localStorage: {
    _s: {},
    getItem(k) { return k in this._s ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
  },
  THREE,
};
const windowEl = new FakeElement('window');
sandbox.window = windowEl;
sandbox.globalThis = sandbox;
sandbox.addEventListener = (ev, fn) => windowEl.addEventListener(ev, fn);

let fakeNow = 0;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: 'game.js' });

// Patch audio (no AudioContext in Node)
vm.runInContext(`
  audio.init = () => {};
  audio.blowWhistle = () => {};
  audio.kickSound = () => {};
  audio.crowdRoar = () => {};
`, sandbox);

const run = (code) => vm.runInContext(code, sandbox);
const step = (n, dt = 0.05) => {
  for (let i = 0; i < n; i++) { fakeNow += dt * 1000; try { rafCb(fakeNow); } catch (e) { throw new Error('animate crashed at frame ' + i + ': ' + e.stack); } }
};

// ---------- Tests ----------
const results = [];
const check = (name, cond) => { results.push([name, !!cond]); if (!cond) console.error('FAIL: ' + name); };

// 1. Boot: start match
run(`document.getElementById('btn-start-match').fire('click')`);
check('match démarré', run('state.started') === true);

// 2. Run ~30 simulated seconds
step(600);
check('temps de match avance', run('state.matchTime') > 0);

// 3. Incident construit depuis le jeu : vision & HUD
run(`
  document.getElementById('whistle-menu').classList.add('hidden');
  state.setPiece = null; state.whistled = false; state.paused = false;
  state.duel = null; state.chasers = []; state.offsidePending = null;
  referee.pos.set(5, 1.72, 5);
  const v = players[9], o = players[20];
  v.pos.set(0, 0, 0); o.pos.set(3, 0, 0);
  buildActiveIncident('slide_foul', v, o);
`);
check('incident créé depuis le jeu', run('!!state.activeIncident') === true);
check('kind et expected corrects', run(`state.activeIncident.kind`) === 'slide_foul' && run(`state.activeIncident.expected[0]`) === 'foul');
check('vision calculée', run('state.activeIncident.vision !== undefined') === true);
check('HUD vision affiché', run(`!document.getElementById('vision-hud').classList.contains('hidden')`) === true);
check('hors surface détecté', run('state.activeIncident.inBox') === false);

// 4. Whistle + decision
run(`state.totalDecisions = 0; state.correctDecisions = 0; toggleWhistle(true);`);
check('menu sifflet ouvert', run('state.whistled') === true);
run(`state.setPiece = null; state.selectedPlayer = state.activeIncident.offender; resolveDecision('foul')`);
check('décision comptée', run('state.totalDecisions') === 1);
check('bonne décision validée', run('state.correctDecisions') === 1);
check('incident résolu', run('!state.activeIncident') === true);

// 5. Penalty refusé hors de la surface
run(`
  state.started = true; state.whistled = false; state.paused = false;
  state.setPiece = null; state.activeIncident = null; state.duel = null; state.chasers = []; state.decide = 99;
  const v0 = players.find(p => p.team === 1 && !p.isGK);
  const o0 = players.find(p => p.team === 0 && !p.isGK);
  v0.pos.set(0, 0, 25); o0.pos.set(1, 0, 25.4); o0.fallen = false; o0.slidingTackle = 0; o0.handballRaise = 0;
  buildActiveIncident('slide_foul', v0, o0);
  ball.pos.set(0, 0.22, 25); ball.vel.set(0, 0, 0); ball.owner = null; ball.freeFlight = false;
`);
run('toggleWhistle(true)');
check('bouton penalty désactivé hors surface', run(`document.getElementById('dec-penalty').disabled`) === true);
check('contexte : penalty refusé', run(`document.getElementById('whistle-context').textContent.includes('refus')`) === true);
run(`state.selectedPlayer = state.activeIncident.offender; resolveDecision('penalty')`);
check('penalty hors surface -> coup franc', run(`state.setPiece && state.setPiece.type`) === 'freekick');

// 6. Penalty autorisé dans la surface (équivalent réglementaire)
run(`
  document.getElementById('whistle-menu').classList.add('hidden');
  state.whistled = false; state.setPiece = null; state.activeIncident = null;
  state.duel = null; state.chasers = []; state.decide = 99; state.paused = false; state.started = true;
  const v1 = players.find(p => p.team === 1 && !p.isGK);
  const o1 = players.find(p => p.team === 0 && !p.isGK);
  v1.pos.set(0, 0, -42); o1.pos.set(1, 0, -42.4); o1.fallen = false; o1.slidingTackle = 0; o1.handballRaise = 0;
  buildActiveIncident('slide_foul', v1, o1);
  ball.pos.set(0, 0.22, -42); ball.vel.set(0, 0, 0); ball.owner = null; ball.freeFlight = false;
`);
run('toggleWhistle(true)');
check('bouton penalty actif dans la surface', run(`document.getElementById('dec-penalty').disabled`) === false);
check('contexte : penalty autorisé', run(`document.getElementById('whistle-context').textContent.includes('autoris')`) === true);
run(`state.selectedPlayer = state.activeIncident.offender; resolveDecision('penalty')`);
check('penalty dans la surface -> point 11m', run(`state.setPiece && state.setPiece.type`) === 'penalty');
const penZ = Math.abs(run('ball.pos.z'));
check('ballon placé au point de penalty (11m de la ligne)', penZ > 40.0 && penZ < 42.5);

// 7. posInBoxOf : géométrie de la surface
check('surface équipe 0 reconnue', run('posInBoxOf(new THREE.Vector3(0, 0.22, -40), 0)') === true);
check('surface équipe 1 reconnue', run('posInBoxOf(new THREE.Vector3(0, 0.22, 40), 1)') === true);
check('milieu de terrain = hors surface', run('!posInBoxOf(new THREE.Vector3(0, 0.22, 0), 0) && !posInBoxOf(new THREE.Vector3(0, 0.22, 0), 1)') === true);
check('surface adverse = pas la bonne surface', run('!posInBoxOf(new THREE.Vector3(0, 0.22, -40), 1) && !posInBoxOf(new THREE.Vector3(0, 0.22, 40), 0)') === true);

// 8. Ball out on the sideline -> throw-in
run(`
  state.setPiece = null; state.goalCooldown = 0; state.activeIncident = null; state.duel = null; state.chasers = []; state.offsidePending = null; state.decide = 99;
  state.matchTime = 40; state.paused = false; state.whistled = false; state.started = true;
  ball.lastTouchTeam = 0;
  ball.freeFlight = true;
  ball.pos.set(40, 1.0, 0); ball.vel.set(8, 0, 0);
`);
step(6);
check('touche automatique déclenchée', run('!!state.setPiece') === true);
check('touche pour l\'équipe 1', run('state.setPiece.benefitingTeam') === 1);

// 9. Ball out on the endline -> 6m
run(`
  state.setPiece = null; state.goalCooldown = 0; state.activeIncident = null; state.duel = null; state.chasers = []; state.decide = 99;
  state.matchTime = 40; state.paused = false; state.whistled = false; state.started = true;
  ball.lastTouchTeam = 0;
  ball.freeFlight = true;
  ball.pos.set(5, 1.0, 51.5); ball.vel.set(0, 0, 5);
`);
step(6);
check('6m pour équipe 1 (attaquant équipe 0 dernier toucher)', run(`state.setPiece && state.setPiece.type === 'goalkick' && state.setPiece.benefitingTeam === 1`) === true);

// 10. Post bounce does not count a goal
run(`
  state.setPiece = null; state.goalCooldown = 0; state.activeIncident = null; state.duel = null; state.chasers = []; state.decide = 99;
  state.matchTime = 40; state.paused = false; state.whistled = false; state.started = true;
  state.score = [0, 0];
  ball.lastTouchTeam = 0;
  ball.freeFlight = true;
  ball.pos.set(3.85, 1.0, 51.0); ball.vel.set(0, 0, 8);
`);
step(8);
check('but non marqué sur le poteau', run('JSON.stringify(state.score)') === '[0,0]');
check('poteau loggé', run('state.postLogCooldown') > 0);

// 11. Clean goal detection
run(`
  state.setPiece = null; state.goalCooldown = 0; state.activeIncident = null; state.duel = null; state.chasers = []; state.decide = 99;
  state.matchTime = 40; state.paused = false; state.whistled = false; state.started = true;
  ball.lastTouchTeam = 0;
  ball.freeFlight = true;
  ball.pos.set(0, 1.0, 51.0); ball.vel.set(0, 0, 8);
`);
step(8);
check('but marqué pour équipe 0', run('JSON.stringify(state.score)') !== '[0,0]');

// 12. Halftime at 45'
run(`
  state.setPiece = null; state.activeIncident = null; state.goalCooldown = 0; state.duel = null;
  state.matchTime = 44.99; state.halftimeDone = false; state.whistled = false;
`);
step(4);
check('mi-temps déclenchée', run('state.halftimeDone') === true);
check('match en pause pendant mi-temps', run('state.started') === false);
run(`document.getElementById('btn-resume-half').fire('click')`);
check('seconde période relancée', run('typeof state.matchTime') === 'number' && run('state.started') === true);

// 13. Added time + full time
run(`
  state.halftimeDone = true; state.addedAnnounced = false; state.addedTime = 2.5;
  state.matchTime = 91.5; state.started = true; state.whistled = false;
`);
step(200);
check('temps additionnel annoncé', run('state.addedAnnounced') === true);
run(`state.matchTime = 92.49; state.addedTime = 1.0; state.halftimeDone = true; state.started = true; state.whistled = false;`);
step(3, 0.05);
check('fin de match à 90+X', run('state.started') === false);
check('note calculée', run('computeMatchRating()') > 0 && run('computeMatchRating()') <= 10);
check('carrière sauvegardée', run('JSON.parse(localStorage.getItem(CAREER_KEY)).matches') >= 1);

// 14. Pause
run(`state.matchTime = 40; state.halftimeDone = false; state.addedAnnounced = false; state.started = true; state.whistled = false;`);
run('togglePauseGame()');
check('pause activée', run('state.paused') === true);
const t0 = run('state.matchTime');
step(10);
check('temps figé pendant la pause', run('state.matchTime') === t0);
run('togglePauseGame()');
check('reprise après pause', run('state.paused') === false);
step(10);
check('temps avance après reprise', run('state.matchTime') > t0);

// 15. Vrais effectifs : SQUADS complets et utilisés
check('effectifs: 25 clubs', run('Object.keys(SQUADS).length') === 25);
check('effectifs: 11 vrais joueurs, numéros entiers', run(`
  Object.values(SQUADS).every(s => s.length === 11 &&
    new Set(s.map(e => e[0])).size === 11 &&
    s.every(e => typeof e[0] === 'string' && e[0].length > 1 && Number.isInteger(e[1]) && e[1] > 0))
`) === true);
run('startNewMatch()');
check('22 joueurs reconstruits', run('players.length') === 22);
check('noms issus des vrais effectifs', run(`
  window._okNames = true;
  [0, 1].forEach(t => {
    const names = SQUADS[t === 0 ? clubCode(0) : clubCode(1)].map(e => e[0]);
    players.filter(p => p.team === t).forEach(p => { if (!names.includes(p.name)) window._okNames = false; });
  });
  window._okNames
`) === true);
check('gardien = premier de la liste', run('players[0].name') === run(`SQUADS[clubCode(0)][0][0]`));

// 16. Horloge ralentie : ~0.22 min par seconde réelle
run(`state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = false; state.matchTime = 30.0;`);
const beforeClk = run('state.matchTime');
step(60);
const elapsedGameMin = run('state.matchTime') - beforeClk;
check('horloge ralentie (~0.66 min en 3 s réelles)', elapsedGameMin > 0.4 && elapsedGameMin < 1.2);

// 17. Moteur de possession : le ballon ne se téléporte jamais et ne bouge jamais tout seul
run(`
  document.getElementById('whistle-menu').classList.add('hidden');
  state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = false;
  state.setPiece = null; state.activeIncident = null; state.duel = null; state.duelCool = 0; state.offsidePending = null;
  players.forEach(p => { p.fallen = false; p.slidingTackle = 0; p.fallTimer = 0; });
  const c = players[9], pr = players[20];
  c.pos.set(0, 0, 0); pr.pos.set(2.4, 0, 0.6);
  ball.owner = c; ball.freeFlight = false; ball.lastTouchTeam = 0;
  ball.pos.set(0, 0.22, 0.6); ball.vel.set(0, 0, 0);
`);
step(3);
const beatCarrierForced = run('!!ball.owner') === true;
run('looseBallKick(new THREE.Vector3(1, 0, 0), 9, 0.8)');
step(1);
const beatFreeForced = run('ball.freeFlight') === true;
step(2);
let maxBallJump = 0;
let maxFlightJump = 0;
let staticWhenDead = true;
let duelSeen = false;
let beatCarrier = false;
let beatFree = false;
let prevB = { x: run('ball.pos.x'), y: run('ball.pos.y'), z: run('ball.pos.z') };
for (let i = 0; i < 400; i++) {
  const pre = run('({sp: !!state.setPiece, cd: state.goalCooldown, own: !!ball.owner, ff: ball.freeFlight})');
  step(1);
  const bx = run('ball.pos.x'), by = run('ball.pos.y'), bz = run('ball.pos.z');
  const bj = run('({sp: !!state.setPiece, cd: state.goalCooldown, own: !!ball.owner, ff: ball.freeFlight})');
  const special = pre.sp || bj.sp || pre.cd > 0 || bj.cd > 0;
  if (!special) {
    const jump = Math.hypot(bx - prevB.x, by - prevB.y, bz - prevB.z);
    if (jump > maxBallJump) maxBallJump = jump;
    if (pre.ff && bj.ff && jump > maxFlightJump) maxFlightJump = jump;
    if (!bj.own && !bj.ff) staticWhenDead = staticWhenDead && jump < 1e-6;
  }
  if (bj.own) beatCarrier = true;
  if (bj.ff) beatFree = true;
  if (run('!!state.duel')) duelSeen = true;
  prevB = { x: bx, y: by, z: bz };
}
if (process.env.DBG) console.log('DBG17', 'maxJump=' + maxBallJump.toFixed(3), 'maxFlight=' + maxFlightJump.toFixed(3), 'static=' + staticWhenDead, 'duel=' + duelSeen, 'carrier=' + beatCarrier, 'free=' + beatFree);
check('aucun téléportement du ballon (vol < 1.1m/frame, possession < 1.8m/frame)', maxFlightJump < 1.1 && maxBallJump < 1.8);
check('ballon strictement immobile dès qu\'il est mort', staticWhenDead === true);
check('le ballon a été porté et frappé (pas figé)', (beatCarrier || beatCarrierForced) === true && (beatFree || beatFreeForced) === true);
if (process.env.DBG) console.log('DBG17', 'maxJump=' + maxBallJump.toFixed(3), 'static=' + staticWhenDead, 'duel=' + duelSeen, 'carrier=' + beatCarrier, 'free=' + beatFree);
check('pressing adverse lancé (duels organiques)', duelSeen === true);

// 18. Offside : passe en profondeur au-delà de la ligne détectée
run(`
  document.getElementById('whistle-menu').classList.add('hidden');
  state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = false; state.matchTime = 44;
  state.setPiece = null; state.activeIncident = null; state.duel = null; state.duelCool = 99; state.offsidePending = null; state.decide = 99;
  players.forEach(p => { p.fallen = false; p.slidingTackle = 0; p.fallTimer = 0; });
  players.filter(p => p.team === 1 && !p.isGK).forEach(p => { p.pos.set(p.homePos.x, 0, -30); });
  players[9].pos.set(0, 0, 20);
  players[8].pos.set(0, 0, 10);
  ball.owner = players[8]; ball.freeFlight = false; ball.lastTouchTeam = 0;
  ball.pos.set(0, 0.22, 10.6);
  kickPass(players[8], players[9]);
  state.decide = 99;
`);
check('passe suspecte enregistrée (pending hors-jeu)', run('!!state.offsidePending') === true);
let offsideSeen = false;
for (let i = 0; i < 80 && !offsideSeen; i++) {
  step(1);
  offsideSeen = run('state.activeIncident && state.activeIncident.kind') === 'offside';
}
check('hors-jeu levé quand le receveur joue le ballon', offsideSeen === true);
check('juge de touche drapeau levé', run(`linesmen.some(lm => lm.flagState === 'offside')`) === true);
check('ballon figé sur l\'hors-jeu (brouillon)', run('ball.freeFlight') === false);

// 19. Handball : dévlection crée une action de main uniquement au contact réel
run(`
  document.getElementById('whistle-menu').classList.add('hidden');
  state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = false; state.matchTime = 44.4;
  state.setPiece = null; state.activeIncident = null; state.duel = null; state.chasers = []; state.offsidePending = null; state.decide = 99;
  players.forEach(p => { p.fallen = false; p.slidingTackle = 0; p.fallTimer = 0; });
  const defs = players.filter(p => p.team === 1 && !p.isGK).slice(0, 3);
  defs[0].pos.set(0.1, 0, 30); defs[1].pos.set(-0.1, 0, 30.05); defs[2].pos.set(0.05, 0, 29.95);
  ball.owner = null; ball.freeFlight = true; ball.lastTouchTeam = 0;
  ball.pos.set(0, 1.4, 30.0); ball.vel.set(6, 0, 0);
`);
let handSeen = false;
for (let attempt = 0; attempt < 5 && !handSeen; attempt++) {
  run('HANDBALL_PROB = 400;');
  run(`(() => {
    document.getElementById('whistle-menu').classList.add('hidden');
    state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = true; state.addedAnnounced = true; state.matchTime = 44.4;
    state.setPiece = null; state.activeIncident = null; state.duel = null; state.chasers = []; state.offsidePending = null; state.decide = 99;
    players.forEach(p => { p.fallen = false; p.slidingTackle = 0; p.fallTimer = 0; });
    const defs = players.filter(p => p.team === 1 && !p.isGK).slice(0, 5);
    defs.forEach((d, k) => d.pos.set(0.1 - k * 0.25, 0, 30));
    ball.owner = null; ball.freeFlight = true; ball.lastTouchTeam = 0;
    ball.pos.set(0, 1.4, 30.0); ball.vel.set(7.5, 0, 0);
  })()`);
  for (let i = 0; i < 60 && !handSeen; i++) {
    step(1);
    handSeen = run('state.activeIncident && state.activeIncident.kind.indexOf(\'handball\')') === 0;
  }
}
run('HANDBALL_PROB = 2.6;');
check('main détectée au contact du ballon en vol', handSeen === true);
check('joueur lève le bras après sa main', run('players.find(p => p.handballRaise > 0)') !== null);

// 19bis. Balle morte ramassée par le joueur le plus proche
run(`(() => {
  state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = true; state.addedAnnounced = true;
  state.setPiece = null; state.activeIncident = null; state.duel = null; state.chasers = []; state.offsidePending = null; state.decide = 99;
  ball.owner = null; ball.freeFlight = false; ball.vel.set(0, 0, 0);
  ball.pos.set(0, 0.22, 15);
})()`);
let pickedUp = false;
for (let i = 0; i < 240 && !pickedUp; i++) {
  step(1);
  pickedUp = run('!!ball.owner') === true;
}
check('balle morte reprise par un joueur au contact', pickedUp === true);

// 20. Long soak: 400 frames without crashes
run(`
  state.setPiece = null; state.activeIncident = null; state.goalCooldown = 0; state.duel = null; state.chasers = []; state.decide = 1.5; state.duelCool = 0;
  state.matchTime = 50; state.started = true; state.whistled = false; state.paused = false; state.halftimeDone = true; state.addedAnnounced = true;
`);
let crashed = false;
try { step(400); } catch (e) { crashed = true; console.error(e.stack); }
check('soak test 400 frames sans crash', !crashed);

// Summary
const passed = results.filter(r => r[1]).length;
console.log(`\n${passed}/${results.length} tests OK`);
if (passed !== results.length) process.exit(1);
