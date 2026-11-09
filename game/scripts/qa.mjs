// npm run qa — plays the built game (dist/) in headless Chrome at phone and desktop sizes.
// Needs Chrome or Chromium installed. Set CHROME_PATH if it is not found automatically.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
// The real engine (run with tsx), so every route the QA plays is computed by the game's own rules.
import { availableChoices, choose, conditionsPass, createSession, getChoiceViews, getScene, isTerminal } from '../src/engine/engine.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const shots = path.join(root, 'qa-screenshots');
const story = JSON.parse(fs.readFileSync(path.join(root, 'data/story.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(root, 'data/locales/fr.json'), 'utf8'));

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ is missing. Run "npm run build" first.');
  process.exit(1);
}
fs.mkdirSync(shots, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let swBump = '';
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === '/__qa/new-deploy') {
    swBump = `\n// qa deploy ${Date.now()}\n`;
    res.writeHead(200).end('ok');
    return;
  }
  if (url === '/sw.js' && swBump) {
    const body = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8').replace(/const CACHE = "([^"]+)"/, 'const CACHE = "$1-qa"') + swBump;
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' }).end(body);
    return;
  }
  const file = path.join(dist, url === '/' ? 'index.html' : url);
  if (!file.startsWith(dist) || !fs.existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  // Same as public/_headers on Netlify: built assets may be loaded from sandboxed frames.
  const cors = url.startsWith('/assets/') ? { 'access-control-allow-origin': '*' } : {};
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', ...cors }).end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath, headless: true });

let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const TUTORIAL_KEY = 'the-last-weather:tutorial:v1';

/** A fresh browser. Unless `tutorial` is set, the guided tour counts as already done, so the checks play the bare game. */
async function newPage({ width = 390, height = 844, locale = 'en-US', reducedMotion = 'reduce', hash = '', tutorial = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale, deviceScaleFactor: 2, hasTouch: width < 600, reducedMotion });
  if (!tutorial) {
    await context.addInitScript(
      (key) => {
        try {
          if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ tourDone: true }));
        } catch {
          /* storage blocked: the game then shows the tour, which the check must handle */
        }
      },
      TUTORIAL_KEY,
    );
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(base + hash);
  return { context, page, errors };
}

const scene = (page) => page.locator('.scene-title').innerText();
const meter = (page, field) => page.locator(`.meter-${field} .meter-number:visible`).innerText().then((t) => Number.parseInt(t, 10));
/** Clicks a choice; a lethal one is armed by the first tap and taken by the second. */
async function pick(page, choiceId) {
  const button = page.locator(`[data-choice="${choiceId}"]`);
  await button.click();
  if ((await page.locator(`[data-choice="${choiceId}"][data-armed="true"]`).count()) > 0) await button.click();
}
const sceneById = Object.fromEntries(story.scenes.map((s) => [s.id, s]));
const isChapterTwoEnd = (id) => sceneById[id].chapterEnd && sceneById[id].chapter === 'ch2';

/** Every run through Vesper-6 (chapters 1–2), each to its outcome: a chapter-2 ending or a death. */
function planetRuns() {
  const out = [];
  const walk = (session, ids) => {
    const s = getScene(story, session.sceneId);
    if (isTerminal(s) || isChapterTwoEnd(s.id)) return out.push({ ids, end: s.id, state: session.state });
    for (const c of availableChoices(story, s, session.state)) walk(choose(story, session, c.id), [...ids, c.id]);
  };
  walk(createSession(story), []);
  return out;
}

