// End-to-end tests: serves the folder, drives the game in headless Chromium
// through the ?test hook (window.__T), and exits non-zero on any failure.
//   npm install && npx playwright install chromium && npm test
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };

const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path || 'index.html'));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const URL_ = `http://localhost:${server.address().port}/index.html?test`;

let failed = 0, passed = 0;
function ok(name, cond){
  if (cond) passed++; else failed++;
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
}

const browser = await chromium.launch();
// every group gets a fresh context (empty storage) and a phone-sized page
async function page(opts = {}){
  const ctx = await browser.newContext({ viewport: {width:390, height:844}, hasTouch: true, ...opts });
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  // keep the service worker and web font out of the way
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto(URL_);
  await p.waitForFunction(() => window.__T);
  return p;
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const startMode = (p, i) => ev(p, i => __T.startMode(i), i);
const state = p => ev(p, () => __T.state);

async function swipe(p, x0, y0, x1, y1, ms = 200, steps = 8){
  await p.evaluate(async ([x0,y0,x1,y1,ms,steps]) => {
    const el = document.querySelector('.screen');
    const mk = (x, y) => new Touch({identifier: 1, target: el, clientX: x, clientY: y});
    const fire = (type, x, y, end) => el.dispatchEvent(new TouchEvent(type, {
      touches: end ? [] : [mk(x, y)], changedTouches: [mk(x, y)], bubbles: true, cancelable: true }));
    fire('touchstart', x0, y0);
    for (let i = 1; i <= steps; i++){
      await new Promise(r => setTimeout(r, ms / steps));
      fire('touchmove', x0 + (x1-x0)*i/steps, y0 + (y1-y0)*i/steps);
    }
    fire('touchend', x1, y1, true);
  }, [x0, y0, x1, y1, ms, steps]);
}

// ---------- boot ----------
{
  const p = await page();
  ok('boots to the menu', await state(p) === 'menu');
  await p.evaluate(() => localStorage.setItem('bg_green', '1'));   // old GREEN setting
  await p.reload(); await p.waitForFunction(() => window.__T);
  ok('boots with the old GREEN setting (migrated to theme)', p.errors.length === 0 && await state(p) === 'menu');
  ok('no page errors on boot', p.errors.length === 0);
  await p.context().close();
}

// ---------- every game survives random input ----------
{
  const p = await page();
  const keys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','z','x'];
  const n = await ev(p, () => __T.MODES.length);
  ok('16 games', n === 16);
  for (let i = 0; i < n; i++){
    await startMode(p, i);
    for (let k = 0; k < 35; k++){ await p.keyboard.press(keys[Math.floor(Math.random()*keys.length)]); await p.waitForTimeout(25); }
    if (p.errors.length){ console.log('  errors in game', i, p.errors); break; }
  }
  ok('all games run with random input and no errors', p.errors.length === 0);
  await p.context().close();
}

// ---------- bricks ----------
{
  const p = await page();
  await startMode(p, 0);
  const rot = await ev(p, () => {
    const G = __T.G, res = {};
    const SH = {I:[[0,1],[1,1],[2,1],[3,1]], O:[[1,0],[2,0],[1,1],[2,1]], T:[[1,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]};
    for (const typ of Object.keys(SH)){
      G.grid = G.grid.map(r => r.map(() => 0));
      G.curType = typ; G.curRot = 0; G.cur = SH[typ].map(([x,y]) => ({x: x+3, y: y+8}));
      const key = c => JSON.stringify(c.map(p => p.x+','+p.y).sort());
      const start = key(G.cur);
      for (let i = 0; i < 4; i++) G.rotate();
      res[typ] = key(G.cur) === start;
    }
    return res;
  });
  ok('rotating any piece 4 times returns it to the start (no drift)', Object.values(rot).every(Boolean));
  const bag = await ev(p, () => { const G = __T.G; G.bag = []; const s = new Set(); for (let i = 0; i < 7; i++) s.add(G.takeNext()); return s.size; });
  ok('7-bag randomizer deals each piece once per bag', bag === 7);
  const lock = await ev(p, () => {
    const G = __T.G; G.grid = G.grid.map(r => r.map(() => 0));
    G.spawn(); while (G.move(0, 1)); const before = JSON.stringify(G.cur);
    G.update(16); const stillThere = JSON.stringify(G.cur) === before;
    for (let i = 0; i < 40; i++) G.update(16);
    return [stillThere, G.grid.flat().filter(Boolean).length];
  });
  ok('lock delay: a landed piece does not lock instantly', lock[0]);
  ok('lock delay: it locks after the delay', lock[1] === 4);
  const hold = await ev(p, () => {
    const G = __T.G; const a = G.curType; G.hold(); const b = G.curType; const held = G.holdType;
    G.hold(); return [held === a, G.curType === b];
  });
  ok('hold stores the piece and only once per piece', hold[0] && hold[1]);
  ok('HOLD panel shown with lines', await p.textContent('#extraLabel') === 'HOLD' && (await p.textContent('#extraVal')).startsWith('LINES'));
  // pause / resume / auto-pause
  await ev(p, () => { __T.G.score = 1234; });
  await p.keyboard.press('Enter');
  ok('START pauses with a menu', await state(p) === 'pause' && await ev(p, () => document.getElementById('overlayOpts').children.length) === 4);
  await p.keyboard.press('z');
  ok('A on RESUME resumes the same game', await state(p) === 'play' && await ev(p, () => __T.G.score) === 1234);
  await ev(p, () => { Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange')); });
  ok('auto-pauses when the app is hidden', await state(p) === 'pause');
  await ev(p, () => { Object.defineProperty(document, 'hidden', {value: false, configurable: true}); });
  // settings from pause keep the game
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('z');
  ok('settings open from the pause menu', await state(p) === 'settings');
  for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowDown');
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  ok('closing settings returns to the paused game', await state(p) === 'pause' && await ev(p, () => __T.G.score) === 1234);
  ok('theme change is saved', await ev(p, () => localStorage.getItem('bg_theme')) === 'green');
  ok('no page errors (bricks)', p.errors.length === 0);
  await p.context().close();
}

// ---------- touch controls ----------
{
  const p = await page();
  const bw = await ev(p, () => document.getElementById('btnLeft').getBoundingClientRect().width);
  ok('d-pad buttons are at least 44px', bw >= 44);
  await swipe(p, 150, 300, 150, 370);
  ok('swipe down moves the menu selection', await ev(p, () => __T.menuIndex) === 3);
  await swipe(p, 150, 300, 150, 300, 50, 1);
  ok('tap on the screen = A', await state(p) === 'level');
  await p.keyboard.press('x');
  ok('B goes back from level select', await state(p) === 'menu');
  await startMode(p, 0);
  ok('A/B captions follow the game', (await p.textContent('#btnA')).includes('ROT') && (await p.textContent('#btnB')).includes('DROP'));
  const x0 = await ev(p, () => Math.min(...__T.G.cur.map(c => c.x)));
  await swipe(p, 150, 300, 90, 300);
  ok('swipe left moves the piece two cells', await ev(p, () => Math.min(...__T.G.cur.map(c => c.x))) === x0 - 2);
  const n0 = await ev(p, () => __T.G.grid.flat().filter(Boolean).length);
  await swipe(p, 150, 200, 150, 330, 80, 4);
  ok('flick down hard-drops', await ev(p, () => __T.G.grid.flat().filter(Boolean).length) !== n0);
  ok('no page errors (touch)', p.errors.length === 0);
  await p.context().close();
}

// ---------- landscape ----------
{
  const p = await page({ viewport: {width: 844, height: 390} });
  const lay = await ev(p, () => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    return { s: r('.screen-wrap'), d: r('.dpad'), a: r('.abtns'), vw: innerWidth, vh: innerHeight };
  });
  ok('landscape: d-pad left, buttons right, everything on screen',
     lay.d.right <= lay.s.left && lay.a.left >= lay.s.right && lay.a.right <= lay.vw && lay.s.bottom <= lay.vh);
  await p.context().close();
}

// ---------- game rules ----------
{
  const p = await page();
  // frog: every water row has logs and the bank is reachable
  await startMode(p, 7);
  ok('frog: logs on every water row', JSON.stringify(await ev(p, () => [...new Set(__T.G.logs.map(l => l.y))].sort())) === '[3,4,5,6,7]');
  ok('frog: can step from the last log to the bank', await ev(p, () => {
    const G = __T.G; const l = G.logs.find(l => l.y === 3); l.x = 3; G.fx = 4; G.fy = 3; G.update(16);
    G.move(0, -1); G.update(16); return G.fy === 2 && G.lives === 3; }));
  // snake grows by one
  await startMode(p, 3);
  ok('snake grows by one per food', await ev(p, () => {
    const G = __T.G; const n = G.body.length; const h = G.body[0];
    G.food = {x: h.x + 1, y: h.y}; G.moveAcc = G.moveInterval; G.update(0); G.moveAcc = G.moveInterval; G.update(0);
    return G.body.length === n + 1; }));
  // stack
  await startMode(p, 8);
  ok('stack: aligned keeps width, offset cuts, a miss ends the game', JSON.stringify(await ev(p, () => {
    const G = __T.G; G.x = 0; G.stop(); const w1 = G.w; G.x = 2; G.stop(); const w2 = G.w; G.x = 8; G.w = 2; G.stop();
    return [w1, w2, __T.state === 'initials' || __T.state === 'over']; })) === '[4,2,true]');
  // runner
  await startMode(p, 9);
  ok('runner: hitting a block crashes', await ev(p, () => { const G = __T.G; G.obs = [{x:1.5, w:1, y:0, hgt:1}]; G.update(16); return G.gameOver; }));
  await startMode(p, 9);
  ok('runner: a jump clears a block', await ev(p, () => {
    const G = __T.G; G.jump(); for (let i = 0; i < 10; i++) G.update(16); G.obs = [{x:1.5, w:1, y:0, hgt:1}]; G.update(16); return !G.gameOver; }));
  // fill
  await startMode(p, 10);
  ok('fill: completing a row clears it', await ev(p, () => {
    const G = __T.G; G.grid = G.grid.map(r => r.map(() => 0)); G.grid[0] = [1,1,1,1,0,1,1,1,1,1]; G.px = 4; G.shoot();
    return G.lines === 1 && !G.grid[0].some(Boolean); }));
  // pong
  await startMode(p, 11);
  ok('pong: a missed ball costs a life', await ev(p, () => {
    const G = __T.G; G.serveIn = 0; G.px = 0; G.bx = 8; G.by = 19.5; G.vy = 0.01; G.vx = 0; G.update(60); return G.lives === 2; }));
  ok('pong: the paddle returns the ball', await ev(p, () => {
    const G = __T.G; G.serveIn = 0; G.px = 3; G.bx = 4; G.by = 17.9; G.vy = 0.01; G.vx = 0; G.update(16); return G.vy < 0; }));
  // invaders
  await startMode(p, 12);
  ok('invaders: a shot destroys an alien', await ev(p, () => {
    const G = __T.G; const a = G.aliens[0]; G.shots = [{x: a.x + G.gx, y: a.y + G.gy + 0.3}]; const n = G.aliens.length; G.update(1);
    return G.aliens.length === n - 1 && G.score > 0; }));
  // gems
  await startMode(p, 13);
  ok('gems: three in a row clear and the column falls', await ev(p, () => {
    const G = __T.G; G.grid = G.grid.map(r => r.map(() => 0)); G.grid[19][2] = 1; G.grid[19][3] = 1;
    G.x = 4; G.gems = [2,3,1]; G.y = 0; G.onB(); const flashing = !!G.flash; G.update(300);
    return flashing && !G.grid[19][2] && !G.grid[19][3] && G.grid[19][4] === 3 && G.grid[18][4] === 2; }));
  // maze
  ok('maze: every dot is reachable', await ev(p, () => {
    const M = __T.MAZE; let s; M.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'P') s = [x, y]; }));
    const seen = new Set([s + '']), q = [s];
    while (q.length){ const [x, y] = q.shift(); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx = x+dx, ny = y+dy; if (M[ny] && M[ny][nx] && M[ny][nx] !== '#' && !seen.has([nx,ny]+'')){ seen.add([nx,ny]+''); q.push([nx,ny]); } } }
    let missing = 0; M.forEach((row, y) => [...row].forEach((c, x) => { if ((c === '.' || c === 'o') && !seen.has([x,y]+'')) missing++; }));
    return missing === 0; }));
  await startMode(p, 14);
  ok('maze: touching a chaser costs a life, power dots let you eat them', JSON.stringify(await ev(p, () => {
    const G = __T.G; G.startDelay = 0; const g = G.ghosts[0]; g.x = G.p.x; g.y = G.p.y; G.collide(); const lives = G.lives;
    G.power = 3000; const g2 = G.ghosts[1]; g2.x = G.p.x; g2.y = G.p.y; const s = G.score; G.collide();
    return [lives, G.score - s]; })) === '[2,100]');
  // rally
  await startMode(p, 15);
  ok('rally: a car in your lane crashes', await ev(p, () => { const G = __T.G; G.cars = [{lane: G.lane, y: 15}]; G.update(16); return G.gameOver; }));
  await startMode(p, 15);
  ok('rally: running out of fuel ends the game', await ev(p, () => { const G = __T.G; G.fuel = 0.01; G.cars = []; G.update(50); return G.gameOver; }));
  ok('no page errors (rules)', p.errors.length === 0);
  await p.context().close();
}

