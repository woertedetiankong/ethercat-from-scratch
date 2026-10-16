/* =========================================================
   Episode 1 — The 1 ms problem. One scene per id in script.json; numbers from ep01_data.js (D), real runs.
   Colour legend (the whole course):
     gold   = the master and the commands it sends (targets, frames)
     sky    = joint J1        violet = joint J2        dim = the analog card
     coral  = jitter, lateness, error        mint = the distributed clock, SYNC0, "in step"
   Canvas 1920×1080; content between y≈170 and y≈830.
   ========================================================= */
const SCN = {};

/* ---------- episode helpers ---------- */
const fade = (lt, t0, t1, d = .6) => eo(ramp(lt, t0, t0 + d)) * (t1 == null ? 1 : 1 - ramp(lt, t1 - .5, t1));
function box(x, y, w, h, title, sub, color, a = 1, o = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  glow(x, y, Math.max(w, h) * .75, color, o.glowA ?? .14);
  rr(x - w / 2, y - h / 2, w, h, 16); ctx.fillStyle = o.fill || C.panel2; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(color, .85); ctx.stroke();
  ctx.restore();
  text(title, x, y - (sub ? 16 : 0), {size: o.size || 30, weight: 600, color: o.tcolor || C.ink, alpha: a});
  if (sub) text(sub, x, y + 22, {size: 22, font: F.zh, color: C.dim, alpha: a});
}
// the course's running example: master → AI card → J1 → J2 on one cable
const LN = {y: 470, xs: [330, 760, 1160, 1560], w: 250, h: 150};
const LCOL = [C.gold, C.dim, C.sky, C.violet];
const LNAME = [['Master', '主站'], ['Slave 1 · AI card', '从站 1 · 采集卡'], ['Slave 2 · J1', '从站 2 · 关节 J1'], ['Slave 3 · J2', '从站 3 · 关节 J2']];
function lineDiagram(o = {}) {
  const a = o.alpha ?? 1, y = o.y ?? LN.y, sh = o.show ?? [1, 1, 1, 1];
  for (let i = 0; i < 3; i++) {
    const k = Math.min(sh[i], sh[i + 1]); if (k <= 0) continue;
    const x0 = LN.xs[i] + LN.w / 2, x1 = LN.xs[i + 1] - LN.w / 2;
    ctx.save(); ctx.globalAlpha *= a * k; ctx.strokeStyle = C.faint; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, eo(k)), y); ctx.stroke(); ctx.restore();
  }
  if (o.mid) o.mid();
  LN.xs.forEach((x, i) => box(x, y, LN.w, LN.h, LNAME[i][0], LNAME[i][1], LCOL[i], a * eo(sh[i]), {size: 26, fill: C.panel2}));
}
// a frame (packet) travelling along the cable from the master to slave k (1..3), p in 0..1
function frameOnLine(p, k, color, a = 1, y = LN.y) {
  if (p <= 0 || p >= 1) return;
  const x = lerp(LN.xs[0] + LN.w / 2, LN.xs[k], p);
  ctx.save(); ctx.globalAlpha *= a; glow(x, y, 40, color, .7);
  rr(x - 26, y - 14, 52, 28, 8); ctx.fillStyle = color; ctx.fill(); ctx.restore();
}
// a small joint arm drawn above a box
function jointArm(x, y, th, color, a = 1, L = 90) { arm(x, y, L, th, {color, lw: 12, mass: 12, alpha: a}); }
// a timeline row: ticks at times ts (ms), mapped onto x0..x0+w for 0..span ms
function tickRow(x0, y, w, span, ts, color, a = 1, o = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
  ts.forEach((t, i) => { const k = o.prog == null ? 1 : clamp((o.prog - i * .12) * 2, 0, 1); if (k <= 0) return;
    const x = x0 + t / span * w; ctx.globalAlpha = a * k; glow(x, y, 26, color, .5); ctx.fillStyle = color; rr(x - 4, y - 26, 8, 52, 4); ctx.fill(); });
  ctx.restore();
  if (o.label) text(o.label, x0 - 24, y, {size: 26, weight: 600, color, align: 'right', alpha: a});
}
function card(x, y, w, h, en, zh, color, a = 1, o = {}) {
  if (a <= 0) return;
  panel(x, y, w, h, {alpha: a, fill: C.panel, edge: rgba(color, .7), lw: 2.5});
  text(en, x, y - (zh ? 18 : 0), {size: o.size || 34, weight: 600, color: o.tcolor || C.ink, alpha: a});
  if (zh) text(zh, x, y + 26, {size: (o.size || 34) * .7, font: F.zh, color: C.dim, alpha: a});
}
function simTag(x, y, a) { chip('模拟 · simulated', x, y, C.violet, a, {size: 18}); }
function realTag(x, y, a) { chip('真实运行 · real run', x, y, C.mint, a, {size: 18}); }