/** Shortest route from the start to a scene (by breadth-first search over situations). */
function routeTo(target, from = createSession(story)) {
  const seen = new Set();
  const queue = [{ session: from, ids: [] }];
  while (queue.length) {
    const { session, ids } = queue.shift();
    if (session.sceneId === target) return { ids, state: session.state };
    const key = `${session.sceneId}|${JSON.stringify(session.state)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = getScene(story, session.sceneId);
    if (isTerminal(s)) continue;
    for (const c of availableChoices(story, s, session.state)) queue.push({ session: choose(story, session, c.id), ids: [...ids, c.id] });
  }
  return null;
}

/**
 * Runs through the whole story that, together, take every choice that can ever be taken and reach
 * every ending and death. (All 9,000+ runs are simulated by "npm run validate"; this plays a
 * covering set of them through the real interface.)
 */
function coveringRuns() {
  const needChoices = new Set();
  const needEnds = new Set(story.scenes.filter((s) => isTerminal(s)).map((s) => s.id));
  const seen = new Set();
  const stack = [createSession(story)];
  while (stack.length) {
    const session = stack.pop();
    const key = `${session.sceneId}|${JSON.stringify(session.state)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = getScene(story, session.sceneId);
    if (isTerminal(s)) continue;
    for (const c of availableChoices(story, s, session.state)) {
      needChoices.add(`${s.id}.${c.id}`);
      stack.push(choose(story, session, c.id));
    }
  }
  const runs = [];
  const take = (route, end) => {
    runs.push({ ...route, end });
    let session = createSession(story);
    for (const id of route.ids) {
      needChoices.delete(`${session.sceneId}.${id}`);
      session = choose(story, session, id);
    }
    needEnds.delete(session.sceneId);
  };
  // Shortest route to each ending/death, then extend until every choice has been taken once.
  for (const end of [...needEnds]) {
    const r = routeTo(end);
    if (r) take(r, end);
  }
  for (const key of [...needChoices]) {
    if (!needChoices.has(key)) continue;
    const [sceneId, choiceId] = key.split('.');
    // Find a situation where this choice is open, take it, then finish by the shortest way out.
    const seen2 = new Set();
    const queue = [{ session: createSession(story), ids: [] }];
    let found = null;
    while (queue.length && !found) {
      const { session, ids } = queue.shift();
      const k = `${session.sceneId}|${JSON.stringify(session.state)}`;
      if (seen2.has(k)) continue;
      seen2.add(k);
      const s = getScene(story, session.sceneId);
      if (isTerminal(s)) continue;
      const open = availableChoices(story, s, session.state);
      if (s.id === sceneId && open.some((c) => c.id === choiceId)) found = { session: choose(story, session, choiceId), ids: [...ids, choiceId] };
      else for (const c of open) queue.push({ session: choose(story, session, c.id), ids: [...ids, c.id] });
    }
    if (!found) continue;
    let session = found.session;
    const ids = [...found.ids];
    while (!isTerminal(getScene(story, session.sceneId))) {
      const c = availableChoices(story, getScene(story, session.sceneId), session.state)[0];
      ids.push(c.id);
      session = choose(story, session, c.id);
    }
    take({ ids, state: session.state }, session.sceneId);
  }
  return runs;
}

/** Visible meters on the final screen must match the engine's final state. */
async function checkFinalStats(page, state, label) {
  for (const [field, rule] of Object.entries(story.stateRules)) {
    if (!conditionsPass(rule.hudWhen, state)) continue;
    const shown = Number.parseInt(await page.locator('.final-stats li', { hasText: rule.label }).first().locator('strong').innerText(), 10);
    assert(shown === state[field], `${label}: ${field} shown ${shown}, expected ${state[field]}`);
  }
}

/** Back to a fresh run from any screen: "Play again" on endings and deaths, otherwise Menu → Restart (two taps). */
async function resetRun(page) {
  if ((await page.locator('[data-action="play-again"]').count()) > 0) return page.click('[data-action="play-again"]');
  await page.click('.menu-button');
  await page.click('[data-action="restart"]');
  await page.click('[data-action="restart"]');
}

console.log(`\nQA against ${base}`);

// ---------- Phone: iPhone 13 Pro size ----------
{
  const { context, page, errors } = await newPage();

  await check('title screen renders with art and no console errors', async () => {
    await page.locator('.game-title').waitFor();
    assert((await page.locator('.game-title').innerText()).toUpperCase().includes('THE LAST WEATHER'), 'missing title');
    const loaded = await page.locator('.title-art img').evaluate((img) => img.complete && img.naturalWidth > 0);
    assert(loaded, 'title art did not load');
    await page.screenshot({ path: path.join(shots, 'phone-01-title.png') });
  });

  await check('begin with a callsign', async () => {
    await page.fill('input[name="callsign"]', 'Wren');
    await page.click('[data-action="begin"]');
    assert((await scene(page)) === 'Impact', `expected Impact, got ${await scene(page)}`);
    assert((await meter(page, 'oxygen')) === 4, 'oxygen should start at 4');
    await page.screenshot({ path: path.join(shots, 'phone-02-impact.png'), fullPage: true });
  });

  await check('MICA dialogue is shown as dialogue', async () => {
    const text = await page.locator('.dialogue').first().innerText();
    assert(text.includes('MICA') && text.includes('Coupler fractured'), 'MICA block missing');
  });

  await check('costs and gains are shown on separate labelled lines before choosing; the place is said once', async () => {
    const card = page.locator('[data-choice="restore_memory"]');
    const costs = await card.locator('.fact-costs .fact-item').evaluateAll((els) => els.map((el) => el.textContent ?? ''));
    const gains = await card.locator('.fact-gains .fact-item').evaluateAll((els) => els.map((el) => el.textContent ?? ''));
    assert(costs.some((t) => t.includes('Oxygen')) && costs.some((t) => t.includes('Storm Clock')), `costs were ${costs}`);
    assert(gains.some((t) => t.includes('MICA Trust')), `gains were ${gains}`);
    assert((await card.locator('.fact-costs .fact-num').allInnerTexts()).includes('−1'), 'cost is not an icon amount');
    assert((await card.locator('.fact-costs .fact-label').textContent()).toUpperCase() === 'COSTS', 'costs label missing');
    assert((await page.locator('.place').count()) === 1, 'place mark should appear once');
    assert((await page.locator('.place').getAttribute('data-place')) === 'exposed', 'not marked outside');
    assert((await page.locator('.place').textContent()).toUpperCase().includes('OUTSIDE'), 'place name missing for assistive tech');
    assert((await meter(page, 'stormClock')) === 7, 'storm clock should start at 7');
  });

  await check('the game starts simple: only the meters the first decision uses', async () => {
    const shown = await page.locator('.hud-slot-inline .meter').evaluateAll((els) => els.map((e) => e.dataset.tour));
    assert(JSON.stringify(shown) === JSON.stringify(['meter-oxygen', 'meter-micaTrust', 'meter-stormClock']), `meters were ${shown}`);
    assert((await page.locator('.pack:visible').count()) === 0, 'empty pack shown');
  });

  await check('choosing applies effects and shows the outcome', async () => {
    await pick(page, 'restore_memory');
    assert((await scene(page)) === 'Two ways through the dust', 'wrong scene');
    assert((await meter(page, 'oxygen')) === 3 && (await meter(page, 'micaTrust')) === 2, 'meters not updated');
    assert((await page.locator('.outcome').count()) === 0, 'last-action box still on screen');
    const pops = await page.locator('.hud-slot-inline .delta-pop').allInnerTexts();
    assert(pops.some((t) => t.includes('−1')), `meter changes were ${pops}`);
    const fresh = await page.locator('.hud-slot-inline .meter.is-new').evaluateAll((els) => els.map((e) => e.dataset.tour));
    assert(fresh.includes('meter-suitIntegrity') && fresh.includes('meter-salvage'), `new meters were ${fresh}`);
    const mica = await page.locator('.dialogue').innerText();
    assert(mica.includes('Wren'), 'callsign not used by MICA');
  });

  await check('route choices show preview art', async () => {
    const loaded = await page.locator('.choice-art').evaluateAll((imgs) => imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0));
    assert(loaded, 'route thumbnails missing');
    await page.screenshot({ path: path.join(shots, 'phone-03-route.png'), fullPage: true });
  });

  await check('progress survives a reload', async () => {
    await pick(page, 'dry_ravine');
    await page.reload();
    await page.click('[data-action="continue"]');
    assert((await scene(page)) === 'The Weather Station', 'did not resume');
    assert((await meter(page, 'oxygen')) === 2, 'oxygen not restored');
    assert((await page.locator('.pack-item:visible').allInnerTexts()).includes('Dust filter'), 'filter not in pack');
  });

  await check('keyboard: number key picks a choice and focus moves to the new heading', async () => {
    await page.keyboard.press('2'); // take the coupler and leave: keeps enough air for the clear window
    await page.locator('.scene-title', { hasText: 'The Storm Front' }).waitFor();
    const focused = await page.evaluate(() => document.activeElement?.classList.contains('scene-title'));
    assert(focused, 'focus did not move to heading');
    await page.screenshot({ path: path.join(shots, 'phone-04-storm.png'), fullPage: true });
  });

  await check('a quick, careful run escapes through the Clear Window and closes chapter 2', async () => {
    // Restored memory + Dry Ravine leaves little air: the filtered crossing (no air) keeps enough for the repair.
    const trench = await page.locator('[data-choice="follow_mica"] .choice-risk').count();
    assert(trench === 0, 'trench should not be lethal with 2 oxygen');
    await pick(page, 'use_filter');
    assert((await scene(page)) === 'One Last Repair', 'not at the repair');
    await pick(page, 'careful_repair');
    await page.screenshot({ path: path.join(shots, 'phone-05-launch.png'), fullPage: true });
    await pick(page, 'clear_launch');
    assert((await scene(page)) === 'Clear Window', 'not the clear window');
    const recap = await page.locator('.chapter-recap').textContent();
    assert(recap.includes('Dry Ravine') && recap.includes('Careful calibration'), `recap was ${recap}`);
    assert((await page.locator('.narrative').innerText()).includes('debris field'), 'memory reveal missing');
    await page.screenshot({ path: path.join(shots, 'phone-06-ending.png'), fullPage: true });
  });

  await check('chapter 3 opens with a title card; the Storm Clock is gone off-planet', async () => {
    await pick(page, 'to_chapter_3');
    const card = (await page.locator('.chapter-card').innerText()).toUpperCase().replace(/\s+/g, ' ');
    assert(card.includes('THE QUIET RELAY'), `card was ${card}`);
    assert((await page.locator('.meter-stormClock:visible').count()) === 0, 'storm clock still shown in space');
  });

  await check('locked choices explain what they need and cannot be picked', async () => {
    await resetRun(page);
    await pick(page, 'save_battery');
    await pick(page, 'glass_ridge');
    await pick(page, 'leave_with_coupler');
    const trench = page.locator('[data-choice="follow_mica"]');
    assert((await trench.getAttribute('aria-disabled')) === 'true', 'trench should be locked');
    const lock = await trench.locator('.choice-needs').innerText();
    assert(lock.includes('Storm forecast') && lock.includes('MICA Trust 2+'), `lock text was ${lock}`);
    assert((await page.locator('.choice-list-locked [data-choice="follow_mica"]').count()) === 1, 'locked option not listed apart');
    const order = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.getAttribute('aria-disabled') === 'true'));
    assert(order.indexOf(true) > order.lastIndexOf(false), `locked options not last: ${order}`);
    // Numbers count only the options you can take.
    assert((await page.locator('[data-choice="cross_exposed_ridge"] .choice-key').innerText()) === '1', 'first open option is not number 1');
    assert((await trench.locator('.choice-key').count()) === 0, 'locked option has a number');
    await trench.click({ force: true }); // aria-disabled: Playwright would otherwise wait for it to enable
    assert((await scene(page)) === 'The Storm Front', 'locked choice was taken');
    await page.screenshot({ path: path.join(shots, 'phone-07-locked.png'), fullPage: true });
  });

  await check('a lethal choice says so, needs a second tap, then shows the death screen', async () => {
    // Glass Ridge already cut the suit to 2: the exposed crossing (-2) would breach it.
    const ridge = page.locator('[data-choice="cross_exposed_ridge"]');
    assert((await ridge.getAttribute('data-risk')) === 'death:suit_breach', 'not marked lethal');
    assert((await ridge.locator('.choice-risk .risk-detail').textContent()).includes('Your suit will fail'), 'no lethal warning text');
    const tucked = await ridge.locator('.risk-detail').evaluate((el) => el.getBoundingClientRect().height < 2);
    assert(tucked, 'the lethal sentence is on screen before the confirming tap');
    assert((await ridge.locator('.choice-risk .fact-label').textContent()).toUpperCase() === 'DEADLY', 'no Deadly label');
    assert((await ridge.locator('.risk-mark').count()) === 1, 'no danger mark');
    await ridge.click();
    assert((await scene(page)) === 'The Storm Front', 'died on the first tap');
    assert((await ridge.getAttribute('data-armed')) === 'true', 'not armed');
    assert((await ridge.locator('.choice-confirm').innerText()).includes('Tap again'), 'no confirm prompt');
    await page.screenshot({ path: path.join(shots, 'phone-13-lethal-armed.png'), fullPage: true });
    await ridge.click();
    assert((await scene(page)) === 'Suit Breach', 'no death screen');
    const facts = await page.locator('.death-facts').innerText();
    assert(facts.includes('Suit Breach') && facts.includes('Approach to the ship') && facts.includes('Take the exposed ridge'), `facts were ${facts}`);
    assert((await page.locator('.art-frame.is-dead').count()) > 0, 'death art not shown');
    assert((await page.locator('.choice').count()) === 0, 'choices still shown after death');
    await page.screenshot({ path: path.join(shots, 'phone-14-death.png'), fullPage: true });
  });

  await check('after death: "Try chapter 2 again" restores the chapter start, alive', async () => {
    await page.click('[data-action="restart-chapter"]');
    assert((await scene(page)) === 'The Weather Station', 'not back at the chapter start');
    assert((await meter(page, 'oxygen')) === 5 && (await meter(page, 'suitIntegrity')) === 2 && (await meter(page, 'stormClock')) === 6, 'checkpoint state wrong');
  });

  await check('keyboard: a lethal choice needs the number key twice', async () => {
    await page.keyboard.press('2'); // take the coupler and leave
    await page.locator('.scene-title', { hasText: 'The Storm Front' }).waitFor();
    const keys = await page.locator('.choice').evaluateAll((els) => els.map((e) => e.dataset.choice));
    const n = String(keys.indexOf('cross_exposed_ridge') + 1);
    await page.keyboard.press(n);
    assert((await scene(page)) === 'The Storm Front', 'died on the first key press');
    await page.keyboard.press(n);
    await page.locator('.scene-title', { hasText: 'Suit Breach' }).waitFor();
  });

  await check('a finished (dead) run offers Begin on the title, and deaths are listed apart from endings', async () => {
    await page.reload();
    await page.locator('.game-title').waitFor();
    assert((await page.locator('[data-action="continue"]').count()) === 0, 'dead run offered Continue');
    const gallery = (await page.locator('.endings-gallery').innerText()).toLowerCase();
    assert(gallery.includes('ways to die (not endings): 1 of 3') && gallery.includes('suit breach'), `gallery: ${gallery}`);
    await page.click('[data-action="begin"]');
    assert((await meter(page, 'stormClock')) === 7 && (await meter(page, 'oxygen')) === 4, 'new run not fresh');
  });

  await check('the storm forces the player into shelter, and the choice says so first', async () => {
    await pick(page, 'restore_memory');
    await pick(page, 'dry_ravine');
    const copy = page.locator('[data-choice="copy_archive"]');
    assert((await copy.getAttribute('data-risk')) === 'shelter:storm', 'forced shelter not shown');
    await pick(page, 'copy_archive');
    assert((await scene(page)) === 'Signal in the Storm', 'not in the shelter');
    assert((await page.locator('[data-shelter="storm"]').count()) === 1, 'no shelter mark');
    await page.screenshot({ path: path.join(shots, 'phone-15-forced-shelter.png'), fullPage: true });
  });

  await check('restart from the menu needs a second tap and resets state', async () => {
    await page.click('.menu-button');
    await page.locator('dialog.settings[open]').waitFor();
    await page.screenshot({ path: path.join(shots, 'phone-08-menu.png') });
    await page.click('[data-action="restart"]');
    assert((await scene(page)) === 'Signal in the Storm', 'restarted on first tap');
    await page.click('[data-action="restart"]');
    assert((await scene(page)) === 'Impact', 'did not restart');
    assert((await meter(page, 'oxygen')) === 4 && (await meter(page, 'stormClock')) === 7, 'state not reset');
    assert((await page.locator('.meter-suitIntegrity:visible').count()) === 0, 'Suit shown again before it matters');
    assert((await page.locator('dialog.settings[open]').count()) === 0, 'menu still open');
  });

  await check('switching language changes story and interface text', async () => {
    await page.click('.menu-button');
    await page.selectOption('dialog.settings select', 'fr');
    await page.keyboard.press('Escape');
    assert((await scene(page)) === fr.scenes.impact.title, 'scene title not French');
    assert((await page.locator('#choices-heading').textContent()).includes('Que faites-vous'), 'UI not French');
    assert((await page.evaluate(() => document.documentElement.lang)) === 'fr', 'html lang not set');
    await page.screenshot({ path: path.join(shots, 'phone-09-french.png'), fullPage: true });
    await page.click('.menu-button');
    await page.selectOption('dialog.settings select', 'en');
    await page.keyboard.press('Escape');
  });

  await check('no console errors during the phone session', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
  await context.close();
}


