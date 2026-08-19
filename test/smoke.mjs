// Playwright smoke-тест «Уютная Чайная».
// Запуск:  node test/smoke.mjs
// Проверяет: загрузку без ошибок консоли, тест-хуки, налив чая (тап-доход),
// пассивный доход, приглашение гостя (доход+книга растут), апгрейды, награды,
// переключатель языка, сейв/перезагрузку.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = 'file://' + resolve(__dirname, '..', 'index.html');

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 900 }, locale: 'ru-RU' });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(url);
await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 8000 });

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); fail++; process.exitCode = 1; } else { console.log('ok  ', msg); pass++; } };
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

let s0 = await state();
assert(typeof s0.coins === 'number', 'render_game_to_text returns state');
assert(s0.lvl === 1 && s0.guests === 1, 'starts with 1 guest (fox)');
assert(s0.seen === 1, 'guestbook seeded with starter');
assert(s0.ips >= 1, 'starter guest gives passive income');

// тап по чайной наливает чай (тап-доход) — единственный способ, кнопки нет
await page.mouse.click(240, 450);
let s1 = await state();
assert(s1.coins > s0.coins, 'tap on scene pours tea (tap income)');

await page.evaluate(() => window.__pour());
let s1b = await state();
assert(s1b.coins > s1.coins, '__pour hook also increases tea leaves');

// пассивный доход через хук времени
await page.evaluate(() => window.advanceTime(10000));
let s2 = await state();
assert(s2.coins >= s1b.coins + s1b.ips * 9, 'passive income accrues over time');

// приглашение нового гостя -> растут гости, книга и доход
await page.evaluate(() => window.__grant(2000));
let before = await state();
let bought = await page.evaluate(() => window.__buyNextGuest());
let after = await state();
assert(bought === true, 'can invite a new guest when affordable');
assert(after.guests === before.guests + 1, 'guest count increases');
assert(after.lvl === before.lvl + 1, 'lvl (guests) increases -> upgrade path works');
assert(after.seen === before.seen + 1, 'guestbook grows on new guest');
assert(after.ips > before.ips, 'new guest raises passive income');
assert(after.best >= after.guests, 'best (leaderboard) tracks guest count');

// апгрейд «ароматный чай» повышает тап-доход
await page.evaluate(() => window.__grant(100000));
let bT = await state();
let okT = await page.evaluate(() => window.__buyUp('tea'));
let aT = await state();
assert(okT && aT.tea === bT.tea + 1, 'tea upgrade applies');
assert(aT.tapGain > bT.tapGain, 'tea upgrade raises tap gain');

// апгрейд «тёплый очаг» повышает пассивный доход
let bH = await state();
let okH = await page.evaluate(() => window.__buyUp('hearth'));
let aH = await state();
assert(okH && aH.hearth === bH.hearth + 1, 'hearth upgrade applies');
assert(aH.ips > bH.ips, 'hearth upgrade raises income');

// апгрейд «пледы» удешевляет гостей (upCost падает)
let bB = await state();
let okB = await page.evaluate(() => window.__buyUp('blanket'));
let aB = await state();
assert(okB && aB.blanket === bB.blanket + 1, 'blanket upgrade applies');
assert(aB.upCost <= bB.upCost, 'blanket upgrade lowers next guest price');

// награда ×2 удваивает доход
let bx = await state();
await page.click('#x2Btn');
let ax = await state();
assert(ax.x2 === true, 'income ×2 reward activates');
assert(ax.ips >= bx.ips * 2, 'income doubled while ×2 active');

// подарок начисляет чаинки
let bg = await state();
await page.click('#giftBtn');
let ag = await state();
assert(ag.coins > bg.coins, 'gift reward grants tea leaves');

// переключатель языка RU/EN
let sL0 = await state();
assert(sL0.lang === 'ru', 'starts in ru (locale ru-RU default for this test)');
await page.evaluate(() => window.__toggleLang());
let sL1 = await state();
assert(sL1.lang === 'en', 'toggleLang switches to en');
assert(await page.getAttribute('html', 'lang') === 'en', '<html lang> updates on toggle');
await page.evaluate(() => window.__toggleLang());

// панели открываются без ошибок
await page.click('#guestBtn'); await page.waitForTimeout(120);
assert(await page.isVisible('#mBody .row'), 'guest invite panel renders rows');
await page.click('#mClose'); await page.waitForTimeout(80);
await page.click('#collBtn'); await page.waitForTimeout(120);
assert(await page.isVisible('#mBody .coll'), 'guestbook grid renders');
await page.click('#mClose'); await page.waitForTimeout(80);
await page.click('#upBtn'); await page.waitForTimeout(120);
assert(await page.isVisible('#mBody .row'), 'upgrades panel renders rows');
await page.click('#mClose');

// сейв переживает перезагрузку
let pre = await state();
await page.evaluate(() => window.__grant(0)); // форс-persist через действие
await page.evaluate(() => window.__pour());
await page.waitForTimeout(50);
await page.reload();
await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 8000 });
let post = await state();
assert(post.guests === pre.guests, 'guest roster survives reload');
assert(post.seen === pre.seen, 'guestbook survives reload');
assert(post.tea === pre.tea && post.hearth === pre.hearth && post.blanket === pre.blanket, 'upgrades survive reload');

assert(errors.length === 0, 'no console/page errors' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');