/* ---------- 0. intro ---------- */
SCN.intro = (lt, b, d) => {
  const aArms = fade(lt, .2, b[2]);
  const th = 30 * DEG * eio(ramp(lt, b[0] + 2.2, b[0] + 3.4));
  const th2 = 30 * DEG * eio(ramp(lt, b[0] + 2.6, b[0] + 3.8)); // the second one a little later: the question
  jointArm(700, 560, th, C.sky, aArms, 220); jointArm(1220, 560, th2, C.violet, aArms, 220);
  text('J1', 700, 640, {size: 30, weight: 700, color: C.sky, alpha: aArms});
  text('J2', 1220, 640, {size: 30, weight: 700, color: C.violet, alpha: aArms});
  const p = ramp(lt, b[0] + .6, b[0] + 2.1);
  packet({x: 960, y: 240}, {x: 760, y: 460}, p, C.gold, {bend: .2, label: '30°'});
  packet({x: 960, y: 240}, {x: 1160, y: 460}, p, C.gold, {bend: -.2, label: '30°'});
  if (lt < b[2]) text('?', 960, 470, {size: 120, font: F.disp, weight: 700, color: C.coral, alpha: fade(lt, b[1] + .3, b[2])});
  const aT = fade(lt, b[2]);
  text('EPISODE 01', 960, 330, {size: 24, font: F.mono, weight: 700, color: C.gold, ls: 10, alpha: aT});
  text('The 1 ms problem', 960, 440 + 30 * (1 - aT), {size: 120, font: F.disp, weight: 700, alpha: aT, shadow: 'rgba(0,0,0,.6)'});
  text('1 毫秒的问题：为什么同步就是精度', 960, 545, {size: 44, font: F.zh, weight: 500, color: C.ink, alpha: aT});
  text('EtherCAT from Scratch · EtherCAT 从零读懂', 960, 615, {size: 28, color: C.dim, alpha: aT});
  chip('why does timing matter?  时间为什么要紧？', 960, 720, C.coral, eback(ramp(lt, b[3] + .2, b[3] + .8)), {size: 24});
};

/* ---------- 1. line ---------- */
SCN.line = (lt, b, d) => {
  const sh = [ramp(lt, b[1] - .2, b[1] + .5), ramp(lt, b[1] + .4, b[1] + 1.1), ramp(lt, b[1] + .9, b[1] + 1.6), ramp(lt, b[1] + 1.4, b[1] + 2.1)];
  sh[0] = Math.max(sh[0], ramp(lt, b[0] + .2, b[0] + .9) * 0 + ramp(lt, .3, 1));
  lineDiagram({show: sh, mid: () => { if (lt > b[6]) frameOnLine(((lt - b[6]) % 1.6) / 1.6, 3, C.gold, fade(lt, b[6])); }});
  // roles
  const aR = fade(lt, b[2], b[4]);
  text('sends commands', LN.xs[0], 600, {size: 26, color: C.gold, alpha: aR}); text('发命令', LN.xs[0], 636, {size: 22, font: F.zh, color: C.dim, alpha: aR});
  brace(LN.xs[1] - 125, LN.xs[3] + 125, 575, '', C.dim, aR, 1);
  text('obey and report', 1160, 640, {size: 26, color: C.ink, alpha: aR}); text('听命令、回数据', 1160, 676, {size: 22, font: F.zh, color: C.dim, alpha: aR});
  // what each slave is: little icons on top
  const aI = fade(lt, b[3]);
  const th = 20 * DEG * Math.sin(2 * Math.PI * .5 * Math.max(0, lt - b[6]));
  jointArm(LN.xs[2], 360, th, C.sky, aI); jointArm(LN.xs[3], 360, th, C.violet, aI);
  ctx.save(); ctx.globalAlpha *= aI; ctx.strokeStyle = C.dim; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const x = LN.xs[1] - 70 + i * 140 / 60, y = 345 - 22 * Math.sin(i / 60 * Math.PI * 3); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.restore();
  // real / simulated
  const aS = fade(lt, b[4]);
  chip('SOEM · real code 真实代码', LN.xs[0], 340, C.mint, eback(ramp(lt, b[4] + .3, b[4] + .9)), {size: 20});
  chip('simulated chips 模拟芯片', 1160, 640, C.violet, eback(ramp(lt, b[4] + 1.2, b[4] + 1.8)) * (1 - ramp(lt, b[6] - .5, b[6])), {size: 20});
  realTag(960, 760, eback(ramp(lt, b[5] + .2, b[5] + .8)) * (1 - ramp(lt, b[6] - .5, b[6])));
  // every 1 ms a frame with targets
  if (lt > b[6]) {
    chip('every 1 ms · 每 1 毫秒', LN.xs[0], 650, C.gold, eback(ramp(lt, b[6] + .3, b[6] + .9)), {size: 22});
  }
  // the slow wave both follow
  const aW = fade(lt, b[7]);
  if (aW > 0) {
    [[LN.xs[2], C.sky], [LN.xs[3], C.violet]].forEach(([x, c]) => {
      const x0 = x - 130, y0 = 700, w = 260;
      ctx.save(); ctx.globalAlpha *= aW * .5; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath();
      for (let i = 0; i <= 80; i++) { const u = i / 80, yy = y0 - 40 * Math.sin(2 * Math.PI * u); i ? ctx.lineTo(x0 + u * w, yy) : ctx.moveTo(x0 + u * w, yy); }
      ctx.stroke(); ctx.restore();
      const u = ((lt - b[6]) * .5) % 1;
      dot(x0 + u * w, y0 - 40 * Math.sin(2 * Math.PI * u), 10, c, aW);
    });
    text('same wave, same place  同一条曲线，同一个位置', 1360, 785, {size: 24, color: C.mint, alpha: aW});
  }
};