// ---------- First run: learn by playing, no guided tour ----------
{
  const { context, page, errors } = await newPage({ tutorial: true });

  await check('tutorial: the first scene is playable at once, with one hint and no tour', async () => {
    await page.fill('input[name="callsign"]', 'Wren');
    await page.click('[data-action="begin"]');
    await page.locator('[data-coach="play"]').waitFor();
    assert((await page.locator('.tour, .tour-card, .tour-blocker').count()) === 0, 'a tour is covering the first scene');
    assert((await page.locator('[data-coach="play"]').innerText()).trim() === '', 'the first scene still explains itself in words');
    assert((await page.locator('[data-choice="restore_memory"]').count()) === 1, 'first choice is not on screen');
    const tucked = await page.locator('.narrative .more-copy').evaluateAll((els) => els.length > 0 && els.every((el) => el.getBoundingClientRect().height < 2));
    assert(tucked, 'the rest of the passage is on screen before More');
    const lead = await page.locator('.narration .lead').first().innerText();
    assert(lead.trim().split(/\s+/).length <= 7, `opening line is long: ${lead}`);
    assert((await page.locator('.narrative .more-copy').first().textContent()).toLowerCase().includes('copper'), 'the rest of the line is missing');
    await page.screenshot({ path: path.join(shots, 'phone-16-first-hint.png') });
  });

  await check('tutorial: the first choice works immediately and retires the hint', async () => {
    await page.click('[data-choice="restore_memory"]');
    assert((await scene(page)) === 'Two ways through the dust', 'first choice did not go through');
    assert((await page.locator('[data-coach="play"]').count()) === 0, 'hint still showing after the first choice');
    assert((await page.locator('.tour').count()) === 0, 'a tour appeared after the choice');
  });

  await check('tutorial: new meters arrive with a "New" badge; no tip boxes during play', async () => {
    assert((await page.locator('.hud-slot-inline .meter-suitIntegrity.is-new').count()) === 1, 'new suit meter is not marked');
    await page.screenshot({ path: path.join(shots, 'phone-18-new-meters.png'), fullPage: true });
    for (const id of ['glass_ridge', 'leave_with_coupler']) {
      await pick(page, id);
      assert((await page.locator('.tip-card, [data-tip], [data-coach="play"]').count()) === 0, `a tip box appeared after ${id}`);
    }
    assert((await page.locator('[data-choice="cross_exposed_ridge"]').getAttribute('data-risk'))?.startsWith('death'), 'deadly option not marked');
  });

  await check('tutorial: the hint does not come back on Continue; Menu shows it again on the next new game', async () => {
    await page.reload();
    await page.click('[data-action="continue"]');
    assert((await page.locator('[data-coach="play"], .tour').count()) === 0, 'hint came back on Continue');
    await page.click('.menu-button');
    assert((await page.locator('[data-tips]').count()) === 0, 'tips toggle still in the Menu');
    await page.click('[data-action="reset-tutorial"]');
    assert((await page.locator('dialog.settings [role="status"]').innerText()).includes('next new game'), 'no confirmation');
    await page.click('[data-action="restart"]');
    await page.click('[data-action="restart"]');
    await page.locator('[data-coach="play"]').waitFor();
    await page.click('[data-choice="save_battery"]');
    assert((await page.locator('[data-coach="play"]').count()) === 0, 'hint stayed after the teaching choice');
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), TUTORIAL_KEY);
    assert(saved.tourDone === true, 'playing did not retire the hint');
  });

  await check('tutorial: no console errors', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
  await context.close();
}

