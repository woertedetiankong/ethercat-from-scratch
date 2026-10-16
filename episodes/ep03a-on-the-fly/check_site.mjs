// one-off site check: home + video + chapters + slides, both languages, desktop and phone, light and dark
import { chromium } from 'playwright-core';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errs = [];
for (const [lang, scheme, w] of [['zh', 'light', 1280], ['en', 'dark', 1280], ['zh', 'dark', 390], ['en', 'light', 390]]) {
  const ctx = await b.newContext({viewport: {width: w, height: 900}, colorScheme: scheme});
  await ctx.addInitScript(l => localStorage.setItem('course.lang', l), lang);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(lang + ' ' + e.message));
  await p.goto(url + '#ep03a'); await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const v = document.querySelector('video');
    const chaps = [...document.querySelectorAll('[data-t], .chap, .chapters li, .chapters button')].map(e => e.textContent.trim()).slice(0, 3);
    const slides = [...document.querySelectorAll('a')].filter(a => /slides/.test(a.getAttribute('href') || '')).map(a => a.getAttribute('href'));
    return {h1: document.querySelector('h1')?.textContent, video: v ? v.getAttribute('src') : null, ready: v ? v.readyState : -1, chaps, slides, hscroll: document.documentElement.scrollWidth > innerWidth};
  });
  console.log(lang, scheme, w, JSON.stringify(info));
  // click the 4th chapter: the video should seek there
  const ch = p.locator('li button').nth(3);
  if (await ch.count()) { await ch.click(); await p.waitForTimeout(800); console.log('  after chapter click t =', await p.evaluate(() => document.querySelector('video')?.currentTime)); }
  await p.screenshot({path: `${out}/home-${lang}-${scheme}-${w}.png`, fullPage: w < 500 ? false : true});
  await ctx.close();
}
// slides page + its ▶ link
const ctx = await b.newContext({viewport: {width: 1280, height: 900}});
const p = await ctx.newPage(); p.on('pageerror', e => errs.push('slides ' + e.message));
await p.goto(url.replace(/\/\?t=.*/, '/content/ep03a/slides.html') + ''); await p.waitForTimeout(1200);
console.log('slides:', await p.evaluate(() => ({tiles: document.querySelectorAll('img').length, play: [...document.querySelectorAll('a')].filter(a => /#ep03a@/.test(a.href)).length, practice: document.body.innerText.includes('9485')})));
await p.screenshot({path: `${out}/slides.png`});
const link = await p.evaluate(() => [...document.querySelectorAll('a')].find(a => /#ep03a@/.test(a.href))?.href);
console.log('first ▶ link:', link);
console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
await b.close();
