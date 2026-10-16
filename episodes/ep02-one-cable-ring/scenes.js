/* =========================================================
   Episode 2 — One cable is already a ring. One scene per id in script.json; numbers from ep02_data.js (D):
   vwire/runs.sh (SOEM scanning vwire:chain3, intact and cut after J1) and soem/ lines cut by data.py.
   Colour legend (this episode):
     gold  = the outgoing lane, and the frame on it      sky   = the return lane, and the frame on it
     coral = a closed port, a cut cable, the question     mint  = real-run results
     violet = simulated quantities                        dim   = neutral
   Canvas 1920×1080; content between y≈170 and y≈830.
   ========================================================= */
const SCN = {};

/* ---------- episode helpers ---------- */
const fade = (lt, t0, t1, d = .6) => eo(ramp(lt, t0, t0 + d)) * (t1 == null ? 1 : 1 - ramp(lt, t1 - .5, t1));
function card(x, y, w, h, en, zh, color, a = 1, o = {}) {
  if (a <= 0) return;
  panel(x, y, w, h, {alpha: a, fill: C.panel, edge: rgba(color, .7), lw: 2.5});
  text(en, x, y - (zh ? 18 : 0), {size: o.size || 34, weight: 600, color: o.tcolor || C.ink, alpha: a});
  if (zh) text(zh, x, y + 26, {size: (o.size || 34) * .7, font: F.zh, color: C.dim, alpha: a});
}
function simTag(x, y, a) { chip('模拟 · simulated', x, y, C.violet, a, {size: 18}); }
function realTag(x, y, a) { chip('真实运行 · real run', x, y, C.mint, a, {size: 18}); }
function line(x0, y0, x1, y1, color, lw, a = 1, dash) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
}
function boxShape(x, y, w, h, color, a, o = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; glow(x, y, Math.max(w, h) * .6, color, o.glowA ?? .1);
  rr(x - w / 2, y - h / 2, w, h, 16); ctx.fillStyle = o.fill || C.panel2; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = rgba(color, .85); ctx.stroke(); ctx.restore();
}
const P0 = D.scan.path, P2 = D.break2.path;