// ---------- Every Vesper-6 run, and a covering set of the whole story, through the interface ----------
await check('every Vesper-6 run (chapters 1–2) plays through the UI to its outcome or death', async () => {
  const runs = planetRuns();
  const { context, page, errors } = await newPage();
  await page.click('[data-action="begin"]');
  for (const run of runs) {
    for (const id of run.ids) await pick(page, id);
    const title = await scene(page);
    assert(title === sceneById[run.end].title, `${run.ids.join('>')} ended at "${title}"`);
    await checkFinalStats(page, run.state, run.ids.join('>'));
    await resetRun(page);
  }
  assert(errors.length === 0, errors.join(' | '));
  const deaths = runs.filter((r) => sceneById[r.end].death).length;
  console.log(`       (${runs.length} runs: ${runs.length - deaths} survive, ${deaths} die)`);
  await context.close();
});

await check('a covering set of runs takes every possible choice and reaches every ending and death', async () => {
  const runs = coveringRuns();
  const ends = new Set(runs.map((r) => r.end));
  for (const s of story.scenes.filter((x) => isTerminal(x))) assert(ends.has(s.id), `no run reaches ${s.id}`);
  const { context, page, errors } = await newPage();
  await page.click('[data-action="begin"]');
  for (const run of runs) {
    for (const id of run.ids) await pick(page, id);
    const title = await scene(page);
    assert(title === sceneById[run.end].title, `${run.ids.join('>')} ended at "${title}"`);
    await checkFinalStats(page, run.state, run.ids.join('>'));
    await resetRun(page);
  }
  assert(errors.length === 0, errors.join(' | '));
  console.log(`       (${runs.length} runs, ${runs.reduce((n, r) => n + r.ids.length, 0)} choices)`);
  await context.close();
});

