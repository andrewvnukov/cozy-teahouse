// Headless-генерация магазинных ассетов (без внешних image-API).
// Делает: скриншоты геймплея с реального билда + обложки RU/EN + иконку из card.html.
// Запуск из папки игры:  node test/make-assets.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const out = resolve(root, 'store-assets');
mkdirSync(out, { recursive: true });
const gameUrl = 'file://' + resolve(root, 'index.html');
const cardUrl = 'file://' + resolve(root, 'store', 'card.html');

// ---- CONFIG ----
// Герой обложки — лисёнок Рыжик (стартовый гость чайной) с чашкой чая. Векторная SVG, без эмодзи.
const HERO = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
  + '<g stroke="#4A3324" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">'
  + '<path d="M28 38 L14 14 Q34 20 38 34 Z" fill="#E8703A"/>'                       // левое ухо
  + '<path d="M72 38 L86 14 Q66 20 62 34 Z" fill="#E8703A"/>'                       // правое ухо
  + '<path d="M29.5 33 L20 18 Q32 23 34.5 32 Z" fill="#FFF6E4"/>'                   // внутр. левое ухо
  + '<path d="M70.5 33 L80 18 Q68 23 65.5 32 Z" fill="#FFF6E4"/>'                   // внутр. правое ухо
  + '<circle cx="50" cy="52" r="30" fill="#E8703A"/>'                               // голова
  + '<path d="M50 62c-10 0-15 5-15 12 0 6 6 10 15 10s15-4 15-10c0-7-5-12-15-12z" fill="#FFF6E4"/>' // мордочка
  + '</g>'
  + '<circle cx="40" cy="46" r="5.5" fill="#FFFFFF" stroke="#4A3324" stroke-width="2.4"/>'
  + '<circle cx="60" cy="46" r="5.5" fill="#FFFFFF" stroke="#4A3324" stroke-width="2.4"/>'
  + '<circle cx="41.5" cy="46" r="2.6" fill="#4A3324"/>'
  + '<circle cx="61.5" cy="46" r="2.6" fill="#4A3324"/>'
  + '<circle cx="50" cy="60" r="2.6" fill="#4A3324"/>'
  + '<path d="M43 66q7 5 14 0" fill="none" stroke="#4A3324" stroke-width="2.6"/>'
  + '<ellipse cx="30" cy="56" rx="4" ry="2.6" fill="#F0A6B8" opacity=".55"/>'
  + '<ellipse cx="70" cy="56" rx="4" ry="2.6" fill="#F0A6B8" opacity=".55"/>'
  + '<g stroke="#4A3324" stroke-width="3.4" stroke-linejoin="round">'
  + '<ellipse cx="74" cy="86" rx="13" ry="7.5" fill="#FFF6E4"/>'                     // блюдце
  + '<ellipse cx="74" cy="80" rx="9.5" ry="6.5" fill="#FFF6E4"/>'                    // чашка
  + '<path d="M74 76a9.5 5.5 0 000 9" fill="#C96B4A" stroke="none"/>'
  + '<path d="M83 78q6 1 4 6.5" fill="none"/>'                                       // ручка
  + '</g>'
  + '</svg>';
const CONFIG = {
  titleRu: 'Уютная Чайная', titleEn: 'Cozy Teahouse',
  subRu: 'Угости гостей чаем · собери книгу', subEn: 'Serve tea · fill the guestbook',
  heroSvg: HERO,
  accent: '#D98C3D', bg: '#3B2A1E', ink: '#4A3324',
  // характерные экраны: [имя файла, скрипт подготовки состояния через хуки]
  shots: [
    ['d1-start',      async p => { for(let i=0;i<10;i++) await p.evaluate(()=>window.__pour()); }],
    ['d2-serving',    async p => { await p.evaluate(()=>window.__grant(30000));
                                   for(let i=0;i<3;i++) await p.evaluate(()=>window.__buyNextGuest());
                                   for(let i=0;i<10;i++){ await p.mouse.click(960, 900); await p.waitForTimeout(60); } }],
    ['d3-guests',     async p => { await p.evaluate(()=>{ window.__grant(80000); }); await p.click('#guestBtn'); }],
    ['d4-upgrades',   async p => { await p.evaluate(()=>window.__grant(250000)); await p.click('#upBtn'); }],
    ['d5-guestbook',  async p => { await p.evaluate(()=>window.__grant(400000));
                                   for(let i=0;i<6;i++) await p.evaluate(()=>window.__buyNextGuest());
                                   await p.click('#collBtn'); }],
  ],
};

const browser = await chromium.launch();

async function shot(url, w, h, file, prep, locale) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale });
  await page.goto(url);
  await page.waitForTimeout(500);
  if (prep) await prep(page);
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(out, file) });
  await page.close();
  console.log('saved', file);
}

// Скриншоты геймплея (десктоп 1920x1080) — RU и EN локали (авто-язык через navigator.language)
for (const [name, prep] of CONFIG.shots) {
  await shot(gameUrl, 1920, 1080, name + '.png',    prep, 'ru-RU');
  await shot(gameUrl, 1920, 1080, name + '-en.png', prep, 'en-US');
}

// Обложки 800x470 и иконка 512x512 из card.html
const card = (o) => cardUrl + '?' + new URLSearchParams(o).toString();
await shot(card({ w:800,h:470,mode:'cover',title:CONFIG.titleRu,sub:CONFIG.subRu,heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 800, 470, 'cover.png');
await shot(card({ w:800,h:470,mode:'cover',title:CONFIG.titleEn,sub:CONFIG.subEn,heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 800, 470, 'cover-en.png');
await shot(card({ w:512,h:512,mode:'icon',heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 512, 512, 'icon.png');

await browser.close();
console.log('\nАссеты готовы в', out);