/* ---------- 2. error = speed × time ---------- */
SCN.error = (lt, b, d) => {
  // left: a joint sweeping; its ghost (where it should be) leads it by the lateness
  const aA = fade(lt, .3, b[2]);
  const px = 560, py = 560, L = 300, w = 0.6;
  const th = (t) => (20 + 60 * (.5 - .5 * Math.cos(w * t))) * DEG;
  const lag = .45 * ramp(lt, b[1] + .5, b[1] + 1.5);
  arm(px, py, L, th(lt), {ghost: true, color: C.gold, alpha: aA * ramp(lt, b[1], b[1] + .6), mass: 18});
  arm(px, py, L, th(lt - lag), {color: C.sky, alpha: aA, mass: 18, lw: 16});
  if (lag > .05) arcArrow(px, py, L + 50, th(lt - lag), th(lt), C.coral, {alpha: aA, lw: 5, head: 16});
  text('should be here  应在的位置', 380, 250, {size: 24, color: C.gold, alpha: aA * ramp(lt, b[1] + .4, b[1] + 1)});
  // the rule, built term by term
  const r1 = ramp(lt, b[1] + .3, b[1] + .9), r2 = ramp(lt, b[1] + 1.1, b[1] + 1.7), r3 = ramp(lt, b[1] + 1.9, b[1] + 2.5);
  const yE = lt < b[2] ? 470 : 250, xE = lt < b[2] ? 1300 : 960, sE = lt < b[2] ? 58 : 50;
  eq([['error', C.coral, r1], [' = ', C.dim, r2], ['speed', C.ink, r2], [' × ', C.dim, r3], ['lateness', C.coral, r3]], xE, yE, sE, {glow: true});
  text('误差 = 速度 × 晚了多久', xE, yE + 56, {size: 26, font: F.zh, color: C.dim, alpha: r3});
  // machine tool
  const aM = fade(lt, b[2], b[4]);
  card(960, 420, 1100, 110, 'F1000 = 1000 mm/min ≈ 16.7 mm/s', '机床进给 F1000', C.ink, aM, {size: 36});
  const m2 = ramp(lt, b[3], b[3] + .8);
  wipe(m2, 400, 500, 1200, 120, () => eq([['16.7 mm/s', C.ink], [' × ', C.dim], ['0.001 s', C.coral], [' ≈ ', C.dim], ['0.017 mm', C.coral]], 960, 560, 52, {glow: true, alpha: aM}));
  chip('≈ 17 µm', 960, 660, C.coral, eback(ramp(lt, b[3] + 1, b[3] + 1.6)) * aM, {size: 28});
  // robot joint
  const aJ = fade(lt, b[4], b[6]);
  card(960, 400, 1000, 100, '180°/s × 0.001 s = 0.18°', '关节每秒 180°，晚 1 毫秒', C.sky, aJ, {size: 38, tcolor: C.sky});
  const aK = fade(lt, b[5], b[6]);
  if (aK > 0) {
    // the arm tip: an arc of 0.18° shown magnified
    const cx = 760, cy = 700, R = 380;
    ctx.save(); ctx.globalAlpha *= aK; ctx.strokeStyle = C.sky; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R, cy - 60); ctx.stroke(); ctx.restore();
    dot(cx, cy, 10, C.ink, aK);
    text('0.5 m', cx + R / 2, cy + 6, {size: 26, font: F.mono, color: C.dim, alpha: aK});
    eq([['0.18°', C.sky], [' → ', C.dim], ['≈ 1.6 mm', C.coral], [' at the tip', C.dim]], 1380, 600, 46, {alpha: aK});
    text('手臂末端约 1.6 毫米', 1380, 660, {size: 26, font: F.zh, color: C.dim, alpha: aK});
  }
  const aF = fade(lt, b[6]);
  card(960, 470, 1200, 150, 'timing error = position error', '时间误差就是位置误差', C.coral, aF, {size: 52});
};