// ---------- records, share, daily, stats, awards, gamepad ----------
{
  const p = await page();
  await p.evaluate(() => {
    window.__shared = null;
    navigator.share = d => { window.__shared = d.text; return Promise.resolve(); };
  });
  await startMode(p, 3);   // snake
  await ev(p, () => { __T.G.score = 320; __T.G.die(); });
  ok('a top-5 score asks for initials', await state(p) === 'initials');
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('z');
  ok('initials are saved in the table', await state(p) === 'over' &&
     JSON.stringify(await ev(p, () => __T.loadTop('D').map(e => [e.n, e.s]))) === '[["BBA",320]]');
  ok('high score updated', await ev(p, () => localStorage.getItem('bg_hi_D')) === '320');
  ok('BIG SNAKE award unlocked', await ev(p, () => !!__T.unlocked.snake300));
  ok('A/B captions on game over are AGAIN/SHARE', (await p.textContent('#btnB')).includes('SHARE'));
  await p.keyboard.press('x');
  await p.waitForTimeout(50);
  ok('B on game over shares the score', (await ev(p, () => window.__shared || '')).includes('320'));
  // old single high score is migrated into the table
  await ev(p, () => localStorage.setItem('bg_hi_C', '500'));
  await startMode(p, 2);
  await ev(p, () => { __T.G.score = 800; __T.G.die(); });
  await p.keyboard.press('z');
  ok('an old high score is migrated (no duplicate)', JSON.stringify(await ev(p, () => __T.loadTop('C').map(e => e.s))) === '[800,500]');
  // stats + first-game award
  ok('stats count games played', await ev(p, () => __T.stats.played.D === 1 && __T.stats.played.C === 1));
  ok('FIRST GAME award', await ev(p, () => !!__T.unlocked.first));
  // daily: seeded and repeatable
  const daily = await ev(p, () => {
    __T.startDaily(); const r1 = [Math.random(), Math.random()];
    __T.startDaily(); const r2 = [Math.random(), Math.random()];
    return { same: JSON.stringify(r1) === JSON.stringify(r2), mode: __T.G && __T.dailyInfo().mode.id };
  });
  ok('daily challenge uses the same random sequence every time', daily.same);
  await ev(p, () => { __T.G.score = 50; __T.G.gameOver = false; });
  await p.keyboard.press('r');
  ok('random sequence is restored after leaving the daily', await ev(p, () => __T.isNativeRandom()));
  // stats / awards pages
  await ev(p, () => { __T.menuIndex = __T.MODES.length + 1; });
  await p.keyboard.press('z');
  ok('stats page opens from the menu', await state(p) === 'stats');
  await p.keyboard.press('x');
  await ev(p, () => { __T.menuIndex = __T.MODES.length + 2; });
  await p.keyboard.press('z');
  ok('awards page opens from the menu', await state(p) === 'awards');
  await p.keyboard.press('z');
  ok('A goes back to the menu', await state(p) === 'menu');
  // gamepad
  await ev(p, () => {
    __T.menuIndex = 1;
    let pressed = true;
    navigator.getGamepads = () => [{ connected: true, axes: [0, 0],
      buttons: Array.from({length: 16}, (_, i) => ({ pressed: i === 13 && pressed })) }];
    setTimeout(() => { pressed = false; }, 100);
  });
  await p.waitForTimeout(200);
  ok('gamepad d-pad moves the menu', await ev(p, () => __T.menuIndex) === 2);
  ok('no page errors (records)', p.errors.length === 0);
  await p.context().close();
}

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
