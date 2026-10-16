// Check frames before recording: render one frame near the end of every beat (or only the scenes named in argv)
// to frames/<scene>-<i>.jpg and tile them 2×2 into frames/sheet-<scene>-<k>.jpg. Read the sheets; fix overlaps,
// off-canvas text and subtitle collisions; then node record.mjs.   Usage: node frames.mjs [sceneId ...]
import { chromium } from 'playwright-core';
import { execSync } from 'child_process';
import fs from 'fs';
const only = process.argv.slice(2);
const b = await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const p = await b.newPage({viewport: {width: 1920, height: 1080}});
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('file://' + process.cwd() + '/index.html?record'); await p.evaluate(() => ready);
fs.mkdirSync('frames', {recursive: true});
const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
for (const s of TL.scenes) {
  if (only.length && !only.includes(s.id)) continue;
  const files = [];
  for (const [i, bt] of s.beats.entries()) {
    const t = s.start + bt.start + bt.dur * .92;
    const url = await p.evaluate(t => { render(t); return cv.toDataURL('image/jpeg', .8); }, t);
    const f = `frames/${s.id}-${i}.jpg`; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f);
  }
  for (let k = 0; k < files.length; k += 4) {
    const g = files.slice(k, k + 4); while (g.length < 4) g.push(g[g.length - 1]);
    execSync(`ffmpeg -y -loglevel error ${g.map(f => '-i ' + f).join(' ')} -filter_complex "[0][1][2][3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0,scale=1920:-1" frames/sheet-${s.id}-${k / 4}.jpg`);
  }
}
console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].join('\n') : 'no page errors');
await b.close();