/* ---------- 3. two kinds of timing error ---------- */
SCN.two = (lt, b, d) => {
  const x0 = 520, w = 1100, span = 4;
  // skew: J1 on the beat, J2 always a bit after
  const aS = fade(lt, b[1], b[4] + 3);
  const beat = [0.5, 1.5, 2.5, 3.5];
  const top = lt < b[2] ? 1 : 0;
  const yS = 330;
  text('skew  偏差', 260, yS - 80, {size: 34, weight: 700, color: C.gold, align: 'left', alpha: Math.max(aS, fade(lt, b[0] + .3, b[4] + 3))});
  tickRow(x0, yS - 40, w, span, beat, C.sky, aS, {label: 'J1', prog: (lt - b[1]) * .8});
  tickRow(x0, yS + 40, w, span, beat.map(t => t + .22), C.violet, aS, {label: 'J2', prog: (lt - b[1] - .3) * .8});
  if (aS > 0) beat.forEach(t => { const xa = x0 + t / span * w, xb = x0 + (t + .22) / span * w;
    ctx.save(); ctx.globalAlpha *= aS * ramp(lt, b[1] + 1.5, b[1] + 2); ctx.fillStyle = rgba(C.gold, .25); ctx.fillRect(xa, yS - 66, xb - xa, 132); ctx.restore(); });
  // jitter: both together, but the beat itself wobbles
  const aJ = fade(lt, b[2], b[4] + 3);
  const jit = [0.5, 1.32, 2.61, 3.4];
  const yJ = 600;
  text('jitter  抖动', 260, yJ - 80, {size: 34, weight: 700, color: C.coral, align: 'left', alpha: Math.max(aJ, fade(lt, b[0] + .8, b[4] + 3))});
  tickRow(x0, yJ - 40, w, span, jit, C.sky, aJ, {label: 'J1', prog: (lt - b[2]) * .8});
  tickRow(x0, yJ + 40, w, span, jit, C.violet, aJ, {label: 'J2', prog: (lt - b[2] - .2) * .8});
  if (aJ > 0) beat.forEach((t, i) => { const x = x0 + t / span * w;
    ctx.save(); ctx.globalAlpha *= aJ * .6; ctx.setLineDash([6, 8]); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, yJ - 75); ctx.lineTo(x, yJ + 75); ctx.stroke(); ctx.restore(); });
  text('dashed = where the beat should be  虚线 = 节拍应在的位置', 1070, yJ + 110, {size: 22, color: C.dim, alpha: aJ * ramp(lt, b[2] + 2, b[2] + 2.6)});
  chip('joints disagree  关节之间对不上', 1350, yS - 80, C.gold, eback(ramp(lt, b[3], b[3] + .6)) * aS, {size: 22});
  chip('the motion stumbles  动作磕磕绊绊', 1350, yJ - 80, C.coral, eback(ramp(lt, b[4], b[4] + .6)) * aJ, {size: 22});
  // the band
  const aB = fade(lt, b[5]);
  if (aB > 0) {
    const cbeat = [0, .85, 2.15, 2.9, 4.05, 4.8];
    text('conductor 指挥', 330, 380, {size: 28, color: C.coral, align: 'left', alpha: aB});
    tickRow(560, 380, 1100, 5.2, cbeat, C.coral, aB, {prog: (lt - b[5]) * 1.2});
    ['band 乐队'].forEach(() => text('band 乐队', 330, 600, {size: 28, color: C.mint, align: 'left', alpha: aB}));
    for (let r = 0; r < 3; r++) tickRow(560, 540 + r * 60, 1100, 5.2, cbeat, C.mint, aB * .9, {prog: (lt - b[5] - .4) * 1.2});
    text('together with each other, all following a wobbling beat', 1110, 760, {size: 26, color: C.ink, alpha: aB * ramp(lt, b[5] + 2, b[5] + 2.6)});
  }
};

/* ---------- 4. CANopen ---------- */
SCN.canopen = (lt, b, d) => {
  const busY = 560, mx = 300, dxs = [800, 1150, 1500];
  const a = fade(lt, .2);
  // a CAN bus: one shared line, every node hangs off it
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = C.faint; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(220, busY); ctx.lineTo(1700, busY); ctx.stroke(); ctx.restore();
  text('CAN bus · one shared line  一条共享的总线', 960, busY + 40, {size: 22, color: C.dim, alpha: a});
  box(mx, 380, 230, 120, 'Master', '主站', C.gold, a, {size: 28});
  [[mx, 440]].concat(dxs.map(x => [x, 440])).forEach(([x]) => { ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = C.faint; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, 440); ctx.lineTo(x, busY); ctx.stroke(); ctx.restore(); });
  const colors = [C.sky, C.violet, C.mint];
  dxs.forEach((x, i) => box(x, 380, 220, 120, 'Drive ' + (i + 1), '驱动器 ' + (i + 1), colors[i], a, {size: 28}));
  // beat 0: one at a time — each drive starts when its own message lands
  const seq = lt < b[2];
  if (seq) dxs.forEach((x, i) => {
    const t0 = b[0] + 1 + i * 1.6;
    packet({x: mx, y: busY}, {x, y: busY}, ramp(lt, t0, t0 + 1), C.gold, {bend: .15});
    if (lt > t0 + 1) { pulse(x, 380, ramp(lt, t0 + 1, t0 + 1.8), colors[i]); text('moves', x, 260, {size: 24, color: colors[i], alpha: fade(lt, t0 + 1)}); }
  });
  if (lt > b[1] && lt < b[2]) {
    chip('skew 偏差: drive 1 moves first', 960, 700, C.gold, eback(ramp(lt, b[1] + .5, b[1] + 1.1)), {size: 24});
  }
  // beat 2..3: targets first, then one SYNC (0x80) to all
  if (lt >= b[2]) {
    dxs.forEach((x, i) => { const t0 = b[2] + .4 + i * .5; packet({x: mx, y: busY}, {x, y: busY}, ramp(lt, t0, t0 + .9), C.gold, {bend: .12, label: 'target'}); });
    const ts = b[2] + 3.5;
    if (lt > ts) {
      const k = ramp(lt, ts, ts + 1.2);
      ctx.save(); ctx.globalAlpha *= (1 - k) * .9; ctx.strokeStyle = C.mint; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(mx, busY); ctx.lineTo(lerp(mx, 1600, eo(k)), busY); ctx.stroke(); ctx.restore();
      chip('SYNC · ID 0x80', mx + 30, 690, C.mint, eback(ramp(lt, ts, ts + .6)) * (1 - ramp(lt, b[4] - .4, b[4])), {size: 24});
      if (lt > ts + 1.1) dxs.forEach((x, i) => pulse(x, 380, ramp(lt, ts + 1.1, ts + 1.9), colors[i]));
    }
  }
  if (lt > b[3] && lt < b[4]) chip('all at once: small skew  一起动：偏差很小', 1150, 700, C.mint, eback(ramp(lt, b[3] + .3, b[3] + .9)), {size: 24});
  // beat 4: the timer that sends SYNC wobbles
  const aT = fade(lt, b[4]);
  if (aT > 0) {
    const wob = Math.sin(lt * 7) * 8 * DEG;
    ringArc(mx, 230, 34, ((lt * .7) % 1), C.coral, 6, aT);
    ctx.save(); ctx.globalAlpha *= aT; ctx.strokeStyle = C.coral; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx, 230); ctx.lineTo(mx + 26 * Math.sin(wob + lt * 3), 230 - 26 * Math.cos(wob + lt * 3)); ctx.stroke(); ctx.restore();
    text('software timer  软件定时器', mx + 60, 230, {size: 24, color: C.coral, align: 'left', alpha: aT});
  }
  // beat 5: bus busy — SYNC waits behind a frame in progress
  const aB = fade(lt, b[5], b[7]);
  if (aB > 0) {
    const k = ramp(lt, b[5] + .5, b[5] + 3.5);
    ctx.save(); ctx.globalAlpha *= aB; rr(560, busY - 18, 900 * Math.min(1, k * 1.2), 36, 8); ctx.fillStyle = rgba(C.dim, .5); ctx.fill(); ctx.restore();
    text('a frame in progress: 8 bytes ≈ 0.1 ms at 1 Mbit/s', 1010, busY - 50, {size: 24, color: C.ink, alpha: aB});
    chip('SYNC waits 等待', mx + 130, busY - 50, C.coral, eback(ramp(lt, b[5] + 1, b[5] + 1.6)) * aB, {size: 22});
  }
  // beat 6: each drive adds an interrupt delay
  const aI = fade(lt, b[6], b[7] + 1);
  dxs.forEach((x, i) => { if (aI > 0) chip('+ interrupt 中断', x, 270, C.coral, eback(ramp(lt, b[6] + .3 + i * .3, b[6] + .9 + i * .3)) * aI, {size: 20}); });
  text('each drive adds its own delay  每个驱动器各添一段延迟', 1150, 210, {size: 22, color: C.dim, alpha: aI});
  // beat 7: verdict
  const aV = fade(lt, b[7]);
  card(700, 760, 520, 80, 'skew: fixed ✓  偏差：治了', '', C.mint, aV, {size: 30, tcolor: C.mint});
  card(1250, 760, 560, 80, 'jitter: not fixed ✗  抖动：没治', '', C.coral, aV, {size: 30, tcolor: C.coral});
};