// ---------- Device language and layout ----------
for (const [locale, expect] of [
  ['fr-FR', 'fr'],
  ['es-ES', 'es'],
  ['it-IT', 'it'],
  ['pt-BR', 'pt-BR'],
  ['de-DE', 'en'],
]) {
  await check(`device language ${locale} opens in ${expect}`, async () => {
    const { context, page } = await newPage({ locale });
    await page.locator('.game-title').waitFor();
    assert((await page.evaluate(() => document.documentElement.lang)) === expect, 'wrong language');
    await context.close();
  });
}

for (const width of [320, 360, 390, 768, 1280]) {
  await check(`no horizontal scrolling at ${width}px, every image loads`, async () => {
    const { context, page, errors } = await newPage({ width, height: width > 700 ? 900 : 760, reducedMotion: 'no-preference' });
    await page.click('[data-action="begin"]');
    await pick(page, 'restore_memory');
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 0, `overflows by ${overflow}px`);
    const broken = await page.locator('img').evaluateAll((imgs) => imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length);
    assert(broken === 0, `${broken} images failed`);
    const small = await page.locator('button:visible').evaluateAll((btns) => btns.filter((b) => b.getBoundingClientRect().height < 36).length);
    assert(small === 0, `${small} buttons shorter than 36px`);
    if (width === 1280 || width === 320) await page.screenshot({ path: path.join(shots, `width-${width}.png`), fullPage: true });
    assert(errors.length === 0, errors.join(' | '));
    await context.close();
  });
}