/* ---------- the running example, every cable drawn as two lanes ---------- */
const RL = {y: 480, xs: [250, 700, 1130, 1560], mw: 200, sw: 300, h: 250, dy: 30};
const YO = RL.y - RL.dy, YR = RL.y + RL.dy;
const LCOL = [C.gold, C.dim, C.sky, C.violet];
const LNAME = [['Master', '主站'], ['Slave 1 · AI card', '从站 1 · 采集卡'], ['Slave 2 · J1', '从站 2 · 关节 J1'], ['Slave 3 · J2', '从站 3 · 关节 J2']];
const edgeL = i => RL.xs[i] - (i ? RL.sw : RL.mw) / 2, edgeR = i => RL.xs[i] + (i ? RL.sw : RL.mw) / 2;
// o: alpha, n (slaves reached; the n-th turns the frame round), lanes (0..1), single (0..1, one plain cable),
//    show [4] (build-up), cut (cable after slave n is cut), mid (drawn under the boxes), noPU
function ringLine(o = {}) {
  const a = o.alpha ?? 1, n = o.n ?? 3, ln = o.lanes ?? 1, sg = o.single ?? 0, sh = o.show ?? [1, 1, 1, 1];
  for (let i = 0; i < 3; i++) {
    const k = Math.min(sh[i], sh[i + 1]); if (k <= 0) continue;
    const x0 = edgeR(i), x1 = edgeL(i + 1), xe = lerp(x0, x1, eo(k));
    if (o.cut && i === n) {
      const m = x1 - 24;
      line(x0, RL.y, m - 26, RL.y, C.faint, 6, a); line(m + 26, RL.y, x1, RL.y, C.faint, 6, a * .5);
      cross(m, RL.y, 16, C.coral, 6, a); continue;
    }
    const aa = i >= n ? .35 : 1;
    line(x0, RL.y, xe, RL.y, C.faint, 8, a * sg * aa);
    if (ln > 0) {
      line(x0, YO, xe, YO, C.gold, 5, a * ln * aa); line(x0, YR, xe, YR, C.sky, 5, a * ln * aa);
      if (k >= 1) { const m = (x0 + x1) / 2;
        arrow({x: m - 14, y: YO}, {x: m + 16, y: YO}, C.gold, {alpha: a * ln * aa, lw: 5, head: 16});
        arrow({x: m + 14, y: YR}, {x: m - 16, y: YR}, C.sky, {alpha: a * ln * aa, lw: 5, head: 16}); }
    }
  }
  if (o.mid) o.mid();
  // master
  const am = a * eo(sh[0]);
  boxShape(RL.xs[0], RL.y, RL.mw, RL.h, C.gold, am);
  text('Master', RL.xs[0], RL.y - 90, {size: 26, weight: 600, alpha: am});
  text('主站', RL.xs[0], RL.y - 62, {size: 20, font: F.zh, color: C.dim, alpha: am});
  text('TX', edgeR(0) - 34, YO, {size: 18, font: F.mono, weight: 700, color: C.gold, alpha: am * ln});
  text('RX', edgeR(0) - 34, YR, {size: 18, font: F.mono, weight: 700, color: C.sky, alpha: am * ln});
  text('1 port · 1 个网口', RL.xs[0], RL.y + 92, {size: 18, color: C.dim, alpha: am * ln});
  // slaves
  for (let i = 1; i <= 3; i++) {
    const as = a * eo(sh[i]) * (i > n ? .35 : 1); if (as <= 0) continue;
    const x = RL.xs[i], L = edgeL(i), R = edgeR(i), closed = i === n;
    boxShape(x, RL.y, RL.sw, RL.h, LCOL[i], as);
    text(LNAME[i][0], x, RL.y - 92, {size: 24, weight: 600, alpha: as});
    text(LNAME[i][1], x, RL.y - 64, {size: 18, font: F.zh, color: C.dim, alpha: as});
    // ports
    ctx.save(); ctx.globalAlpha *= as; ctx.fillStyle = C.panel; ctx.lineWidth = 3;
    rr(L - 11, RL.y - 52, 22, 104, 6); ctx.fill(); ctx.strokeStyle = C.dim; ctx.stroke();
    rr(R - 11, RL.y - 52, 22, 104, 6); ctx.fill(); ctx.strokeStyle = closed && i <= n ? C.coral : C.dim; ctx.stroke(); ctx.restore();
    text('0 IN', L + 44, RL.y + 94, {size: 18, font: F.mono, weight: 700, color: C.dim, alpha: as});
    text('1 OUT', R - 50, RL.y + 94, {size: 18, font: F.mono, weight: 700, color: closed ? C.coral : C.dim, alpha: as});
    if (closed && (o.closedLabel ?? 1) > 0) {
      text('closed', R + 18, RL.y - 14, {size: 20, weight: 700, color: C.coral, align: 'left', alpha: as * (o.closedLabel ?? 1)});
      text('关闭', R + 18, RL.y + 14, {size: 18, font: F.zh, color: C.coral, align: 'left', alpha: as * (o.closedLabel ?? 1)});
    }
    // inside: outgoing lane through the processing unit, return lane straight; a U-turn at a closed port 1
    if (ln > 0 && i <= n) {
      const al = as * ln;
      line(L, YO, x - 55, YO, C.gold, 4, al);
      if (!closed) { line(x + 55, YO, R, YO, C.gold, 4, al); line(R, YR, L, YR, C.sky, 4, al); }
      else {
        line(x + 55, YO, R - 40, YO, C.gold, 4, al);
        ctx.save(); ctx.globalAlpha *= al; ctx.lineWidth = 4; const g = ctx.createLinearGradient(0, YO, 0, YR); g.addColorStop(0, C.gold); g.addColorStop(1, C.sky);
        ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(R - 40, RL.y, RL.dy, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.restore();
        line(R - 40, YR, L, YR, C.sky, 4, al);
      }
      if (!o.noPU) { ctx.save(); ctx.globalAlpha *= al; rr(x - 55, YO - 20, 110, 40, 8); ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
        text('PU', x, YO + 1, {size: 18, font: F.mono, weight: 700, color: C.gold, alpha: al}); }
    }
  }
}
// waypoints {t ns, x, y} of the frame's first bit, built from a real path (per slave: in0, pu, in1, out0)
function pathPts(P, n, rtt) {
  const pts = [{t: 0, x: edgeR(0), y: YO}];
  for (let i = 1; i <= n; i++) {
    const L = edgeL(i), R = edgeR(i), X = RL.xs[i];
    pts.push({t: P[i].in0_ns, x: L, y: YO}, {t: P[i].pu_ns, x: X - 55, y: YO});
    if (i < n) { const cab = P[i].in1_ns - P[i + 1].out0_ns; pts.push({t: P[i + 1].in0_ns - cab, x: R, y: YO}); }
    else {
      const t0 = P[i].pu_ns, t1 = P[i].out0_ns;
      pts.push({t: lerp(t0, t1, .3), x: R - 40, y: YO});
      for (let k = 1; k <= 8; k++) { const an = -Math.PI / 2 + Math.PI * k / 8; pts.push({t: lerp(t0, t1, .3 + .25 * k / 8), x: R - 40 + RL.dy * Math.cos(an), y: RL.y + RL.dy * Math.sin(an)}); }
      pts.push({t: t1, x: L, y: YR});
    }
  }
  for (let i = n - 1; i >= 1; i--) pts.push({t: P[i].in1_ns, x: edgeR(i), y: YR}, {t: P[i].out0_ns, x: edgeL(i), y: YR});
  pts.push({t: rtt, x: edgeR(0), y: YR});
  return pts;
}
function posAt(pts, t) {
  if (t <= pts[0].t) return pts[0];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i].t) { const a = pts[i - 1], b = pts[i], u = (t - a.t) / Math.max(1e-9, b.t - a.t); return {x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u)}; }
  return pts[pts.length - 1];
}
const laneCol = y => y <= YO + 1 ? C.gold : y >= YR - 1 ? C.sky : mixHex(C.gold, C.sky, (y - YO) / (YR - YO));
function trail(pts, t, a = 1, map) {
  if (a <= 0 || t <= 0) return;
  const P = map || (q => q);
  ctx.save(); ctx.globalAlpha *= a * .9; ctx.lineWidth = 9; ctx.lineCap = 'round';
  for (let i = 1; i < pts.length && pts[i - 1].t < t; i++) {
    const p = P(pts[i - 1], pts[i - 1].t), q = P(t < pts[i].t ? {...posAt(pts, t)} : pts[i], Math.min(t, pts[i].t));
    ctx.strokeStyle = laneCol(pts[i].y); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  ctx.restore();
}
function head(pts, t, a = 1) { if (a <= 0 || t < 0) return; const q = posAt(pts, t); dot(q.x, q.y, 11, laneCol(q.y), a); }
const PTS = pathPts(P0, 3, D.scan.rtt[0]), PTS2 = pathPts(P2, 2, D.break2.rtt[0]);

/* ---------- 0. intro ---------- */
SCN.intro = (lt, b, d) => {
  const sh = [0, 1, 2, 3].map(i => ramp(lt, .3 + i * .45, 1 + i * .45));
  const aL = 1 - .75 * ramp(lt, b[3] - .3, b[3] + .4);
  ringLine({alpha: aL, single: 1, lanes: 0, show: sh, closedLabel: 0, mid: () => {
    if (lt > b[0] + 2.5 && lt < b[1]) { const k = ((lt - b[0] - 2.5) % 2.4) / 2.4; const x = lerp(edgeR(0), RL.xs[3], k); dot(x, RL.y, 11, C.gold, fade(lt, b[0] + 2.5, b[1])); }
  }});
  // what people picture: a ring around the devices
  const aR = fade(lt, b[1], b[2] + 1.5);
  if (aR > 0) {
    const k = eio(ramp(lt, b[1] + .3, b[1] + 2.3));
    ctx.save(); ctx.globalAlpha *= aR; ctx.setLineDash([14, 12]); ctx.strokeStyle = C.coral; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(905, RL.y, 860, 230, 0, Math.PI, Math.PI + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
    chip('what people picture  大家想象中的环', 905, 225, C.coral, eback(ramp(lt, b[1] + 1.5, b[1] + 2.1)) * aR, {size: 22});
  }
  // the end of the line: nothing plugged in
  const aE = fade(lt, b[2], b[3]);
  if (aE > 0) {
    pulse(edgeR(3), RL.y, ((lt - b[2]) % 1.6) / 1.6, C.coral, 20, 70);
    text('nothing here', edgeR(3) + 10, RL.y - 180, {size: 24, weight: 600, color: C.coral, align: 'right', alpha: aE});
    text('什么也没接', edgeR(3) + 10, RL.y - 150, {size: 20, font: F.zh, color: C.coral, align: 'right', alpha: aE});
    brace(edgeL(1), edgeR(3), RL.y + 150, '', C.dim, aE * ramp(lt, b[2] + 1.5, b[2] + 2), 1);
    text('a line, not a ring  一条线，不是环', 960, RL.y + 250, {size: 26, color: C.ink, alpha: aE * ramp(lt, b[2] + 2, b[2] + 2.6)});
  }
  const aT = fade(lt, b[3]);
  text('EPISODE 02', 960, 340, {size: 24, font: F.mono, weight: 700, color: C.gold, ls: 10, alpha: aT});
  text('One cable is already a ring', 960, 440 + 30 * (1 - aT), {size: 104, font: F.disp, weight: 700, alpha: aT, shadow: 'rgba(0,0,0,.6)'});
  text('一根网线就是一个环', 960, 545, {size: 46, font: F.zh, weight: 500, alpha: aT});
  text('EtherCAT from Scratch · EtherCAT 从零读懂', 960, 615, {size: 28, color: C.dim, alpha: aT});
  chip('where is the ring?  环在哪里？', 960, 720, C.coral, eback(ramp(lt, b[3] + .8, b[3] + 1.4)), {size: 24});
};

/* ---------- 1. inside the cable ---------- */
function twisted(x0, x1, y, c1, c2, a, ph = 0, amp = 9) {
  if (a <= 0) return;
  [[c1, 0], [c2, Math.PI]].forEach(([c, o]) => {
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const x = lerp(x0, x1, i / 120), yy = y + amp * Math.sin(i / 120 * Math.PI * 14 + o + ph); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke(); ctx.restore();
  });
}
SCN.cable = (lt, b, d) => {
  const aC = fade(lt, .2, b[4]);
  // the plug face: 8 pins
  const px = 420, pins = [0, 1, 2, 3, 4, 5, 6, 7].map(i => 290 + i * 52);
  panel(px, 472, 150, 460, {alpha: aC, fill: C.panel2, edge: C.dim, lw: 2.5});
  text('RJ45', px, 225, {size: 22, font: F.mono, weight: 700, color: C.dim, alpha: aC});
  // pairs: (1,2) sends, (3,6) receives, (4,5) and (7,8) unused at 100 Mbit/s
  const pairs = [[[0, 1], 330, C.gold, 'pins 1-2', 'sends  发'], [[2, 5], 450, C.sky, 'pins 3-6', 'receives  收'], [[3, 4], 570, C.dim, 'pins 4-5', ''], [[6, 7], 690, C.dim, 'pins 7-8', '']];
  const used = ramp(lt, b[1] + .5, b[1] + 1.5), roles = ramp(lt, b[2], b[2] + .8);
  pairs.forEach(([pp, y, c, nm, role], j) => {
    const k = eo(ramp(lt, .5 + j * .4, 1.3 + j * .4)), unused = j >= 2;
    const aa = aC * k * (unused ? 1 - .7 * used : 1), col = j < 2 ? mixHex(C.ink, c, roles) : C.dim;
    pp.forEach(p => {
      ctx.save(); ctx.globalAlpha *= aa; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath();
      ctx.moveTo(px + 50, pins[p]); ctx.bezierCurveTo(px + 160, pins[p], px + 160, y, 700, y); ctx.stroke(); ctx.restore();
      dot(px + 40, pins[p], 7, col, aa); text(String(p + 1), px - 30, pins[p], {size: 22, font: F.mono, weight: 700, color: col, alpha: aa});
    });
    twisted(700, 700 + 700 * k, y, col, mixHex(col, C.bg, .4), aa, unused ? 0 : lt * 1.5 * (j ? -1 : 1));
    text(nm, 1430, y, {size: 22, font: F.mono, color: col, align: 'left', alpha: aa});
    if (unused) text('unused at 100 Mbit/s  不用', 1430, y + 30, {size: 18, color: C.dim, align: 'left', alpha: aC * used});
    else text(role, 1430, y + 32, {size: 22, weight: 700, color: c, align: 'left', alpha: aC * roles});
  });
  text('8 wires · 4 twisted pairs  8 根线 · 4 对双绞线', 1050, 240, {size: 24, color: C.ink, alpha: aC * ramp(lt, b[0] + 1.5, b[0] + 2.1)});
  chip('100 Mbit/s: 2 pairs  只用 2 对', 1050, 780, C.gold, eback(ramp(lt, b[1] + .3, b[1] + .9)) * aC * (1 - ramp(lt, b[3] - .4, b[3])), {size: 22});
  // traffic on both pairs at once
  if (lt > b[2] + .8) {
    for (let k = 0; k < 3; k++) {
      const u = ((lt - b[2] - .8) * .35 + k / 3) % 1;
      dot(lerp(720, 1390, u), 330, 9, C.gold, aC); dot(lerp(1390, 720, u), 450, 9, C.sky, aC);
    }
  }
  chip('full duplex: both at once  全双工：同时工作', 1050, 780, C.mint, eback(ramp(lt, b[3] + .2, b[3] + .8)) * aC * (1 - ramp(lt, b[3], b[3] + .1) * 0), {size: 22});
  // the two-lane road
  const aR = fade(lt, b[4]);
  if (aR > 0) {
    const y0 = 470;
    panel(960, y0, 1400, 220, {alpha: aR, fill: '#1E2638', edge: C.faint, r: 10});
    line(270, y0, 1650, y0, C.ink, 4, aR * .6, [30, 24]);
    for (let k = 0; k < 4; k++) {
      const u = ((lt - b[4]) * .18 + k / 4) % 1, v = ((lt - b[4]) * .22 + k / 4 + .1) % 1;
      ctx.save(); ctx.globalAlpha *= aR;
      rr(lerp(240, 1600, u), y0 - 75, 80, 40, 10); ctx.fillStyle = C.gold; ctx.fill();
      rr(lerp(1600, 240, v), y0 + 35, 80, 40, 10); ctx.fillStyle = C.sky; ctx.fill(); ctx.restore();
    }
    text('→ one way  一个方向', 960, y0 - 150, {size: 26, color: C.gold, alpha: aR});
    text('the other way, at the same time  另一个方向，同时 ←', 960, y0 + 150, {size: 26, color: C.sky, alpha: aR});
    text('two lanes: never meet  两条车道：互不相撞', 960, y0 + 230, {size: 28, weight: 600, alpha: aR * ramp(lt, b[4] + 2, b[4] + 2.6)});
  }
};

/* ---------- 2. every link is two lanes ---------- */
SCN.lanes = (lt, b, d) => {
  const k = eio(ramp(lt, b[0] + .8, b[0] + 2.4));
  ringLine({single: 1 - k, lanes: k, noPU: lt < b[3], closedLabel: 0});
  chip('outgoing  去程  →', 960, 300, C.gold, eback(ramp(lt, b[1], b[1] + .6)), {size: 24});
  chip('←  return  回程', 960, 680, C.sky, eback(ramp(lt, b[1] + .8, b[1] + 1.4)), {size: 24});
  const aN = fade(lt, b[2]);
  for (let i = 0; i < 3; i++) {
    const x = (edgeR(i) + edgeL(i + 1)) / 2, a = aN * ramp(lt, b[2] + .3 + i * .4, b[2] + .8 + i * .4);
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = C.panel; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, RL.y - 95, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    text(String(i + 1), x, RL.y - 94, {size: 22, font: F.mono, weight: 700, alpha: a});
  }
  text('3 cables → 3 outgoing + 3 return lanes  3 根线 → 3 条去程 + 3 条回程', 960, 760, {size: 24, color: C.ink, alpha: aN * ramp(lt, b[2] + 1.6, b[2] + 2.2) * (1 - ramp(lt, b[3], b[3] + .5))});
  const aQ = fade(lt, b[3]);
  [1, 2, 3].forEach(i => { text('?', RL.xs[i], RL.y + 4, {size: 64, font: F.disp, weight: 700, color: C.coral, alpha: aQ * (1 - ramp(lt, b[3] + 2, b[3] + 2.8)) }); pulse(RL.xs[i], RL.y, ((lt - b[3]) % 1.8) / 1.8, C.coral, 30, 100); });
  chip('what happens where the lanes meet?  车道汇合处发生了什么？', 960, 760, C.coral, eback(ramp(lt, b[3] + .4, b[3] + 1)), {size: 24});
};

/* ---------- 3. inside a slave (zoom on one) ---------- */
const ZB = {x: 960, y: 490, w: 1000, h: 380, yo: 420, yr: 600};
function bigSlave(name, zh, color, a, o = {}) {
  if (a <= 0) return;
  const L = ZB.x - ZB.w / 2, R = ZB.x + ZB.w / 2;
  boxShape(ZB.x, ZB.y, ZB.w, ZB.h, color, a, {glowA: .06});
  text(name, ZB.x, ZB.y - 168, {size: 30, weight: 600, alpha: a});
  text(zh, ZB.x, ZB.y - 138, {size: 20, font: F.zh, color: C.dim, alpha: a});
  const pa = o.ports ?? 1, closed = o.closed ?? 0;
  ctx.save(); ctx.globalAlpha *= a * pa; ctx.fillStyle = C.panel; ctx.lineWidth = 3;
  rr(L - 18, ZB.yo - 50, 36, ZB.yr - ZB.yo + 100, 8); ctx.fill(); ctx.strokeStyle = C.dim; ctx.stroke();
  rr(R - 18, ZB.yo - 50, 36, ZB.yr - ZB.yo + 100, 8); ctx.fill(); ctx.strokeStyle = mixHex(C.dim, C.coral, closed); ctx.stroke(); ctx.restore();
  label2('port 0 · IN', '口 0 · 朝主站', L, ZB.y + ZB.h / 2 + 40, {size: 26, alpha: a * pa});
  label2('port 1 · OUT', '口 1 · 背着主站', R, ZB.y + ZB.h / 2 + 40, {size: 26, alpha: a * pa, color: mixHex(C.ink, C.coral, closed)});
  text('← to the master', L - 40, ZB.y - 120, {size: 22, color: C.dim, align: 'right', alpha: a * pa});
  text('主站方向', L - 40, ZB.y - 90, {size: 18, font: F.zh, color: C.dim, align: 'right', alpha: a * pa});
  if (!o.noNext) { text('away →', R + 40, ZB.y - 120, {size: 22, color: C.dim, align: 'left', alpha: a * pa}); text('下一个从站方向', R + 40, ZB.y - 90, {size: 18, font: F.zh, color: C.dim, align: 'left', alpha: a * pa}); }
  // the processing unit
  const pu = o.pu ?? 1;
  ctx.save(); ctx.globalAlpha *= a * pu; rr(ZB.x - 150, ZB.yo - 46, 300, 92, 12); ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  text('processing unit', ZB.x, ZB.yo - 12, {size: 26, weight: 600, color: C.gold, alpha: a * pu});
  text('处理单元', ZB.x, ZB.yo + 20, {size: 20, font: F.zh, color: C.dim, alpha: a * pu});
}
// a frame drawn as a strip of three parts (slave 1 | J1 | J2); 'mine' = which part this slave works on, k = how far it has been changed
function frameStrip(x, y, a, mine, k, col) {
  if (a <= 0) return;
  const w = 66, cs = [C.dim, C.sky, C.violet];
  ctx.save(); ctx.globalAlpha *= a; glow(x, y, 120, col, .35);
  for (let i = 0; i < 3; i++) {
    rr(x - 1.5 * w + i * w + 3, y - 22, w - 6, 44, 6); ctx.fillStyle = i === mine ? mixHex(C.panel2, cs[i], k) : C.panel2; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
  }
  ctx.restore();
}
SCN.slave = (lt, b, d) => {
  const L = ZB.x - ZB.w / 2, R = ZB.x + ZB.w / 2;
  const a = fade(lt, .2);
  bigSlave('Slave 2 · J1', '从站 2 · 关节 J1', C.sky, a, {ports: ramp(lt, b[1], b[1] + .8), pu: ramp(lt, b[2], b[2] + .8)});
  chip('ESC · EtherCAT Slave Controller  EtherCAT 从站控制器', 960, 235, C.ink, eback(ramp(lt, b[0] + 1, b[0] + 1.6)) * (1 - ramp(lt, b[1] + 2, b[1] + 2.5)), {size: 22});
  // lanes inside
  const aO = a * ramp(lt, b[2], b[2] + .8), aR = a * ramp(lt, b[4], b[4] + .8);
  line(L - 150, ZB.yo, ZB.x - 150, ZB.yo, C.gold, 5, aO); line(ZB.x + 150, ZB.yo, R + 150, ZB.yo, C.gold, 5, aO);
  arrow({x: R + 90, y: ZB.yo}, {x: R + 150, y: ZB.yo}, C.gold, {alpha: aO, lw: 5, head: 18});
  line(R + 150, ZB.yr, L - 150, ZB.yr, C.sky, 5, aR); arrow({x: L - 90, y: ZB.yr}, {x: L - 150, y: ZB.yr}, C.sky, {alpha: aR, lw: 5, head: 18});
  // a frame going out: J1's part changes as it passes the unit
  if (lt > b[2] + .8) {
    const u = ((lt - b[2] - .8) / 5) % 1, x = lerp(L - 150, R + 150, u);
    const k = ramp(x, ZB.x - 30, ZB.x + 30) * (lt > b[3] ? 1 : .0) + (lt <= b[3] ? ramp(x, ZB.x - 30, ZB.x + 30) : 0);
    frameStrip(x, ZB.yo, a * Math.min(1, u * 8, (1 - u) * 8), 1, Math.min(1, k), C.gold);
  }
  if (lt > b[3]) {
    text("reads and writes J1's part, as the frame passes", ZB.x, ZB.yo + 82, {size: 24, color: C.ink, alpha: fade(lt, b[3] + .3)});
    text('帧经过时读写 J1 自己的那一份', ZB.x, ZB.yo + 112, {size: 20, font: F.zh, color: C.dim, alpha: fade(lt, b[3] + .3)});
  }
  // a frame coming back: straight through
  if (lt > b[4] + .8) {
    const u = ((lt - b[4] - .8) / 4) % 1, x = lerp(R + 150, L - 150, u);
    frameStrip(x, ZB.yr, a * Math.min(1, u * 8, (1 - u) * 8), 1, 1, C.sky);
    text('skips the unit: just forwarding  不经过处理单元，只转发', ZB.x, ZB.yr + 60, {size: 22, color: C.sky, alpha: fade(lt, b[4] + .6)});
  }
  const aV = fade(lt, b[5]);
  chip('out: worked on once  去程：处理一次', 700, 790, C.gold, eback(ramp(lt, b[5] + .2, b[5] + .8)), {size: 24});
  chip('back: forwarded only  回程：只转发', 1240, 790, C.sky, eback(ramp(lt, b[5] + .8, b[5] + 1.4)), {size: 24});
};

/* ---------- 4. turning around at a closed port (zoom on J2) ---------- */
SCN.turn = (lt, b, d) => {
  const L = ZB.x - ZB.w / 2, R = ZB.x + ZB.w / 2;
  const aB = fade(lt, .2, b[4] + .3) + fade(lt, b[5]) ;
  const closed = ramp(lt, b[1] + .5, b[1] + 1.3);
  bigSlave('Slave 3 · J2', '从站 3 · 关节 J2', C.violet, Math.min(1, aB), {closed, noNext: true});
  // nothing plugged in: a loose plug floating off port 1
  const aP = Math.min(1, aB) * (1 - ramp(lt, b[1], b[1] + .8) * .4);
  ctx.save(); ctx.globalAlpha *= aP * .8; rr(R + 90, ZB.y - 30, 70, 60, 8); ctx.strokeStyle = C.faint; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.restore();
  text('nothing plugged in', R + 125, ZB.y + 60, {size: 22, color: C.dim, alpha: aP}); text('没插线', R + 125, ZB.y + 88, {size: 18, font: F.zh, color: C.dim, alpha: aP});
  // link LEDs
  const aLed = Math.min(1, aB) * ramp(lt, b[1], b[1] + .6);
  dot(L, ZB.y - ZB.h / 2 + 50, 9, C.mint, aLed); text('link', L + 22, ZB.y - ZB.h / 2 + 50, {size: 18, color: C.mint, align: 'left', alpha: aLed});
  ctx.save(); ctx.globalAlpha *= aLed; ctx.fillStyle = C.faint; ctx.beginPath(); ctx.arc(R, ZB.y - ZB.h / 2 + 50, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  text('no link', R - 22, ZB.y - ZB.h / 2 + 50, {size: 18, color: C.coral, align: 'right', alpha: aLed});
  chip('port 1 closes  口 1 关闭', R, 250, C.coral, eback(ramp(lt, b[1] + 1, b[1] + 1.6)) * Math.min(1, aB), {size: 22});
  // the frame: in on port 0, through the unit, handed to the next port inside the chip, out of port 0 again
  const aO = Math.min(1, aB) * ramp(lt, b[2], b[2] + .6);
  const ux = R - 70, ry = (ZB.yr - ZB.yo) / 2, cy = (ZB.yo + ZB.yr) / 2;
  line(L - 150, ZB.yo, ZB.x - 150, ZB.yo, C.gold, 5, aO); line(ZB.x + 150, ZB.yo, ux, ZB.yo, C.gold, 5, aO);
  const aU = Math.min(1, aB) * ramp(lt, b[3], b[3] + .8);
  if (aU > 0) { ctx.save(); ctx.globalAlpha *= aU; ctx.lineWidth = 5; const g = ctx.createLinearGradient(0, ZB.yo, 0, ZB.yr); g.addColorStop(0, C.gold); g.addColorStop(1, C.sky); ctx.strokeStyle = g;
    ctx.beginPath(); ctx.arc(ux, cy, ry, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.restore();
    line(ux, ZB.yr, L - 150, ZB.yr, C.sky, 5, aU); arrow({x: L - 90, y: ZB.yr}, {x: L - 150, y: ZB.yr}, C.sky, {alpha: aU, lw: 5, head: 18}); }
  if (lt > b[2] + .6 && lt < b[4]) {
    // one trip: out to the closed port, wait there until the next line explains it, then round and home
    const t1 = lt - b[2] - .6, s = lt < b[3] + .8 ? Math.min(1, t1 / 3) : 1 + Math.min(1, (lt - b[3] - .8) / 3.5) * ((lt - b[3] - .8) % 6 < 3.5 ? 1 : 1);
    let x, y, col;
    if (s <= 1) { x = lerp(L - 150, ux, s); y = ZB.yo; col = C.gold; }
    else { const v = s - 1, arc = .3; if (v < arc) { const an = -Math.PI / 2 + Math.PI * v / arc; x = ux + ry * Math.cos(an); y = cy + ry * Math.sin(an); col = mixHex(C.gold, C.sky, v / arc); }
      else { x = lerp(ux, L - 150, (v - arc) / (1 - arc)); y = ZB.yr; col = C.sky; } }
    dot(x, y, 14, col, Math.min(1, aB));
  }
  text('handed inside the chip to the next port  芯片内部交给下一个口', ZB.x, ZB.y + 10, {size: 22, color: C.ink, alpha: fade(lt, b[2] + 2.5, b[4])});
  chip('2 ports: after 1 comes 0  两个口：1 的下一个是 0', ZB.x, 790, C.sky, eback(ramp(lt, b[3] + .4, b[3] + 1)) * fade(lt, b[3], b[4]), {size: 24});
  // the dead-end street with a turning circle
  const aS = fade(lt, b[4], b[5] + .3);
  if (aS > 0) {
    const y0 = 480, xe = 1380, R0 = 150;
    ctx.save(); ctx.globalAlpha *= aS; ctx.fillStyle = '#1E2638'; ctx.fillRect(300, y0 - 80, xe - 300, 160);
    ctx.beginPath(); ctx.arc(xe + 60, y0, R0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(xe + 60, y0, 50, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    line(300, y0, xe - 60, y0, C.ink, 4, aS * .5, [30, 24]);
    // a car: in on the top lane, round the circle, out on the bottom lane
    const u = ((lt - b[4]) / 5) % 1;
    let x, y, col;
    if (u < .4) { x = lerp(300, xe + 60, u / .4); y = y0 - 40; col = C.gold; }
    else if (u < .65) { const an = -Math.PI / 2 + 2 * Math.PI * ((u - .4) / .25) * .5 * 2 * .5 + 0; const r = 100; const th = -Math.PI / 2 + Math.PI * 2 * ((u - .4) / .25) * .5 * 2; x = xe + 60 + r * Math.cos(-Math.PI / 2 + Math.PI * ((u - .4) / .25)); y = y0 + r * Math.sin(-Math.PI / 2 + Math.PI * ((u - .4) / .25)); col = mixHex(C.gold, C.sky, (u - .4) / .25); }
    else { x = lerp(xe + 60, 300, (u - .65) / .35); y = y0 + 40; col = C.sky; }
    ctx.save(); ctx.globalAlpha *= aS; glow(x, y, 50, col, .5); rr(x - 34, y - 18, 68, 36, 9); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    text('dead end, with a turning circle  死胡同，尽头有掉头圆环', 900, y0 + 200, {size: 28, weight: 600, alpha: aS});
  }
  chip('no configuration: no cable → it just happens  不需要配置：没插线就自动发生', 960, 790, C.mint, eback(ramp(lt, b[5] + .3, b[5] + .9)), {size: 24});
};

/* ---------- 5. one frame's trip, with a stopwatch ---------- */
function stamp(t, x, y, txt, col, a, below) {
  if (a <= 0) return;
  line(x, below ? YR + 14 : YO - 14, x, below ? y - 18 : y + 18, col, 2, a * .6, [4, 5]);
  text(txt, x, y, {size: 24, font: F.mono, weight: 700, color: col, alpha: a});
}
function stopwatch(ns, x, y, a) {
  if (a <= 0) return;
  text('stopwatch 秒表', x, y - 42, {size: 20, color: C.dim, alpha: a});
  text(`${Math.round(ns)} ns`, x, y, {size: 50, font: F.mono, weight: 700, color: C.ink, alpha: a});
}
SCN.trip = (lt, b, d) => {
  const P = P0, rtt = D.scan.rtt[0];
  const ns = knots(lt, [[b[2] + .3, 0], [b[2] + 2, P[1].in0_ns], [b[3] + .2, P[1].in0_ns], [b[3] + 4.5, P[3].in0_ns], [b[5] + .2, P[3].in0_ns], [b[5] + 3, P[3].out0_ns],
    [b[7] + .2, P[3].out0_ns], [b[7] + 4.5, P[1].out0_ns], [b[8] + .2, P[1].out0_ns], [b[8] + 1.2, rtt]]);
  ringLine({mid: () => { trail(PTS, ns, .55); if (lt > b[2]) head(PTS, ns); }});
  stopwatch(ns, 230, 225, fade(lt, b[0] + .5));
  // the guess
  card(960, 760, 1150, 120, 'How long until its first bit is back?', '它的第一个比特要多久才回到主站？', C.coral, fade(lt, b[1], b[2]), {size: 38});
  // arrivals above, departures below
  const st = t => ns >= t - .5 ? 1 : 0;
  stamp(0, edgeR(0), 330, '0', C.gold, st(0) * ramp(lt, b[2], b[2] + .5));
  [1, 2, 3].forEach(i => stamp(0, edgeL(i), 330, String(P[i].in0_ns), C.gold, st(P[i].in0_ns)));
  [3, 2, 1].forEach(i => stamp(0, edgeL(i), 640, String(P[i].out0_ns), C.sky, st(P[i].out0_ns), true));
  stamp(0, edgeR(0) - 10, 640, String(rtt), C.mint, st(rtt), true);
  // what each slave adds
  const a305 = fade(lt, b[4], b[8]);
  [1, 2].forEach(i => chip(`+${P[i + 1].in0_ns - P[i].in0_ns - 5} ns`, RL.xs[i] + RL.sw / 2 + 65, 280, C.gold, eback(ramp(lt, b[4] + .3 + i * .3, b[4] + .9 + i * .3)) * a305, {size: 20}));
  text('chip 305 ns + cable 5 ns per hop  每站芯片 305 ns + 网线 5 ns', 1290, 225, {size: 20, color: C.gold, alpha: a305});
  const a265 = fade(lt, b[6], b[8]);
  [1, 2].forEach(i => chip(`+${P[i].out0_ns - P[i].in1_ns} ns`, RL.xs[i], 700, C.sky, eback(ramp(lt, b[6] + .3 + i * .3, b[6] + .9 + i * .3)) * a265, {size: 20}));
  text('forwarding alongside the unit: 265 ns  从旁边转发：265 ns', 960, 750, {size: 20, color: C.sky, alpha: a265});
  // the result
  const aR = fade(lt, b[8]);
  card(960, 760, 900, 96, `back after ${rtt} ns ≈ ${(rtt / 1000).toFixed(1)} µs`, '回到主站：整趟约 1.5 微秒', C.mint, aR, {size: 36, tcolor: C.mint});
  const aS = fade(lt, b[9]);
  simTag(1290, 210, aS);
  text('cable 5 ns/m · chip 305 / 265 ns (ET1100 datasheet averages)', 1290, 248, {size: 20, color: C.violet, alpha: aS});
  text('the path itself: the chip\'s rules  路径本身：由芯片规则决定', 1290, 278, {size: 20, color: C.ink, alpha: aS});
};

/* ---------- 6. so it is a ring ---------- */
SCN.ring = (lt, b, d) => {
  const rtt = D.scan.rtt[0];
  const draw = knots(lt, [[b[0] + .3, 0], [b[0] + 5, rtt]]);
  const m = eio(ramp(lt, b[2] + .2, b[2] + 2.4));
  const cx = 960, cy = 445, R = 230;
  const circ = t => { const th = Math.PI + 2 * Math.PI * t / rtt; return {x: cx + R * Math.cos(th), y: cy + R * Math.sin(th)}; };
  const map = (q, t) => { const c = circ(t); return {x: lerp(q.x, c.x, m), y: lerp(q.y, c.y, m)}; };
  ringLine({alpha: 1 - m, mid: () => {}});
  // the path, drawn as one stroke, sampled densely so it can bend into a circle
  if (draw > 0) {
    ctx.save(); ctx.lineWidth = 9; ctx.lineCap = 'round';
    const N = 300; let prev = null;
    for (let s = 0; s <= N; s++) {
      const t = draw * s / N, q = map(posAt(PTS, t), t);
      if (prev) { ctx.strokeStyle = laneCol(posAt(PTS, t).y); ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      prev = q;
    }
    ctx.restore();
    if (draw < rtt) { const q = map(posAt(PTS, draw), draw); dot(q.x, q.y, 11, laneCol(posAt(PTS, draw).y)); }
  }
  chip('never doubles back · no lane used twice  中途不折返 · 没有车道走两次', 960, 770, C.ink, eback(ramp(lt, b[1] + .2, b[1] + .8)) * (1 - ramp(lt, b[2], b[2] + .4)), {size: 22});
  // on the circle: where each slave sits (worked on going out, passed again coming back)
  const aC = ramp(lt, b[2] + 1.8, b[2] + 2.6);
  if (aC > 0) {
    const pM = circ(0); boxShape(pM.x - 70, pM.y, 150, 80, C.gold, aC); text('Master', pM.x - 70, pM.y - 10, {size: 22, weight: 600, alpha: aC}); text('主站', pM.x - 70, pM.y + 18, {size: 16, font: F.zh, color: C.dim, alpha: aC});
    [1, 2, 3].forEach(i => {
      const q = circ((P0[i].pu_ns + 40)), dx = q.x - cx, dy = q.y - cy, L = Math.hypot(dx, dy);
      dot(q.x, q.y, 10, LCOL[i], aC);
      text(['', 'Slave 1', 'J1', 'J2'][i], cx + dx / L * (R + 60), cy + dy / L * (R + 46), {size: 24, weight: 700, color: LCOL[i], alpha: aC});
      if (i < 3) { const r = circ((P0[i].in1_ns + P0[i].out0_ns) / 2), ex = r.x - cx, ey = r.y - cy;
        ctx.save(); ctx.globalAlpha *= aC * .7; ctx.fillStyle = C.bg; ctx.strokeStyle = LCOL[i]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        text(['', 'slave 1 (back)', 'J1 (back)'][i], cx + ex / L * (R + 70), cy + ey / L * (R + 40), {size: 18, color: C.dim, alpha: aC}); }
    });
    text('● worked on   ○ passed on the way back', cx, cy - 20, {size: 20, color: C.dim, alpha: aC});
    text('● 处理   ○ 回程经过', cx, cy + 12, {size: 18, font: F.zh, color: C.dim, alpha: aC});
  }
  card(960, 790, 1000, 80, 'a ring, folded inside the cables', '折叠在网线里的环', C.mint, fade(lt, b[2] + 2, b[3]), {size: 30, tcolor: C.mint});
  chip('one port: send on one pair, receive on the other  一个网口：一对发，一对收', 960, 790, C.gold, eback(ramp(lt, b[3] + .2, b[3] + .8)) * fade(lt, b[3], b[4]), {size: 22});
  if (lt > b[4]) {
    for (let k = 0; k < 2; k++) { const t = (((lt - b[4]) * .3 + k / 2) % 1) * rtt; const q = circ(t); dot(q.x, q.y, 9, laneCol(posAt(PTS, t).y)); }
    chip('every frame: slave 1 → J1 → J2, same order  每一帧：同样的顺序', 960, 790, C.mint, eback(ramp(lt, b[4] + .2, b[4] + .8)), {size: 22});
  }
};

/* ---------- 7. cut the cable ---------- */
SCN.cut = (lt, b, d) => {
  const after = lt >= b[2];
  const ns = knots(lt, [[b[4] + .4, 0], [b[4] + 4, D.break2.rtt[0]]]);
  ringLine({n: after ? 2 : 3, cut: true, closedLabel: after ? ramp(lt, b[2] + .5, b[2] + 1.1) : 0, alpha: 1,
    mid: () => { if (lt > b[4]) { trail(PTS2, ns, .55); head(PTS2, ns); } }});
  chip('cut  剪断', edgeL(3) - 24, 400, C.coral, eback(ramp(lt, b[0] + .6, b[0] + 1.2)), {size: 22});
  card(960, 760, 1300, 120, 'How many slaves will the master find? Where does it turn?', '主站会找到几个从站？帧在哪里掉头？', C.coral, fade(lt, b[1], b[2]), {size: 36});
  if (after) pulse(edgeR(2), RL.y, ramp(lt, b[2], b[2] + 1.2), C.coral, 20, 90);
  const aF = fade(lt, b[3]);
  chip(`found ${D.break2.count} slaves  找到 ${D.break2.count} 个从站`, RL.xs[0], 300, C.mint, eback(ramp(lt, b[3] + .2, b[3] + .8)), {size: 22});
  realTag(RL.xs[0], 252, aF);
  text('maybe powered, but unreached', RL.xs[3], RL.y - 175, {size: 22, color: C.dim, alpha: aF});
  text('也许通着电，但帧到不了', RL.xs[3], RL.y - 147, {size: 18, font: F.zh, color: C.dim, alpha: aF});
  stopwatch(ns, 1600, 230, fade(lt, b[4]) * (1 - 0));
  // trip length: before and after
  const aB = fade(lt, b[4] + 3.5);
  if (aB > 0) {
    const x0 = 520, w = 900, sc = w / D.scan.rtt[0], y1 = 700, y2 = 760;
    ctx.save(); ctx.globalAlpha *= aB; rr(x0, y1 - 18, D.scan.rtt[0] * sc, 36, 8); ctx.fillStyle = rgba(C.dim, .6); ctx.fill();
    rr(x0, y2 - 18, D.break2.rtt[0] * sc * eo(ramp(lt, b[4] + 3.5, b[4] + 4.5)), 36, 8); ctx.fillStyle = rgba(C.mint, .85); ctx.fill(); ctx.restore();
    text('intact 完整', x0 - 20, y1, {size: 22, color: C.dim, align: 'right', alpha: aB}); text('cut 剪断后', x0 - 20, y2, {size: 22, color: C.mint, align: 'right', alpha: aB});
    text(`${D.scan.rtt[0]} ns`, x0 + D.scan.rtt[0] * sc + 16, y1, {size: 24, font: F.mono, weight: 700, color: C.dim, align: 'left', alpha: aB});
    text(`${D.break2.rtt[0]} ns`, x0 + D.break2.rtt[0] * sc + 16, y2, {size: 24, font: F.mono, weight: 700, color: C.mint, align: 'left', alpha: aB});
  }
  chip('nothing crashed · the ring just got shorter  没有崩溃 · 环只是变短了', 960, 640, C.mint, eback(ramp(lt, b[5] + .2, b[5] + .8)), {size: 24});
};

/* ---------- 8. how SOEM sees it ---------- */
const dedent = ls => { const n = Math.min(...ls.filter(l => l.trim()).map(l => l.match(/^ */)[0].length)); return ls.map(l => l.slice(n)); };
function mini(x0, y, n, cutAfter, a, wkc, t) { // a small line and the counting read's counter riding on the frame
  const xs = [x0, x0 + 300, x0 + 560, x0 + 820];
  for (let i = 0; i < 3; i++) { if (cutAfter && i === cutAfter) { cross((xs[i] + xs[i + 1]) / 2, y, 12, C.coral, 5, a); continue; } line(xs[i] + 70, y, xs[i + 1] - 70, y, C.faint, 6, a * (i >= n ? .35 : 1)); }
  ['Master', 'Slave 1', 'J1', 'J2'].forEach((s, i) => { boxShape(xs[i], y, 140, 70, LCOL[i], a * (i > n ? .35 : 1)); text(s, xs[i], y, {size: 22, weight: 600, alpha: a * (i > n ? .35 : 1)}); });
  // t in 0..1: out to slave n and back; the counter is the value after each slave (real, from the trace)
  if (t <= 0 || t >= 1) return;
  const span = xs[n] - xs[0], pos = t < .5 ? t * 2 * span : (1 - t) * 2 * span, x = xs[0] + pos;
  const passed = t < .5 ? xs.slice(1, n + 1).filter(v => v <= x + 1).length : n;
  dot(x, y - 60, 12, t < .5 ? C.gold : C.sky, a);
  text(`counter ${wkc[passed]}`, x, y - 98, {size: 24, font: F.mono, weight: 700, color: C.gold, alpha: a});
}
SCN.soem = (lt, b, d) => {
  const c72 = D.code.count, cP = D.code.ports, c307 = D.code.keep;
  // A: counting the slaves (ec_config.c:72)
  const aA = fade(lt, b[0] + .3, b[3]);
  codeBox(110, 180, 1700, `${c72.file}:${c72.from}  ecx_detect_slaves`, dedent(c72.lines).map(l => [l]), {alpha: aA * ramp(lt, b[1], b[1] + .6), size: 22, file: c72.file, from: c72.from, to: c72.to});
  text('BRD = broadcast read: every slave it passes adds 1 to the counter  广播读：每经过一个从站，计数器加 1', 960, 350, {size: 22, color: C.dim, alpha: aA * ramp(lt, b[1] + .8, b[1] + 1.4)});
  mini(330, 520, 3, 0, aA * ramp(lt, b[0] + .5, b[0] + 1.1), D.scan.brd_wkc, ((lt - b[1] - 1.5) / 5) % 1.4);
  const aC2 = fade(lt, b[2], b[3]);
  if (aC2 > 0) mini(330, 700, 2, 2, aC2, D.break2.brd_wkc, ((lt - b[2] - .5) / 4) % 1.3);
  text(`intact → ${D.scan.brd_wkc.at(-1)}`, 1430, 520, {size: 28, font: F.mono, weight: 700, color: C.mint, align: 'left', alpha: aA * ramp(lt, b[2], b[2] + .6)});
  text(`cut → ${D.break2.brd_wkc.at(-1)}`, 1430, 700, {size: 28, font: F.mono, weight: 700, color: C.mint, align: 'left', alpha: aC2});
  chip('the working counter → Episode 3  工作计数器 → 第 3 集', 960, 800, C.gold, eback(ramp(lt, b[2] + 2, b[2] + 2.6)) * aA, {size: 20});
  realTag(1700, 400, aA * ramp(lt, b[1] + 1.5, b[1] + 2));
  // B: register 0x0110, two bits per port
  const aB = fade(lt, b[3], b[5]);
  if (aB > 0) {
    text('register 0x0110 · DL Status  寄存器 0x0110 · DL 状态', 960, 220, {size: 32, weight: 600, alpha: aB});
    const x0 = 330, cw = 78, rows = [['J1', D.scan.dlstat[1]], ['J2', D.scan.dlstat[2]]];
    for (let bit = 15; bit >= 0; bit--) { const x = x0 + (15 - bit) * cw + cw / 2; text(String(bit), x, 300, {size: 18, font: F.mono, color: C.dim, alpha: aB}); }
    [[9, 8, 'port 0', '口 0'], [11, 10, 'port 1', '口 1'], [13, 12, 'port 2', '口 2'], [15, 14, 'port 3', '口 3']].forEach(([hi, lo, en, zh], j) => {
      const xa = x0 + (15 - hi) * cw, hl = j < 2;
      brace(xa + 6, xa + 2 * cw - 6, 330, '', hl ? C.gold : C.faint, aB, -1);
      text(en + ' ' + zh, xa + cw, 260, {size: 20, weight: hl ? 700 : 500, color: hl ? C.gold : C.dim, alpha: aB});
    });
    rows.forEach(([nm, v], r) => {
      const y = 400 + r * 110, a = aB * ramp(lt, b[3] + .8 + r * .5, b[3] + 1.4 + r * .5);
      text(nm, x0 - 30, y - 12, {size: 26, weight: 700, color: LCOL[2 + r], align: 'right', alpha: a});
      text('0x' + v.toString(16).toUpperCase().padStart(4, '0'), x0 - 30, y + 18, {size: 20, font: F.mono, color: C.dim, align: 'right', alpha: a});
      for (let bit = 15; bit >= 0; bit--) {
        const x = x0 + (15 - bit) * cw, on = (v >> bit) & 1, port = bit >= 8 ? (bit - 8) >> 1 : -1, hl = port === 0 || port === 1;
        const pat = port >= 0 ? (v >> (8 + 2 * port)) & 3 : 0, col = !hl ? C.faint : pat === 2 ? C.mint : C.coral;
        ctx.save(); ctx.globalAlpha *= a * (hl ? 1 : .5); rr(x + 4, y - 30, cw - 8, 60, 8); ctx.fillStyle = hl ? rgba(col, .16) : C.panel; ctx.fill(); ctx.strokeStyle = hl ? col : C.line; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        text(String(on), x + cw / 2, y, {size: 28, font: F.mono, weight: 700, color: hl ? col : C.dim, alpha: a * (hl ? 1 : .5)});
      }
    });
    realTag(1710, 400, aB * ramp(lt, b[3] + 1, b[3] + 1.6)); text('read back by SOEM', 1680, 440, {size: 18, color: C.dim, alpha: aB * ramp(lt, b[3] + 1, b[3] + 1.6)});
    const aK = fade(lt, b[4]);
    card(700, 700, 560, 96, '10 = open, communicating', '打开，且已和邻居通信', C.mint, aK, {size: 30, tcolor: C.mint});
    card(1260, 700, 520, 96, '01 = closed', '关闭', C.coral, aK, {size: 30, tcolor: C.coral});
  }
  // C: the code that tests each port (ec_config.c:279–292), and keeps the result (:307)
  const aC = fade(lt, b[5], b[6]);
  if (aC > 0) {
    const ls = dedent(cP.lines);
    codeBox(110, 175, 1700, `${cP.file}:${cP.from}–${cP.to}  ecx_config_init`, ls.map(l => [l]), {alpha: aC, size: 20, lh: 30, file: cP.file, from: cP.from, to: cP.to,
      hl: i => i === 0 ? ramp(lt, b[5] + .3, b[5] + .8) : (i === 4 || i === 9) ? ramp(lt, b[5] + 1.5, b[5] + 2) : 0});
    codeBox(110, 700, 1700, `${c307.file}:${c307.from}`, dedent(c307.lines).map(l => [l, C.mint]), {alpha: aC * ramp(lt, b[5] + 3, b[5] + 3.6), size: 20, lh: 32, file: c307.file, from: c307.from, to: c307.to});
  }
  // D: what it found, intact and cut
  const aD = fade(lt, b[6]);
  if (aD > 0) {
    text('what SOEM found  SOEM 的结论', 960, 215, {size: 32, weight: 600, alpha: aD});
    const tab = (x, title, dl, ports, names, a) => {
      if (a <= 0) return;
      text(title, x + 330, 290, {size: 26, weight: 700, color: C.ink, alpha: a});
      ['slave', '0x0110', 'port 0', 'port 1', 'ports'].forEach((h, j) => text(h, x + [60, 210, 360, 480, 610][j], 345, {size: 20, font: F.mono, color: C.dim, alpha: a}));
      dl.forEach((v, r) => {
        const y = 410 + r * 80, p0 = (v >> 8) & 3, p1 = (v >> 10) & 3;
        panel(x + 330, y, 680, 64, {alpha: a, fill: C.panel});
        text(['Slave 1', 'J1', 'J2'][r], x + 60, y, {size: 24, weight: 700, color: LCOL[r + 1], alpha: a});
        text('0x' + v.toString(16).toUpperCase(), x + 210, y, {size: 22, font: F.mono, color: C.dim, alpha: a});
        text(p0.toString(2).padStart(2, '0'), x + 360, y, {size: 24, font: F.mono, weight: 700, color: p0 === 2 ? C.mint : C.coral, alpha: a});
        text(p1.toString(2).padStart(2, '0'), x + 480, y, {size: 24, font: F.mono, weight: 700, color: p1 === 2 ? C.mint : C.coral, alpha: a});
        text(ports[r], x + 610, y, {size: 26, font: F.mono, weight: 700, color: C.gold, alpha: a});
      });
    };
    tab(130, 'intact  完整', D.scan.dlstat, D.scan.ports, D.scan.names, aD);
    tab(1000, 'cut after J1  J1 后剪断', D.break2.dlstat, D.break2.ports, D.break2.names, fade(lt, b[7]));
    realTag(960, 680, aD);
    text('"ports" = SOEM\'s own scan output: port 0 open?  port 1 open?   ports 列 = SOEM 扫描输出：口 0 开？口 1 开？', 960, 730, {size: 20, color: C.dim, alpha: aD});
    chip('open ports show where the line ends  哪些口开着，就知道总线在哪里结束', 960, 790, C.mint, eback(ramp(lt, b[7] + 1.2, b[7] + 1.8)), {size: 22});
  }
};

/* ---------- 9. more than two ports (from the datasheet) ---------- */
SCN.tree = (lt, b, d) => {
  const N = {M: [260, 480], A: [660, 480], B: [1060, 350], C: [1460, 350], E: [1060, 620], F: [1460, 620]};
  const a = fade(lt, .2);
  const edges = [['M', 'A'], ['A', 'B'], ['B', 'C'], ['A', 'E'], ['E', 'F']];
  edges.forEach(([p, q]) => line(N[p][0], N[p][1], N[q][0], N[q][1], C.faint, 6, a));
  // the walk: main line first, back, then the branch, back, home (each port hands the frame to the next)
  const walk = ['M', 'A', 'B', 'C', 'B', 'A', 'E', 'F', 'E', 'A', 'M'];
  const segs = walk.slice(1).map((q, i) => [walk[i], q]);
  const u = lt > b[0] + 1.5 ? (((lt - b[0] - 1.5) / 7) % 1.15) : 0;
  if (u > 0 && u < 1) {
    const s = u * segs.length, i = Math.floor(s), f = s - i, [p, q] = segs[i];
    const dx = N[q][0] - N[p][0], dy = N[q][1] - N[p][1], L = Math.hypot(dx, dy), nx = -dy / L * 12, ny = dx / L * 12;
    const out = walk.indexOf(q) > walk.indexOf(p) && !(['B', 'A', 'E', 'M'].includes(q) && i >= 3 && (i === 3 || i === 4 || i === 7 || i === 8 || i === 9));
    // trail of finished segments
    ctx.save(); ctx.globalAlpha *= a * .6; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let k = 0; k <= i; k++) { const [pp, qq] = segs[k], ddx = N[qq][0] - N[pp][0], ddy = N[qq][1] - N[pp][1], LL = Math.hypot(ddx, ddy), ox = -ddy / LL * 12, oy = ddx / LL * 12, ff = k < i ? 1 : f;
      const back = [3, 4, 7, 8, 9].includes(k); ctx.strokeStyle = back ? C.sky : C.gold;
      ctx.beginPath(); ctx.moveTo(N[pp][0] + ox, N[pp][1] + oy); ctx.lineTo(N[pp][0] + ox + ddx * ff, N[pp][1] + oy + ddy * ff); ctx.stroke(); }
    ctx.restore();
    const back = [3, 4, 7, 8, 9].includes(i);
    dot(N[p][0] + nx + dx * f, N[p][1] + ny + dy * f, 11, back ? C.sky : C.gold, a);
  }
  const lab = {M: ['Master', '主站', C.gold], A: ['3 ports', '3 个口', C.ink], B: ['', '', C.dim], C: ['', '', C.dim], E: ['branch', '支路', C.dim], F: ['', '', C.dim]};
  Object.entries(N).forEach(([k, [x, y]]) => { boxShape(x, y, 170, 90, lab[k][2], a); text(lab[k][0] || 'slave', x, y - 12, {size: 22, weight: 600, alpha: a}); text(lab[k][1] || '从站', x, y + 16, {size: 16, font: F.zh, color: C.dim, alpha: a}); });
  text('0', N.A[0] - 100, N.A[1] - 18, {size: 20, font: F.mono, weight: 700, color: C.dim, alpha: a});
  text('1', N.A[0] + 96, N.A[1] - 66, {size: 20, font: F.mono, weight: 700, color: C.dim, alpha: a});
  text('2', N.A[0] + 96, N.A[1] + 70, {size: 20, font: F.mono, weight: 700, color: C.dim, alpha: a});
  chip('from the ESC datasheet, not our line  按 ESC 数据手册，不是我们的总线', 960, 215, C.dim, eback(ramp(lt, .4, 1)), {size: 20});
  card(960, 775, 1100, 90, 'a tree is still one ring: every branch, in turn', '树形也还是一个环：每条支路挨个走', C.mint, fade(lt, b[1] + 1), {size: 32, tcolor: C.mint});
};

/* ---------- 10. recap ---------- */
SCN.recap = (lt, b, d) => {
  const items = [
    ['every cable is two lanes, both at once', '每根网线都是两条车道，同时工作', C.gold],
    ['worked on going out; no cable → port closes → turn round', '去程处理；没插线 → 口关闭 → 掉头', C.coral],
    ['a line of slaves is a ring; a cut only shortens it', '一串从站就是一个环；剪断只会让它变短', C.mint],
  ];
  items.forEach(([en, zh, c], i) => {
    const a = eo(ramp(lt, b[i] + .2, b[i] + .8)), y = 330 + i * 150;
    if (a <= 0) return;
    panel(960, y, 1400, 120, {alpha: a, edge: rgba(c, .6)});
    text(String(i + 1).padStart(2, '0'), 330, y, {size: 30, font: F.mono, weight: 700, color: c, alpha: a});
    text(en, 400, y - 18, {size: 34, weight: 600, align: 'left', alpha: a});
    text(zh, 400, y + 24, {size: 24, font: F.zh, color: C.dim, align: 'left', alpha: a});
  });
};

/* ---------- 11. your turn ---------- */
SCN.yourturn = (lt, b, d) => {
  text('YOUR TURN  你来想', 960, 210, {size: 26, font: F.mono, weight: 700, color: C.gold, ls: 6, alpha: fade(lt, .2, b[3])});
  const aL = fade(lt, b[0] + .2, b[3]);
  if (aL > 0) {
    const y = 430, xs = [220, 520, 800, 1080, 1360, 1640], ans = ramp(lt, b[2], b[2] + .8);
    for (let i = 0; i < 5; i++) {
      if (i === 3) { line(xs[i] + 80, y, xs[i + 1] - 80, y, C.faint, 6, aL * .5); cross((xs[i] + xs[i + 1]) / 2, y, 14, C.coral, 5, aL); continue; }
      line(xs[i] + 80, y, xs[i + 1] - 80, y, C.faint, 6, aL * (i > 3 ? .35 : 1));
    }
    xs.forEach((x, i) => { const dim = i > 3 ? 1 - .65 * ans : 1;
      boxShape(x, y, 160, 90, i ? C.dim : C.gold, aL * dim); text(i ? 'Slave ' + i : 'Master', x, y - 10, {size: 22, weight: 600, alpha: aL * dim}); text(i ? '从站 ' + i : '主站', x, y + 18, {size: 16, font: F.zh, color: C.dim, alpha: aL * dim}); });
    text('?', 960, 600, {size: 90, font: F.disp, weight: 700, color: C.coral, alpha: fade(lt, b[1], b[2])});
    if (ans > 0) {
      ctx.save(); ctx.globalAlpha *= aL * ans; ctx.strokeStyle = C.coral; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(xs[3] + 60, y, 26, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.restore();
      text('port 1 closed  口 1 关闭', xs[3], y + 90, {size: 22, weight: 700, color: C.coral, alpha: aL * ans});
      chip('master finds 3  主站找到 3 个', xs[0] + 180, y + 160, C.mint, eback(ans), {size: 24});
    }
  }
  // the teaser: the head is home before the tail has left
  const aT = fade(lt, b[3]);
  if (aT > 0) {
    const x0 = 360, w = 1200, us = 6.5, sc = w / us, y = 420, rtt = D.scan.rtt[0] / 1000;
    const g = eo(ramp(lt, b[3] + .3, b[3] + 2.3));
    ctx.save(); ctx.globalAlpha *= aT; ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y + 60); ctx.lineTo(x0 + w, y + 60); ctx.stroke(); ctx.restore();
    [0, 1, 2, 3, 4, 5, 6].forEach(t => text(t + ' µs', x0 + t * sc, y + 90, {size: 18, font: F.mono, color: C.dim, alpha: aT}));
    ctx.save(); ctx.globalAlpha *= aT; rr(x0, y - 26, D.wire_us * sc * g, 52, 8); ctx.fillStyle = rgba(C.gold, .75); ctx.fill(); ctx.restore();
    text(`shortest frame leaving the master: ${D.wire_us} µs at 100 Mbit/s  最短的帧发出去要 ${D.wire_us} 微秒`, x0 + D.wire_us * sc / 2, y - 60, {size: 22, color: C.gold, alpha: aT});
    const aH = ramp(lt, b[3] + 1, b[3] + 1.5);
    line(x0 + rtt * sc, y - 34, x0 + rtt * sc, y + 130, C.sky, 4, aT * aH);
    text(`head back home: ${rtt.toFixed(3)} µs  帧头已回家`, x0 + rtt * sc + 14, y + 140, {size: 24, weight: 700, color: C.sky, align: 'left', alpha: aT * aH});
    simTag(x0 + rtt * sc + 100, y + 180, aT * aH);
    const aN = fade(lt, b[4]);
    text('Next · 下一集', 960, 660, {size: 24, font: F.mono, weight: 700, color: C.dim, alpha: aN});
    text('One frame, never stopped: processing on the fly', 960, 720, {size: 46, font: F.disp, weight: 700, alpha: aN});
    text('一帧走到底：边走边处理', 960, 785, {size: 30, font: F.zh, color: C.dim, alpha: aN});
  }
};

// filled by build.py with every Chinese character in this file (so the font subset loads them)
const EXTRA_ZH = '__AUTO__';