/* ---------- 5. guess ---------- */
SCN.guess = (lt, b, d) => {
  const a = fade(lt, .2);
  const k = lt > b[0] + .5 ? (lt - b[0] - .5) % 1.4 / 1.4 : -1;
  lineDiagram({alpha: a, y: 400, mid: () => frameOnLine(k, 3, C.gold, a, 400)});
  // frames leave every 1.4 s of animation; the joints light on arrival
  if (k >= 0) {
    [1, 2, 3].forEach(i => { const ki = (LN.xs[i] - LN.xs[0] - LN.w / 2) / (LN.xs[3] - LN.xs[0] - LN.w / 2); if (i > 1) pulse(LN.xs[i], 400, (k - ki + 1) % 1 * 4, LCOL[i]); });
  }
  chip('act on arrival  到达即动作', 1360, 280, C.gold, eback(ramp(lt, b[0] + 1, b[0] + 1.6)), {size: 22});
  chip('target: every 1.000 ms  目标：每 1.000 毫秒', LN.xs[0], 540, C.gold, eback(ramp(lt, b[1] + .3, b[1] + .9)), {size: 22});
  const aQ = fade(lt, b[2]);
  card(960, 700, 1100, 130, 'How far from 1 ms will real cycles land?', '实际周期会偏离 1 毫秒多少？', C.coral, aQ, {size: 40});
};