for (const [locale, width] of [
  ['en-US', 320],
  ['fr-FR', 320],
  ['es-ES', 320],
  ['it-IT', 320],
  ['pt-BR', 320],
  ['fr-FR', 700],
]) {
  await check(`status labels are never cut off (${locale}, ${width}px)`, async () => {
    const { context, page } = await newPage({ width, height: 760, locale });
    await page.click('[data-action="begin"]');
    await page.locator('.hud-slot-inline .meter-label').first().waitFor();
    const cut = await page.locator('.hud:visible .meter-label:not(.sr), .hud:visible .pack-label:not(.sr)').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent),
    );
    assert(cut.length === 0, `cut off: ${cut.join(', ')}`);
    // A label may wrap between words, but never break inside a word: lines <= words.
    const broken = await page.locator('.hud:visible .meter-label:not(.sr)').evaluateAll((els) =>
      els
        .filter((el) => {
          const lines = Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
          return lines > el.textContent.trim().split(/\s+/).length;
        })
        .map((el) => el.textContent),
    );
    assert(broken.length === 0, `word broken mid-way: ${broken.join(', ')}`);
    if (locale === 'fr-FR' && width === 320) await page.locator('.hud:visible').screenshot({ path: path.join(shots, 'hud-fr-320.png') });
    await context.close();
  });
}

await check('home-screen install: manifest and icons load', async () => {
  const { context, page } = await newPage();
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await page.request.get(new URL(href, base).href)).json();
  assert(manifest.display === 'standalone' && manifest.icons.length >= 2, 'manifest incomplete');
  const touch = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  for (const src of [touch, ...manifest.icons.map((i) => i.src)]) {
    const res = await page.request.get(new URL(src, base).href);
    assert(res.ok() && (res.headers()['content-type'] ?? '').includes('png'), `icon missing: ${src}`);
  }
  await context.close();
});

// ---------- Launch features ----------
await check('offline: after one visit the game loads and plays with no network', async () => {
  const { context, page, errors } = await newPage();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.click('[data-action="begin"]');
  await pick(page, 'restore_memory');
  assert((await scene(page)) === 'Two ways through the dust', 'could not play offline');
  const broken = await page.locator('img').evaluateAll((imgs) => imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).length);
  assert(broken === 0, `${broken} images missing offline`);
  await context.setOffline(false);
  assert(errors.length === 0, errors.join(' | '));
  await context.close();
});

await check('update: a new deploy shows "ready · Reload" and keeps the run', async () => {
  const { context, page } = await newPage();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.click('[data-action="begin"]');
  await pick(page, 'save_battery');
  await page.request.get(base + '__qa/new-deploy');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.locator('[data-action="apply-update"]').waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(shots, 'phone-11-update.png') });
  await Promise.all([page.waitForEvent('load'), page.click('[data-action="apply-update"]')]);
  await page.click('[data-action="continue"]');
  assert((await scene(page)) === 'Two ways through the dust', 'run lost after update');
  assert((await page.locator('[data-action="apply-update"]').count()) === 0, 'banner still shown');
  await context.close();
  await fetch(base + '__qa/new-deploy'); // leave the server on a consistent version
});

await check('safety screen: a crash shows a way back instead of a blank page', async () => {
  const { context, page } = await newPage({ hash: '#crash-test' });
  await page.locator('.crash-main h1').waitFor();
  assert((await page.locator('.crash-main h1').innerText()) === 'Something went wrong', 'no crash screen');
  await Promise.all([page.waitForEvent('load'), page.click('[data-action="crash-reset"]')]);
  await page.locator('.game-title').waitFor();
  await context.close();
});

await check('sound: toggle in the top bar, remembered after reload, levels sensible', async () => {
  const { context, page, errors } = await newPage();
  await page.click('[data-action="begin"]');
  const toggle = page.locator('[data-action="toggle-sound"]');
  assert((await toggle.getAttribute('aria-pressed')) === 'true', 'sound should default to on');
  await toggle.click();
  assert((await page.evaluate(() => document.documentElement.dataset.sound)) === 'off', 'did not turn off');
  await page.reload();
  await page.click('[data-action="continue"]');
  assert((await toggle.getAttribute('aria-pressed')) === 'false', 'sound setting not remembered');
  await page.click('.menu-button');
  await page.click('dialog.settings [data-sound="on"]');
  await page.keyboard.press('Escape');
  assert((await toggle.getAttribute('aria-pressed')) === 'true', 'menu toggle did not sync');
  // Render each mood offline: audible but quiet, never clipping.
  const levels = await page.evaluate(async () => {
    const out = {};
    for (const mood of ['wind', 'interior', 'storm', 'launch', 'space', 'shelter', 'relay', 'field']) out[mood] = await window.__tlwAmbience.measure(mood, 3);
    return out;
  });
  for (const [mood, { rms, peak }] of Object.entries(levels)) {
    assert(rms > 0.004 && rms < 0.2 && peak < 0.9, `${mood}: rms ${rms.toFixed(3)} peak ${peak.toFixed(3)}`);
  }
  console.log(`       (levels ${Object.entries(levels).map(([m, l]) => `${m} ${(20 * Math.log10(l.rms)).toFixed(0)} dB`).join(', ')})`);
  assert(errors.length === 0, errors.join(' | '));
  await context.close();
});