/* ---------- 6. the real run ---------- */
SCN.run = (lt, b, d) => {
  const H0 = D.frame.hist, maxH = Math.max(...H0);
  const gx = 360, gy = 720, gw = 1200, gh = 380, n = H0.length;
  const aH = fade(lt, .2, b[5]);
  // a strip of the first 40 real cycles: where each act landed vs the 1 ms grid
  const aS = fade(lt, .3, b[2]);
  if (aS > 0) {
    let t = 0; const ts = D.frame.strip.slice(0, 16).map(p => (t += p / 1000));
    const span = 16.5;
    for (let i = 1; i <= 16; i++) { const x = gx + i / span * gw; ctx.save(); ctx.globalAlpha *= aS * .5; ctx.setLineDash([5, 7]); ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 200); ctx.lineTo(x, 280); ctx.stroke(); ctx.restore(); }
    tickRow(gx, 240, gw, span, ts, C.sky, aS, {label: 'J1', prog: (lt - .3) * 1.5});
    text('first 16 real cycles · dashed = exact 1 ms grid   前 16 个真实周期 · 虚线 = 准确的 1 毫秒', 960, 312, {size: 20, color: C.dim, alpha: aS});
  }
  // histogram of every measured period
  const grow = eo(ramp(lt, b[0] + .3, b[0] + 2));
  if (aH > 0) {
    axes(gx, gy, gw + 20, gh - 20, {alpha: aH});
    for (let i = 0; i < n; i++) {
      const v = H0[i] / maxH, h = Math.max(v > 0 ? 3 : 0, Math.sqrt(v) * (gh - 60)) * grow, x = gx + 10 + i * gw / n;
      const lo = D.frame.lo + i * D.frame.w, tail = lo < 900 || lo >= 1100;
      const c = tail && lt > b[1] ? C.coral : C.sky;
      ctx.save(); ctx.globalAlpha *= aH; ctx.fillStyle = rgba(c, .85); ctx.fillRect(x, gy - h, gw / n - 4, h); ctx.restore();
    }
    [400, 600, 800, 1000, 1200, 1400].forEach(us => text(us + ' µs', gx + 10 + (us - D.frame.lo) / D.frame.w * gw / n, gy + 32, {size: 20, font: F.mono, color: C.dim, alpha: aH}));
    text('cycle length · 周期长度', gx + gw / 2, gy + 70, {size: 22, color: C.dim, alpha: aH});
    text('count (√ scale) 次数', gx + 20, gy - gh + 10, {size: 20, color: C.dim, align: 'left', alpha: aH});
    realTag(1560, 380, aH);
    if (D.frame.out) text(`+ ${D.frame.out} cycles off the chart  另有 ${D.frame.out} 个周期超出图表范围`, 1560, 490, {size: 20, color: C.coral, alpha: aH * ramp(lt, b[1], b[1] + .6)});
    text(`${D.frame.n} cycles · shortest ${D.frame.min_us} µs · longest ${D.frame.max_us} µs`, 1560, 420, {size: 20, font: F.mono, color: C.dim, align: 'center', alpha: aH * ramp(lt, b[1], b[1] + .6)});
    // spread
    const aSD = fade(lt, b[2]);
    const c0 = gx + 10 + (1000 - D.frame.lo) / D.frame.w * gw / n, sdw = D.frame.sd_us / D.frame.w * gw / n;
    brace(c0 - sdw, c0 + sdw, gy - gh + 40, `σ = ${D.frame.sd_us} µs (this run)`, C.coral, aSD, -1);
    text(`runs: σ = ${D.frame.sd_all_us.join(' / ')} µs`, 1560, 455, {size: 20, font: F.mono, color: C.coral, alpha: aSD});
    chip('master = ordinary Mac  主站是一台普通 Mac', 1450, 545, C.gold, eback(ramp(lt, b[3] + .2, b[3] + .8)) * aH, {size: 20});
    chip('real-time OS: smaller, never 0  实时系统：更小，但不为零', 1450, 600, C.mint, eback(ramp(lt, b[4] + .2, b[4] + .8)) * aH, {size: 20});
  }
  // J1 vs J2: one frame passes J1, then J2
  const aJ = fade(lt, b[5], b[8]);
  if (aJ > 0) {
    const k = ((lt - b[5]) % 2.2) / 2.2;
    lineDiagram({alpha: aJ, y: 330, mid: () => frameOnLine(k, 3, C.gold, aJ, 330)});
        ctx.save(); ctx.globalAlpha *= aJ; ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(460, 600); ctx.lineTo(1460, 600); ctx.stroke(); ctx.restore();
    tickRow(460, 560, 1000, 1250, [100], C.sky, aJ, {label: 'J1'});
    tickRow(460, 640, 1000, 1250, [100 + D.frame.skew_ns], C.violet, aJ, {label: 'J2'});
    brace(460 + 100 / 1250 * 1000, 460 + (100 + D.frame.skew_ns) / 1250 * 1000, 700, `${D.frame.skew_ns} ns, every cycle  每个周期都一样`, C.gold, aJ * ramp(lt, b[5] + .8, b[5] + 1.4), 1);
    simTag(1560, 600, aJ * ramp(lt, b[6], b[6] + .6));
    text('= simulated cable 5 ns + chip 305 ns (ET1100 datasheet)  模拟：网线 + 芯片延迟（取自 ET1100 数据手册）', 960, 815, {size: 20, color: C.violet, alpha: aJ * ramp(lt, b[6], b[6] + .6)});
    chip('→ Episode 3  第 3 集', 1560, 680, C.mint, eback(ramp(lt, b[7] + .2, b[7] + .8)) * aJ, {size: 20});
  }
  // jitter goes to the motors
  const aM = fade(lt, b[8]);
  if (aM > 0) {
    const px = 620, py = 640, L = 360, th = 40 * DEG, lag = 6 * DEG * ramp(lt, b[8] + .8, b[8] + 1.8);
    arm(px, py, L, th, {ghost: true, color: C.gold, alpha: aM, mass: 16});
    arm(px, py, L, th - lag, {color: C.sky, alpha: aM, mass: 16, lw: 14});
    arcArrow(px, py, L + 40, th - lag, th, C.coral, {alpha: aM * ramp(lt, b[8] + 1, b[8] + 1.6), lw: 5});
    text('angle exaggerated  角度放大示意', px + 160, py + 50, {size: 20, color: C.dim, alpha: aM});
    const aC = ramp(lt, b[9] + .2, b[9] + 1);
    eq([['180°/s', C.sky], [' × ', C.dim], ['0.2 ms', C.coral], [' = ', C.dim], ['0.036°', C.coral]], 1340, 420, 50, {alpha: aC, glow: true});
    eq([['0.036°', C.coral], [' at 0.5 m ', C.dim], ['≈ 0.3 mm', C.coral]], 1340, 520, 44, {alpha: ramp(lt, b[9] + 1.5, b[9] + 2.3)});
    text('手臂末端约 0.3 毫米', 1340, 580, {size: 26, font: F.zh, color: C.dim, alpha: ramp(lt, b[9] + 1.5, b[9] + 2.3)});
  }
};