await check('coupler leaves the pack once installed; outcome is read with the heading', async () => {
  const { context, page } = await newPage();
  await page.click('[data-action="begin"]');
  // Dry Ravine keeps the suit whole, so the exposed crossing leaves it at 1: survivable, but too weak to calibrate.
  for (const id of ['save_battery', 'dry_ravine', 'leave_with_coupler']) await pick(page, id);
  assert((await page.locator('.pack-item:visible').allInnerTexts()).includes('Reactor coupler'), 'coupler not in pack');
  await pick(page, 'cross_exposed_ridge');
  const careful = page.locator('[data-choice="careful_repair"]');
  assert((await careful.getAttribute('aria-disabled')) === 'true', 'careful repair should need Suit 2+');
  assert((await careful.innerText()).includes('Suit 2+'), 'lock reason missing');
  await pick(page, 'quick_patch');
  assert(!(await page.locator('.pack-item:visible').allInnerTexts()).includes('Reactor coupler'), 'installed coupler still in pack');
  assert((await page.locator('h1').count()) === 1, 'game screen needs exactly one h1');
  assert((await page.locator('.outcome').count()) === 0, 'last-action box came back');
  assert((await page.locator('.scene-title').getAttribute('aria-describedby')) === null, 'heading still points at a text outcome');
  await context.close();
});

// The shortest route to any final ending (chapter 4).
const finale = story.scenes
  .filter((s) => s.ending)
  .map((s) => ({ id: s.id, route: routeTo(s.id) }))
  .filter((x) => x.route)
  .sort((a, b) => a.route.ids.length - b.route.ids.length)[0];
const outcomesTotal = story.scenes.filter((s) => s.ending || (s.chapterEnd && s.chapter === 'ch2')).length;

await check('endings gallery with hints on the title screen; share copies a link', async () => {
  const { context, page } = await newPage();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  assert((await page.locator('.endings-gallery').count()) === 0, 'gallery should wait for a first ending');
  await page.click('[data-action="begin"]');
  for (const id of finale.route.ids) await pick(page, id);
  const title = sceneById[finale.id].title;
  assert((await scene(page)) === title, `not the ending ${title}`);
  await page.click('[data-action="share"]');
  await page.locator('.share-status', { hasText: 'Copied' }).waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.includes(title) && copied.includes(`2 of ${outcomesTotal}`) && copied.includes('https://'), `copied: ${copied}`);
  await page.screenshot({ path: path.join(shots, 'phone-10-final-ending.png'), fullPage: true });
  await page.locator('.ending-actions .btn').last().click();
  const gallery = page.locator('.title-screen .endings-gallery');
  await gallery.waitFor();
  const text = (await gallery.innerText()).toLowerCase().replace(/\s+/g, ' ');
  assert(text.includes(title.toLowerCase()) && text.includes('hint:') && text.includes(`2 of ${outcomesTotal}`), `gallery: ${text}`);
  assert((await page.locator('[data-action="continue"]').count()) === 0, 'finished run should not offer Continue');
  assert((await page.locator('[data-action="begin"]').count()) === 1, 'finished run should offer Begin');
  await page.screenshot({ path: path.join(shots, 'phone-12-title-gallery.png'), fullPage: true });
  await context.close();
});

await check('embedded in a strict sandboxed frame (no storage, no forms): still playable to an ending', async () => {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent(`<iframe id="f" sandbox="allow-scripts" src="${base}" style="width:400px;height:880px;border:0"></iframe>`);
  const frame = await (await page.waitForSelector('#f')).contentFrame();
  await frame.waitForSelector('.game-title');
  await frame.fill('input[name="callsign"]', 'Kite');
  await frame.press('input[name="callsign"]', 'Enter'); // Enter in the callsign field starts the run
  // No storage, so the first-scene hint shows, but it does not block the choices.
  for (const id of finale.route.ids) await frame.click(`[data-choice="${id}"]`);
  assert((await frame.locator('.scene-title').innerText()) === sceneById[finale.id].title, 'did not reach an ending');
  await frame.click('[data-action="share"]');
  await frame.locator('.share-status textarea').waitFor(); // no share sheet or clipboard: text to copy by hand
  assert(errors.length === 0, errors.join(' | '));
  await context.close();
});

await check('keyboard-only: Tab reaches choices with a visible focus ring', async () => {
  const { context, page } = await newPage({ width: 1280, height: 900 });
  await page.locator('.game-title').waitFor(); // keys pressed before the app has rendered go nowhere
  await page.keyboard.press('Tab'); // callsign field
  await page.keyboard.press('Tab'); // Begin
  await page.keyboard.press('Enter');
  await page.locator('.scene-title', { hasText: 'Impact' }).waitFor();
  // The game moves focus to the new heading; wait for it so Tab starts from there.
  await page.waitForFunction(() => document.activeElement?.classList.contains('scene-title'));
  let found = false;
  for (let i = 0; i < 10 && !found; i += 1) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement?.classList.contains('choice') ?? false);
  }
  assert(found, 'could not tab to a choice');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert(outline !== 'none', 'no focus outline');
  await page.keyboard.press('Enter');
  assert((await page.locator('.scene-title').innerText()) !== 'Impact', 'Enter did not choose');
  await context.close();
});

await browser.close();
server.close();
console.log(`\n${passed} passed, ${failures.length} failed. Screenshots in qa-screenshots/.`);
if (failures.length) process.exit(1);