/* ---------- 7. what EtherCAT does instead ---------- */
function clockFace(x, y, r, t, color, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = C.panel; ctx.strokeStyle = color; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const an = t * Math.PI * 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r * .75 * Math.sin(an), y - r * .75 * Math.cos(an)); ctx.stroke();
  ctx.restore();
}
SCN.dc = (lt, b, d) => {
  const aL = fade(lt, .2, b[6]);
  const kF = lt > b[4] ? ((lt - b[4]) * .7) % 1 : -1, jF = .12 * Math.sin(Math.floor((lt - b[4]) * .7) * 2.3);
  lineDiagram({alpha: aL, y: 400, mid: () => { if (kF >= 0) frameOnLine(clamp(kF * 1.6 + jF, 0, .999), 3, C.coral, aL, 400); }});
  // clocks on every slave, all at the same phase
  const ph = ((lt - b[1]) * .7) % 1;
  [1, 2, 3].forEach(i => clockFace(LN.xs[i], 250, 34, ph, C.mint, aL * ramp(lt, b[1] + .2 + i * .25, b[1] + .8 + i * .25)));
  chip('Distributed Clock · DC  分布式时钟', 1160, 160 + 20, C.mint, eback(ramp(lt, b[2] + .2, b[2] + .8)) * aL, {size: 22});
  // SYNC0: every slave pulses together on the clock's tick
  if (lt > b[3] && lt < b[6]) {
    const k = ((lt - b[3]) * .7) % 1;
    [2, 3].forEach(i => pulse(LN.xs[i], 400, k * 2.2, C.mint));
    if (k < .12) text('SYNC0', 1360, 560, {size: 34, font: F.mono, weight: 700, color: C.mint, alpha: aL});
  }
  // frames from the wobbling master arrive at uneven times — but before SYNC0
  if (lt > b[4]) {
    chip('frame: any time before SYNC0  帧只要在 SYNC0 之前到', 960, 600, C.coral, eback(ramp(lt, b[4] + .3, b[4] + .9)) * aL, {size: 22});
  }
  chip('master still wobbles  主站照样在晃', LN.xs[0], 560, C.gold, eback(ramp(lt, b[5] + .2, b[5] + .8)) * aL, {size: 20});
  // the comparison: period spread, log scale
  const aC = fade(lt, b[6]);
  if (aC > 0) {
    realTag(1640, 250, aC);
    const x0 = 460, y1 = 340, y2 = 480, maxW = 1100, lg = v => Math.log10(v) / Math.log10(100000) * maxW; // 1 ns .. 100 µs
    const fsd = D.frame.sd_us * 1000, dsd = D.dc.sd_ns;
    const g1 = eo(ramp(lt, b[6] + .2, b[6] + 1.4)), g2 = eo(ramp(lt, b[6] + 1, b[6] + 2.2));
    text('act on frame', x0 - 30, y1 - 16, {size: 26, weight: 600, color: C.coral, align: 'right', alpha: aC});
    text('到达即动作', x0 - 30, y1 + 18, {size: 20, font: F.zh, color: C.dim, align: 'right', alpha: aC});
    text('SYNC0 (DC)', x0 - 30, y2 - 16, {size: 26, weight: 600, color: C.mint, align: 'right', alpha: aC});
    text('分布式时钟', x0 - 30, y2 + 18, {size: 20, font: F.zh, color: C.dim, align: 'right', alpha: aC});
    ctx.save(); ctx.globalAlpha *= aC;
    rr(x0, y1 - 30, lg(fsd) * g1, 60, 10); ctx.fillStyle = rgba(C.coral, .8); ctx.fill();
    rr(x0, y2 - 30, Math.max(8, lg(dsd)) * g2, 60, 10); ctx.fillStyle = rgba(C.mint, .9); ctx.fill();
    ctx.restore();
    text(`σ = ${D.frame.sd_us} µs`, x0 + lg(fsd) * g1 + 20, y1, {size: 30, font: F.mono, weight: 700, color: C.coral, align: 'left', alpha: aC * g1});
    text(`σ = ${D.dc.sd_ns} ns`, x0 + Math.max(8, lg(dsd)) * g2 + 20, y2, {size: 30, font: F.mono, weight: 700, color: C.mint, align: 'left', alpha: aC * g2});
    ['1 ns', '10 ns', '100 ns', '1 µs', '10 µs', '100 µs'].forEach((s, i) => { const x = x0 + i / 5 * maxW;
      ctx.save(); ctx.globalAlpha *= aC * .5; ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y1 - 60); ctx.lineTo(x, y2 + 50); ctx.stroke(); ctx.restore();
      text(s, x, y2 + 80, {size: 20, font: F.mono, color: C.dim, alpha: aC}); });
    text('period spread, log scale  周期离散（对数刻度）', x0 + maxW / 2, y2 + 118, {size: 22, color: C.dim, alpha: aC});
    chip(`J1 ↔ J2 once settled: ≤ ${D.dc.settled_skew_ns} ns  稳定后相差`, 700, 700, C.mint, eback(ramp(lt, b[7] + .2, b[7] + .8)) * aC, {size: 22});
    chip('≈ 10,000× tighter  收紧约一万倍', 1300, 700, C.gold, eback(ramp(lt, b[8] + .2, b[8] + .8)) * aC, {size: 26});
    simTag(1300, 770, aC * ramp(lt, b[9], b[9] + .6));
    text('settling speed: our chip model  稳定速度来自模拟芯片模型', 1300, 812, {size: 20, color: C.violet, alpha: aC * ramp(lt, b[9], b[9] + .6)});
  }
};

/* ---------- 8. roadmap ---------- */
SCN.road = (lt, b, d) => {
  const items = [
    ['One cable is already a ring', '一根网线就是一个环', 'Episode 2', C.sky],
    ['One frame, never stopped', '一帧走到底，边走边处理', 'Episode 3', C.gold],
    ['Startup: who sends what', '启动：谁收发哪些数据', 'Episode 4', C.violet],
    ['Clocks agree to nanoseconds', '时钟对齐到纳秒', 'Episode 5', C.mint],
  ];
  text('four questions  四个问题', 960, 220, {size: 34, weight: 600, color: C.dim, alpha: fade(lt, .3)});
  items.forEach(([en, zh, ep, c], i) => {
    const a = eback(ramp(lt, b[i + 1], b[i + 1] + .6)), y = 330 + i * 120;
    if (a <= 0) return;
    ctx.save(); ctx.translate(0, (1 - a) * 30);
    panel(960, y, 1100, 96, {alpha: Math.min(1, a), edge: rgba(c, .7), lw: 2.5});
    text(ep, 520, y, {size: 26, font: F.mono, weight: 700, color: c, align: 'left', alpha: Math.min(1, a)});
    text(en, 760, y - 14, {size: 32, weight: 600, align: 'left', alpha: Math.min(1, a)});
    text(zh, 760, y + 22, {size: 22, font: F.zh, color: C.dim, align: 'left', alpha: Math.min(1, a)});
    ctx.restore();
  });
};

/* ---------- 9. recap ---------- */
SCN.recap = (lt, b, d) => {
  const items = [
    ['timing error = position error', '时间误差就是位置误差：速度 × 时间', C.coral],
    ['skew ≠ jitter', '偏差在关节之间，抖动是节拍本身', C.gold],
    ['act on arrival → inherit jitter; a shared clock removes it', '收到就动作会继承抖动；共享时钟才能去掉它', C.mint],
  ];
  items.forEach(([en, zh, c], i) => {
    const a = eo(ramp(lt, b[i] + .2, b[i] + .8)), y = 330 + i * 150;
    if (a <= 0) return;
    panel(960, y, 1300, 120, {alpha: a, edge: rgba(c, .6)});
    text(String(i + 1).padStart(2, '0'), 380, y, {size: 30, font: F.mono, weight: 700, color: c, alpha: a});
    text(en, 450, y - 18, {size: 34, weight: 600, align: 'left', alpha: a});
    text(zh, 450, y + 24, {size: 24, font: F.zh, color: C.dim, align: 'left', alpha: a});
  });
};

/* ---------- 10. your turn ---------- */
SCN.turn = (lt, b, d) => {
  text('YOUR TURN  你来算', 960, 220, {size: 26, font: F.mono, weight: 700, color: C.gold, ls: 6, alpha: fade(lt, .2)});
  const a1 = fade(lt, b[0] + .2, b[3]);
  eq([['90°/s', C.sky], [' × ', C.dim], ['0.3 ms', C.coral], [' = ', C.dim], ['?', C.gold, 1 - ramp(lt, b[2], b[2] + .4)]], 960, 420, 72, {alpha: a1, glow: true});
  const a2 = ramp(lt, b[2], b[2] + .8) * (1 - ramp(lt, b[3] - .5, b[3]));
  eq([['90°/s', C.sky], [' × ', C.dim], ['0.0003 s', C.coral], [' = ', C.dim], ['0.027°', C.gold]], 960, 560, 60, {alpha: a2, glow: true});
  const a3 = fade(lt, b[3]);
  if (a3 > 0) {
    text('Next · 下一集', 960, 330, {size: 26, font: F.mono, weight: 700, color: C.dim, alpha: a3});
    text('One cable is already a ring', 960, 430, {size: 64, font: F.disp, weight: 700, alpha: a3});
    text('一根网线就是一个环', 960, 510, {size: 34, font: F.zh, color: C.dim, alpha: a3});
    // a cable that is secretly two lanes
    ctx.save(); ctx.globalAlpha *= a3; ctx.lineCap = 'round';
    ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(560, 620); ctx.lineTo(1360, 620); ctx.stroke();
    ctx.strokeStyle = C.sky; ctx.beginPath(); ctx.moveTo(560, 650); ctx.lineTo(1360, 650); ctx.stroke(); ctx.restore();
    arrow({x: 900, y: 620}, {x: 1000, y: 620}, C.gold, {alpha: a3}); arrow({x: 1000, y: 650}, {x: 900, y: 650}, C.sky, {alpha: a3});
  }
};

// filled by build.py with every Chinese character in this file (so the font subset loads them)
const EXTRA_ZH = '__AUTO__';
