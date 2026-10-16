/* =========================================================
   Episode 3a — One frame, never stopped: processing on the fly. One scene per id in script.json; numbers from
   ep03a_data.js (D): vwire/runs.sh (SOEM's cyclic frames on vwire:chain3, every hop + pcap), checked by data.py.
   Colour legend (as Episode 2): gold = outgoing lane / the frame going out, sky = return lane,
     coral = checksum, errors, the question; mint = real-run results; violet = simulated; dim = neutral.
   The two-lane line and the frame-path helpers are Episode 2's, unchanged.
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
const P0 = D.path;

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
const PTS = pathPts(P0, 3, D.rtt);
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

/* ---------- episode 3a helpers ---------- */
const BYTE = 80, WB = D.wire_bytes;   // 80 ns per byte at 100 Mbit/s; 100 bytes on the wire (8 preamble + 88 + 4 checksum)
// what each byte on the wire is: preamble, Ethernet header, EtherCAT part, checksum
const byteCol = k => k < 8 ? '#5C6A88' : k < 22 ? '#B9C2D6' : k < 96 ? C.gold : C.coral;
// the frame as a ribbon of bytes on the two-lane line at time t (ns since the first bit left): byte k left at k·80 ns
function ribbon(t, a = 1) {
  let sent = 0, back = 0;
  for (let k = 0; k < WB; k++) { const tk = t - k * BYTE; if (tk >= BYTE) sent++; if (tk >= D.rtt + BYTE) back++; }
  // the part of the frame in flight: bits sent between t − rtt and t (and no earlier than 0, no later than the last bit)
  const lo = Math.max(0, t - D.rtt), hi = Math.min(t, WB * BYTE);
  if (hi > lo) {
    ctx.save(); ctx.globalAlpha *= a; ctx.lineWidth = 12; ctx.lineCap = 'round';
    let prev = null, pk = -1;
    for (let s = hi; s >= lo - 1e-6; s -= 10) {           // s = when this bit left the master; its age is t − s
      const k = Math.min(WB - 1, Math.floor(s / BYTE)), q = posAt(PTS, t - s);
      if (prev) { ctx.strokeStyle = byteCol(pk); ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      prev = q; pk = k;
    }
    ctx.restore();
    if (t <= D.rtt) { const q = posAt(PTS, t); dot(q.x, q.y, 9, C.ink, a); }   // the head
  }
  return {sent, back};
}
function counters(r, a) {
  if (a <= 0) return;
  text(`sent ${r.sent} / ${WB} B`, RL.xs[0], RL.y + 160, {size: 22, font: F.mono, weight: 700, color: C.gold, alpha: a});
  text(`back ${r.back} / ${WB} B`, RL.xs[0], RL.y + 192, {size: 22, font: F.mono, weight: 700, color: C.sky, alpha: a});
  text('发出 / 收回（字节）', RL.xs[0], RL.y + 222, {size: 16, font: F.zh, color: C.dim, alpha: a});
}
// a horizontal bar of the 100 bytes on the wire, grouped
function wireBar(x0, y, cw, a, o = {}) {
  if (a <= 0) return;
  const n = o.n ?? WB;
  for (let k = 0; k < n; k++) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = byteCol(k); rr(x0 + k * cw + 1, y - 16, cw - 2, 32, 2); ctx.fill(); ctx.restore(); }
}
function termBox(x, y, w, title, lines, a) { // a terminal: real program output (not source code)
  if (a <= 0) return;
  const h = 70 + lines.length * 34;
  panel(x + w / 2, y + h / 2, w, h, {alpha: a, fill: '#0E1628'});
  text('$ ' + title, x + 28, y + 30, {size: 20, font: F.code, color: C.dim, align: 'left', alpha: a});
  lines.forEach((l, i) => text(l, x + 28, y + 70 + i * 34, {size: 20, font: F.code, color: C.ink, align: 'left', alpha: a}));
}

/* ---------- 0. intro ---------- */
SCN.intro = (lt, b, d) => {
  const aL = fade(lt, .2) * (1 - .8 * ramp(lt, b[3] - .3, b[3] + .4));
  const t = knots(lt, [[b[0] + .8, 0], [b[1] + 1.5, D.rtt]]);
  let r = {sent: 0, back: 0};
  ringLine({alpha: aL}); r = ribbon(t, aL);
  stopwatch(t, 230, 225, aL);
  if (lt > b[1]) { pulse(edgeR(0), YR, ramp(lt, b[1] + 1.5, b[1] + 2.5), C.sky, 20, 80);
    chip(`head home: ${D.rtt} ns  帧头到家`, RL.xs[0] + 40, 300, C.sky, eback(ramp(lt, b[1] + 1.5, b[1] + 2.1)) * aL, {size: 22}); }
  // how much of the frame has left by then
  const aB = fade(lt, b[2]) * aL;
  if (aB > 0) {
    const x0 = 360, w = 1200, y = 720;
    ctx.save(); ctx.globalAlpha *= aB; rr(x0, y - 18, w, 36, 8); ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
    rr(x0, y - 18, w * D.rtt / (WB * BYTE), 36, 8); ctx.fillStyle = rgba(C.gold, .8); ctx.fill(); ctx.restore();
    text(`whole frame: ${WB * BYTE / 1000} µs to send  整帧发完要 ${WB * BYTE / 1000} 微秒`, x0 + w / 2, y - 44, {size: 22, color: C.gold, alpha: aB});
    text(`sent so far: ${(D.rtt / 1000).toFixed(2)} µs`, x0 + 10, y + 44, {size: 20, font: F.mono, color: C.sky, align: 'left', alpha: aB});
  }
  const aT = fade(lt, b[3]);
  text('EPISODE 03 · A', 960, 330, {size: 24, font: F.mono, weight: 700, color: C.gold, ls: 10, alpha: aT});
  text('One frame, never stopped', 960, 435 + 30 * (1 - aT), {size: 100, font: F.disp, weight: 700, alpha: aT, shadow: 'rgba(0,0,0,.6)'});
  text('一帧走到底：边走边处理', 960, 540, {size: 46, font: F.zh, weight: 500, alpha: aT});
  text('processing on the fly · EtherCAT from Scratch', 960, 610, {size: 28, color: C.dim, alpha: aT});
  chip('home before it has left?  还没出门就到家？', 960, 720, C.coral, eback(ramp(lt, b[3] + .8, b[3] + 1.4)), {size: 24});
};

/* ---------- 1. a frame is a stream ---------- */
SCN.wire = (lt, b, d) => {
  // bits flowing past
  const aS = fade(lt, .2, b[2]);
  if (aS > 0) {
    const off = (lt * 60) % 52;
    for (let i = -1; i < 30; i++) {
      const x = 240 + i * 52 + off, bit = rnd(i - Math.floor(lt * 60 / 52)) > .5 ? 1 : 0;
      if (x < 220 || x > 1700) continue;
      ctx.save(); ctx.globalAlpha *= aS; rr(x, 300, 44, 56, 6); ctx.fillStyle = bit ? rgba(C.gold, .85) : C.panel2; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      text(String(bit), x + 22, 329, {size: 24, font: F.mono, weight: 700, color: bit ? C.bg : C.dim, alpha: aS});
    }
    text('bits on the cable, one after another  网线上的比特，一个接一个', 960, 250, {size: 24, color: C.ink, alpha: aS});
    const aR = ramp(lt, b[1], b[1] + .8);
    eq([['1 bit', C.gold], [' = ', C.dim], ['10 ns', C.ink]], 700, 480, 54, {alpha: aS * aR, glow: true});
    eq([['1 byte', C.gold], [' = 8 bits = ', C.dim], ['80 ns', C.ink]], 1240, 480, 54, {alpha: aS * ramp(lt, b[1] + 1.2, b[1] + 2), glow: true});
    text('at 100 Mbit/s  在 100 Mbit/s 下', 960, 560, {size: 24, color: C.dim, alpha: aS * aR});
  }
  // our frame on the wire: 100 bytes
  const aF = fade(lt, b[2], b[4]);
  if (aF > 0) {
    const x0 = 260, cw = 14, y = 420, g = ramp(lt, b[2] + .3, b[2] + 2.3);
    wireBar(x0, y, cw, aF, {n: Math.round(WB * g)});
    const br = (k0, k1, en, zh, c, dir) => { brace(x0 + k0 * cw, x0 + k1 * cw, y + (dir > 0 ? 26 : -26), '', c, aF * ramp(lt, b[2] + 2.3, b[2] + 2.9), dir);
      text(en, x0 + (k0 + k1) / 2 * cw, y + dir * 100, {size: 20, weight: 600, color: c, alpha: aF * ramp(lt, b[2] + 2.3, b[2] + 2.9)});
      text(zh, x0 + (k0 + k1) / 2 * cw, y + dir * 100 + 26, {size: 16, font: F.zh, color: C.dim, alpha: aF * ramp(lt, b[2] + 2.3, b[2] + 2.9)}); };
    br(0, 8, 'preamble 8', '前导码', C.dim, 1); br(8, 96, `our frame: ${D.bytes} bytes`, '我们的帧', C.gold, -1); br(96, 100, 'checksum 4', '校验和', C.coral, 1);
    // time axis
    const aT = ramp(lt, b[3], b[3] + .8);
    if (aT > 0) {
      line(x0, y + 170, x0 + WB * cw, y + 170, C.line, 3, aF * aT);
      [0, 2, 4, 6, 8].forEach(us => text(us + ' µs', x0 + us * 1000 / BYTE * cw, y + 200, {size: 20, font: F.sans, color: C.dim, alpha: aF * aT}));
      eq([[`${WB} bytes`, C.gold], [' × ', C.dim], ['80 ns', C.ink], [' = ', C.dim], ['8 µs', C.coral]], 960, 250, 54, {alpha: aF * aT, glow: true});
    }
  }
  // 8 µs of signal against our 4 m line
  const aK = fade(lt, b[4]);
  if (aK > 0) {
    const x0 = 260, w = 1400, y = 430, g = eo(ramp(lt, b[4] + .3, b[4] + 2));
    ctx.save(); ctx.globalAlpha *= aK; rr(x0, y - 14, w * g, 28, 8); ctx.fillStyle = rgba(C.gold, .75); ctx.fill(); ctx.restore();
    text('8 µs of signal × 0.2 m/ns = 1.6 km  8 微秒的信号 = 1.6 公里', x0 + w / 2, y - 50, {size: 26, weight: 600, color: C.gold, alpha: aK});
    const sx = w / 1600;   // px per metre
    ctx.save(); ctx.globalAlpha *= aK * ramp(lt, b[4] + 2, b[4] + 2.6); ctx.fillStyle = C.mint; ctx.fillRect(x0, y + 60, Math.max(3, 4 * sx), 28); ctx.restore();
    text(`← our whole line: 4 m (${(4 * sx).toFixed(1)} px at this scale)  我们整条总线：4 米`, x0 + 20, y + 74, {size: 22, color: C.mint, align: 'left', alpha: aK * ramp(lt, b[4] + 2, b[4] + 2.6)});
    simTag(1560, y + 150, aK * ramp(lt, b[4] + 2.5, b[4] + 3));
    text('5 ns per metre: the simulated cable  模拟网线：每米 5 纳秒', 1100, y + 150, {size: 20, color: C.violet, alpha: aK * ramp(lt, b[4] + 2.5, b[4] + 3)});
  }
};

/* ---------- 2. how an office switch does it ---------- */
SCN.switch = (lt, b, d) => {
  const a = fade(lt, .2, b[3]);
  const xs = [560, 960, 1360], y = 470, bw = 160, w = 180;
  line(220, y, 1700, y, C.faint, 6, a);
  boxShape(230, y, 150, 110, C.gold, a); text('sender', 230, y - 12, {size: 22, weight: 600, alpha: a}); text('发送方', 230, y + 16, {size: 16, font: F.zh, color: C.dim, alpha: a});
  // one frame, hop by hop: enter (store) → check → leave
  const per = 3.2, u = lt - b[0] - 1, hop = Math.floor(u / per), p = (u % per) / per;
  xs.forEach((x, i) => {
    let fill = 0; if (hop === i) fill = p < .45 ? p / .45 : p < .6 ? 1 : 1 - (p - .6) / .4;
    boxShape(x, y, bw, 130, C.dim, a);
    text('switch', x, y - 40, {size: 22, weight: 600, alpha: a}); text('交换机', x, y - 14, {size: 16, font: F.zh, color: C.dim, alpha: a});
    ctx.save(); ctx.globalAlpha *= a; rr(x - 60, y + 10, 120, 30, 6); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    if (fill > 0) { rr(x - 60, y + 10, 120 * fill, 30, 6); ctx.fillStyle = rgba(C.gold, .85); ctx.fill(); } ctx.restore();
    if (hop === i && p >= .45 && p < .65) check(x, y - 100, 18, C.mint, a);
    if (hop > i || (hop === i && p >= .6)) text('+8 µs', x, y + 95, {size: 24, font: F.mono, weight: 700, color: C.coral, alpha: a * ramp(lt, b[2], b[2] + .6)});
  });
  // the frame bar outside the boxes: entering box `hop` (shrinking into it), leaving it (growing out of it)
  if (u > 0 && hop < 3) {
    const x = xs[hop];
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = rgba(C.gold, .85);
    if (p < .45) { const k = p / .45; rr(x - bw / 2 - w * (1 - k), y - 12, w * (1 - k), 24, 6); ctx.fill(); }
    else if (p >= .6) { const k = (p - .6) / .4; rr(x + bw / 2, y - 12, w * k, 24, 6); ctx.fill(); }
    ctx.restore();
  }
  text('store the whole frame → check → send  先存整帧 → 核对 → 再发', 960, 280, {size: 26, weight: 600, alpha: a * ramp(lt, b[1], b[1] + .6)});
  chip('every hop: at least 8 µs  每过一站：至少 8 微秒', 960, 680, C.coral, eback(ramp(lt, b[2] + .4, b[2] + 1)) * a, {size: 24});
  // the post office
  const aP = fade(lt, b[3]);
  if (aP > 0) {
    [600, 960, 1320].forEach((x, i) => {
      boxShape(x, 470, 220, 150, C.dim, aP); text('post office ' + (i + 1), x, 420, {size: 22, weight: 600, alpha: aP}); text('邮局', x, 448, {size: 16, font: F.zh, color: C.dim, alpha: aP});
      const k = ((lt - b[3]) * .4 - i * .33 + 3) % 1;
      ctx.save(); ctx.globalAlpha *= aP; ctx.strokeStyle = C.gold; ctx.lineWidth = 3; rr(x - 40, 480, 80, 54, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 40, 480); ctx.lineTo(x, 480 + 30 * (k < .5 ? 1 - k * 2 : (k - .5) * 2)); ctx.lineTo(x + 40, 480); ctx.stroke(); ctx.restore();
      if (k > .4 && k < .7) check(x + 70, 470, 14, C.mint, aP);
    });
    text('every parcel opened and checked before it moves on  每个包裹都拆开验过，才往下寄', 960, 650, {size: 26, alpha: aP * ramp(lt, b[3] + .5, b[3] + 1.1)});
  }
};

/* ---------- 3. EtherCAT: never stored ---------- */
SCN.fly = (lt, b, d) => {
  const a = fade(lt, .2, b[4]);
  const cx = 960, cy = 560, w = 640, h = 220, cw = 30, L = cx - w / 2, R = cx + w / 2;
  if (a > 0) {
    // the stream of bytes: in at port 0, out at port 1, never all inside
    const off = (lt * 90) % cw;
    for (let i = -2; i < 50; i++) {
      const x = 120 + i * cw + off; if (x > 1800) continue;
      const k = (i - Math.floor(lt * 90 / cw) + 1000) % 100, inside = x > cx - 2 * cw && x < cx + 2 * cw;
      ctx.save(); ctx.globalAlpha *= a * (inside ? 1 : .55); ctx.fillStyle = byteCol(k); rr(x, cy - 12, cw - 4, 24, 3); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha *= a; rr(L, cy - h / 2, w, h, 16); ctx.strokeStyle = rgba(C.sky, .85); ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    text('slave chip (ESC)  从站芯片', cx, cy - h / 2 + 30, {size: 24, weight: 600, alpha: a});
    text('port 0', L, cy + h / 2 + 30, {size: 22, font: F.mono, color: C.dim, alpha: a}); text('port 1', R, cy + h / 2 + 30, {size: 22, font: F.mono, color: C.dim, alpha: a});
    const aW = ramp(lt, b[3], b[3] + .6);
    ctx.save(); ctx.globalAlpha *= a * aW; rr(cx - 2 * cw - 4, cy - 26, 4 * cw + 8, 52, 8); ctx.strokeStyle = C.mint; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    text('≈ 4 bytes inside at any moment  任何时刻只有约 4 个字节', cx, cy + 50, {size: 22, weight: 600, color: C.mint, alpha: a * aW});
    // 305 ns from port 0 to port 1
    const a3 = ramp(lt, b[2], b[2] + .6);
    brace(L, R, cy - h / 2 - 16, '', C.gold, a * a3, -1);
    text('first bit in at port 0 → out at port 1: ≈ 305 ns  约 305 纳秒', cx, cy - h / 2 - 70, {size: 24, color: C.gold, alpha: a * a3});
    eq([['305 ns', C.gold], [' ÷ ', C.dim], ['80 ns', C.ink], [' ≈ ', C.dim], ['4 bytes', C.mint]], cx, 760, 44, {alpha: a * aW});
    // the datasheet's words
    const aQ = fade(lt, b[1], b[2] + .2);
    card(960, 300, 1500, 130, '“Data is read and written as the bits are passing the ESC.”', 'ESC 数据手册：比特经过芯片时，数据就被读写。（Section I, 3）', C.ink, aQ, {size: 32});
  }
  // the train that never stops
  const aT = fade(lt, b[4]);
  if (aT > 0) {
    const y = 520, sx = 960;
    ctx.save(); ctx.globalAlpha *= aT; ctx.fillStyle = C.panel2; ctx.fillRect(sx - 160, y + 50, 320, 26); ctx.restore();
    text('station: J1  车站：J1', sx, y + 110, {size: 24, weight: 600, color: C.sky, alpha: aT});
    line(160, y + 34, 1760, y + 34, C.faint, 4, aT);
    const off = ((lt - b[4]) * 110) % 140;
    for (let i = -1; i < 13; i++) {
      const x = 160 + i * 140 + off, mine = (i - Math.floor((lt - b[4]) * 110 / 140) + 100) % 4 === 1, passed = x > sx;
      ctx.save(); ctx.globalAlpha *= aT; rr(x, y - 24, 120, 52, 8); ctx.fillStyle = C.panel2; ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
      if (mine) { rr(x + 40, y - 12, 40, 28, 4); ctx.fillStyle = passed ? C.sky : C.gold; ctx.fill(); }
      ctx.restore();
    }
    // the worker
    dot(sx, y - 70, 14, C.sky, aT); line(sx, y - 56, sx, y - 30, C.sky, 5, aT);
    text('takes its letters off, puts its own on, while the train rolls through', sx, 330, {size: 26, alpha: aT});
    text('车不停：站上的人取下本站的信，塞上本站要寄的信', sx, 366, {size: 22, font: F.zh, color: C.dim, alpha: aT});
  }
};

/* ---------- 4. when is the whole frame back? ---------- */
SCN.tail = (lt, b, d) => {
  const t = knots(lt, [[b[2] + .3, 0], [b[2] + 2.5, D.rtt], [b[2] + 6.5, D.tail]]);
  let r = {sent: 0, back: 0};
  ringLine(); r = ribbon(t);
  stopwatch(t, 230, 225, fade(lt, .3));
  counters(r, fade(lt, .3));
  card(960, 760, 1200, 120, `The head is back after ${D.rtt} ns. When has the last byte arrived?`, '帧头 1485 纳秒回来。最后一个字节什么时候到？', C.coral, fade(lt, b[1], b[2]), {size: 34});
  text('preamble · header · EtherCAT data · checksum', 1290, 225, {size: 20, color: C.dim, alpha: fade(lt, .5)});
  [[byteCol(0), 1060], [byteCol(10), 1150], [byteCol(50), 1290], [byteCol(99), 1440]].forEach(([c, x]) => { ctx.save(); ctx.globalAlpha *= fade(lt, .5); ctx.fillStyle = c; rr(x - 30, 248, 60, 10, 3); ctx.fill(); ctx.restore(); });
  chip('the tail: 8 µs behind the head, through every chip  帧尾始终落后帧头 8 微秒', 960, 300, C.gold, eback(ramp(lt, b[2] + .4, b[2] + 1)) * fade(lt, b[2], b[4]), {size: 22});
  const aE = fade(lt, b[3]);
  eq([[`${D.rtt}`, C.sky], [' + ', C.dim], ['8000', C.gold], [' = ', C.dim], [`${D.tail} ns`, C.mint]], 960, 760, 54, {alpha: aE, glow: true});
  const aS = fade(lt, b[4]);
  realTag(1420, 690, aS); text(`pcap of the run: every ${D.bytes}-byte frame back after ${D.tail} ns`, 1420, 655, {size: 18, color: C.mint, alpha: aS});
  simTag(760, 690, aS); text('chip + cable delays simulated · 80 ns/byte = 100 Mbit/s', 760, 655, {size: 18, color: C.violet, alpha: aS});
};

/* ---------- 5. one frame across the whole line ---------- */
SCN.stretch = (lt, b, d) => {
  const t = Math.min(D.rtt, knots(lt, [[.3, 0], [2.5, D.rtt]]));
  let r = {sent: 0, back: 0};
  ringLine(); r = ribbon(t);
  stopwatch(t, 230, 225, 1);
  if (lt > 2.5) text('⏸ frozen  定格', 400, 225, {size: 22, color: C.coral, align: 'left', alpha: fade(lt, 2.5)});
  counters(r, fade(lt, b[1]));
  const aQ = fade(lt, b[1]);
  if (aQ > 0) {
    // the bytes still waiting in the master
    const left = WB - r.sent;
    for (let k = 0; k < left; k++) { const x = 560 + (k % 42) * 11, y = 272 + Math.floor(k / 42) * 14;
      ctx.save(); ctx.globalAlpha *= aQ * .85; ctx.fillStyle = byteCol(r.sent + k); ctx.fillRect(x, y, 8, 10); ctx.restore(); }
    text(`still waiting in the master: ${left} bytes  还在主站里排队`, 560, 248, {size: 20, color: C.gold, align: 'left', alpha: aQ});
  }
  // how many bytes sit inside each slave right now (counted from the ribbon)
  const aS = fade(lt, b[2]);
  if (aS > 0) [1, 2, 3].forEach(i => {
    let n = 0; for (let k = 0; k < WB; k++) { const tk = t - k * BYTE; if (tk < 0 || tk >= D.rtt) continue; const q = posAt(PTS, tk); if (q.x >= edgeL(i) && q.x <= edgeR(i)) n++; }
    chip(`${n} bytes inside  ${n} 字节在里面`, RL.xs[i], RL.y + 165, C.mint, eback(ramp(lt, b[2] + .3 + i * .3, b[2] + .9 + i * .3)) * aS, {size: 20});
  });
  const aD = fade(lt, b[3]);
  if (aD > 0) { pulse(edgeR(0) - 30, YO, ((lt - b[3]) % 1.2) / 1.2, C.gold, 10, 50); pulse(edgeR(0) - 30, YR, ((lt - b[3] + .6) % 1.2) / 1.2, C.sky, 10, 50); }
  chip('sending and receiving at the same time (Episode 2)  同时发、同时收（第 2 集）', 960, 790, C.sky, eback(ramp(lt, b[3] + .3, b[3] + .9)), {size: 22});
};

/* ---------- 6. every slave has its seats ---------- */
const SEATS = [[0, 6, 'J1 command', 'J1 命令', C.sky], [6, 12, 'J2 command', 'J2 命令', C.violet], [12, 28, 'card readings', '采集卡读数', C.dim], [28, 34, 'J1 reply', 'J1 回答', C.sky], [34, 40, 'J2 reply', 'J2 回答', C.violet]];
function seatRow(x0, y, cw, a, hl) {
  SEATS.forEach(([s, e, en, zh, c], g) => {
    const k = hl ? hl(g) : 1;
    for (let i = s; i < e; i++) { ctx.save(); ctx.globalAlpha *= a; rr(x0 + i * cw + 2, y - 22, cw - 4, 44, 4); ctx.fillStyle = rgba(c, .15 + .55 * k); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
  });
}
SCN.seats = (lt, b, d) => {
  const x0 = 240, cw = 36, y = 560, a = fade(lt, .2);
  termBox(260, 175, 1400, 'vwire/build/cycle vwire:chain3 --frame', D.map_lines, fade(lt, b[1]));
  seatRow(x0, y, cw, a, g => g < 2 ? ramp(lt, b[2], b[2] + .6) : g < 3 ? ramp(lt, b[3], b[3] + .6) : ramp(lt, b[2], b[2] + .6));
  text('the frame\'s data area: 40 bytes  帧里的数据区：40 字节', 960, y - 70, {size: 26, weight: 600, alpha: a * (1 - ramp(lt, b[1], b[1] + .4))});
  const aB = ramp(lt, b[1] + .8, b[1] + 1.4);
  brace(x0, x0 + 12 * cw, y - 32, '', C.gold, a * aB, -1); text('12 bytes out  往外送', x0 + 6 * cw, y - 86, {size: 22, color: C.gold, alpha: a * aB});
  brace(x0 + 12 * cw, x0 + 40 * cw, y - 32, '', C.sky, a * aB, -1); text('28 bytes back  往回带', x0 + 26 * cw, y - 86, {size: 22, color: C.sky, alpha: a * aB});
  SEATS.forEach(([s, e, en, zh, c], g) => {
    const k = g < 2 || g > 2 ? ramp(lt, b[2] + .4, b[2] + 1) : ramp(lt, b[3] + .4, b[3] + 1);
    label2(en, zh, x0 + (s + e) / 2 * cw, y + 60, {size: 22, color: c, alpha: a * k});
    text(`${e - s} B`, x0 + (s + e) / 2 * cw, y + 130, {size: 20, font: F.mono, color: C.dim, alpha: a * k});
  });
  realTag(1660, 175, fade(lt, b[1]));
  chip('how seats are addressed → Episode 3b  座位怎么寻址 → 第 3 集下篇', 960, 790, C.gold, eback(ramp(lt, b[4] + .2, b[4] + .8)), {size: 22});
};

/* ---------- 7. one real frame, slave by slave ---------- */
SCN.hops = (lt, b, d) => {
  const S = D.snaps, a = fade(lt, .2);
  const cols = [['where', '位置', 300], ['J1 target', 'J1 目标', 520], ['J2 target', 'J2 目标', 680], ['card ch1–4 (mV)', '采集卡 1–4 通道', 960], ['J1 actual', 'J1 实际', 1240], ['J2 actual', 'J2 实际', 1400], ['counter', '计数器', 1570]];
  cols.forEach(([en, zh, x]) => { text(en, x, 225, {size: 20, weight: 600, color: C.dim, alpha: a}); text(zh, x, 250, {size: 16, font: F.zh, color: C.dim, alpha: a}); });
  const names = [['leaving the master', '离开主站'], ['after slave 1', '过了从站 1'], ['after J1', '过了 J1'], ['after J2', '过了 J2'], ['back at the master', '回到主站']];
  const own = [[], ['ai'], ['j1_in'], ['j2_in'], []];
  S.forEach((s, r) => {
    const ar = a * ramp(lt, b[r + 1], b[r + 1] + .6), y = 310 + r * 92;
    if (ar <= 0) return;
    panel(960, y, 1500, 76, {alpha: ar, fill: C.panel});
    label2(names[r][0], names[r][1], 300, y - 12, {size: 22, alpha: ar});
    const cell = (v, x, key, c) => {
      const prev = r ? S[r - 1] : null, changed = prev && JSON.stringify(prev[key]) !== JSON.stringify(s[key]) && own[r].includes(key);
      const hw = key === 'ai' ? 170 : 110;
      if (changed) { ctx.save(); ctx.globalAlpha *= ar; rr(x - hw, y - 28, 2 * hw, 56, 8); ctx.fillStyle = rgba(c, .25); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      text(v, x, y, {size: 24, font: F.mono, weight: changed ? 700 : 500, color: changed ? c : C.ink, alpha: ar});
    };
    cell(String(s.j1_out[1]), 520, 'j1_out', C.sky); cell(String(s.j2_out[1]), 680, 'j2_out', C.violet);
    cell(s.ai.slice(0, 4).join(' '), 960, 'ai', C.mint); cell(String(s.j1_in[1]), 1240, 'j1_in', C.sky); cell(String(s.j2_in[1]), 1400, 'j2_in', C.violet);
    text(String(s.wkc), 1570, y, {size: 24, font: F.mono, weight: 700, color: C.gold, alpha: ar});
  });
  realTag(1600, 175, a);
  text(`frame ${D.frame} of the run, copied after every slave  运行中的第 ${D.frame} 帧`, 960, 175, {size: 20, color: C.dim, alpha: a});
  text('counter → Episode 3b', 1570, 745, {size: 18, color: C.gold, alpha: a * ramp(lt, b[2], b[2] + .6)});
  chip('nothing waited: each slave worked as the frame passed  没有谁在等：帧经过时就干完了', 960, 790, C.mint, eback(ramp(lt, b[6] + .2, b[6] + .8)), {size: 22});
};

/* ---------- 8. the checksum comes last ---------- */
SCN.crc = (lt, b, d) => {
  const x0 = 260, cw = 14, a = fade(lt, .2);
  // the frame and its checksum at the end
  const aF = fade(lt, .2, b[1]);
  wireBar(x0, 450, cw, aF);
  brace(x0 + 96 * cw, x0 + 100 * cw, 476, '', C.coral, aF * ramp(lt, b[0] + 1, b[0] + 1.6), 1);
  label2('checksum: computed from every byte before it', '校验和：由前面每一个字节算出', x0 + 98 * cw - 300, 560, {size: 24, color: C.coral, alpha: aF * ramp(lt, b[0] + 1, b[0] + 1.6)});
  text('arrives last  最后才到', x0 + 98 * cw, 400, {size: 22, weight: 700, color: C.coral, alpha: aF * ramp(lt, b[0] + 2, b[0] + 2.6)});
  // the chip: by the time the checksum is in, the head is long gone
  const aC = fade(lt, b[1], b[5]);
  if (aC > 0) {
    const cx = 760, cy = 470, p = clamp((lt - b[1] - .5) / 5, 0, 1), bad = lt > b[3];
    const head = x0 - 100 + p * 2000;   // where the head is
    for (let k = 0; k < WB; k++) { const x = head - k * cw; if (x < x0 - 120 || x > 1820) continue;
      ctx.save(); ctx.globalAlpha *= aC * (x < cx ? .9 : .7); ctx.fillStyle = byteCol(k); rr(x, cy - 14, cw - 2, 28, 2); ctx.fill(); ctx.restore(); }
    ctx.save(); ctx.globalAlpha *= aC; rr(cx - 60, cy - 80, 120, 160, 12); ctx.strokeStyle = C.sky; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    text('chip', cx, cy - 100, {size: 22, weight: 600, alpha: aC}); text('芯片', cx, cy - 126, {size: 16, font: F.zh, color: C.dim, alpha: aC});
    if (head > 1500) text('the head: long gone →  帧头：早就走远了', 1500, cy - 70, {size: 22, color: C.gold, alpha: aC});
    // a running checksum, appended at the end
    const aN = ramp(lt, b[2], b[2] + .6);
    const passed = clamp(Math.floor((head - cx) / cw), 0, 96);
    text(`new checksum over ${passed} / 96 bytes`, cx, cy + 120, {size: 22, font: F.mono, color: C.mint, alpha: aC * aN});
    text('边转发边算新的校验和', cx, cy + 150, {size: 16, font: F.zh, color: C.dim, alpha: aC * aN});
    // the bad case
    const aB = ramp(lt, b[3], b[3] + .6);
    if (aB > 0) {
      const xin = head - 98 * cw;
      cross(xin < cx ? xin : cx - 120, cy - 50, 14, C.red, 5, aC * aB);
      text('incoming checksum wrong → outgoing made wrong too, + marker', 1180, 640, {size: 22, color: C.red, alpha: aC * aB});
      text('收到的校验和错了 → 发出去的也让它错，再加一个标记', 1180, 670, {size: 18, font: F.zh, color: C.dim, alpha: aC * aB});
    }
    chip('this frame\'s changes dropped · error counter +1  丢弃本帧的改动 · 错误计数 +1', 960, 760, C.coral, eback(ramp(lt, b[4] + .2, b[4] + .8)), {size: 22});
  }
  // the master's network card
  const aM = fade(lt, b[5]);
  if (aM > 0) {
    boxShape(500, 470, 260, 180, C.gold, aM); text('master', 500, 410, {size: 24, weight: 600, alpha: aM}); text('network card 网卡', 500, 440, {size: 18, color: C.dim, alpha: aM});
    const k = ramp(lt, b[5] + .3, b[5] + 1.6);
    wireBar(900 - 600 * k, 470, 8, aM * (1 - ramp(lt, b[5] + 1.6, b[5] + 2.2)), {n: WB});
    cross(500, 500, 22, C.red, 6, aM * ramp(lt, b[5] + 1.6, b[5] + 2));
    card(1240, 420, 640, 90, 'bad checksum → thrown away', '坏帧被扔掉', C.red, aM * ramp(lt, b[5] + 1.6, b[5] + 2.2), {size: 28});
    card(1240, 540, 640, 90, 'this cycle: no answer · next cycle: fresh', '这个周期没有回答 · 下一个周期重新开始', C.mint, aM * ramp(lt, b[5] + 2.6, b[5] + 3.2), {size: 26});
  }
  chip('from the ESC datasheet (Section I, 14) · our simulated line has no bit errors  来自 ESC 数据手册 · 模拟总线没有比特错误', 960, 790, C.dim, eback(ramp(lt, b[6] + .2, b[6] + .8)), {size: 20});
};

/* ---------- 9. why it matters ---------- */
SCN.scale = (lt, b, d) => {
  const a = fade(lt, .2);
  const x0 = 520, maxW = 1100, lg = v => Math.log10(v / 100) / Math.log10(200000 / 100) * maxW;   // 100 ns .. 200 µs
  const rows = [[305, 'on the fly', '边走边处理', C.mint, b[0]], [8000, 'store our frame', '存下我们这一帧', C.coral, b[1]], [122000, 'store a full-size frame', '存下最大的以太网帧', C.coral, b[2]]];
  text('delay added by one slave (log scale)  每个从站添的延迟（对数刻度）', 960, 220, {size: 26, weight: 600, alpha: a});
  rows.forEach(([v, en, zh, c, t0], i) => {
    const y = 330 + i * 120, g = eo(ramp(lt, t0 + .3, t0 + 1.5)), ar = a * ramp(lt, t0, t0 + .4);
    label2(en, zh, x0 - 30, y - 12, {size: 24, color: c, align: 'right', alpha: ar});
    ctx.save(); ctx.globalAlpha *= ar; rr(x0, y - 26, Math.max(8, lg(v)) * g, 52, 10); ctx.fillStyle = rgba(c, .8); ctx.fill(); ctx.restore();
    text(v < 1000 ? `${v} ns` : `${v / 1000} µs`, x0 + Math.max(8, lg(v)) * g + 20, y, {size: 28, font: F.mono, weight: 700, color: c, align: 'left', alpha: ar * g});
  });
  ['100 ns', '1 µs', '10 µs', '100 µs'].forEach((s, i) => { const v = [100, 1000, 10000, 100000][i], x = x0 + lg(v);
    line(x, 280, x, 640, C.line, 2, a * .6); text(s, x, 670, {size: 20, font: F.mono, color: C.dim, alpha: a}); });
  chip('≈ 26× more  约多 26 倍', 1500, 450, C.coral, eback(ramp(lt, b[1] + 1.4, b[1] + 2)), {size: 22});
  chip('on the fly: still ≈ 0.3 µs  边走边处理：仍约 0.3 微秒', 960, 730, C.mint, eback(ramp(lt, b[2] + 1.6, b[2] + 2.2)), {size: 22});
  chip('按推算 · worked out', 1700, 220, C.gold, eback(ramp(lt, .6, 1.2)), {size: 18});
  chip('one frame, a long line of slaves, every cycle  一帧服务一长串从站，每个周期', 960, 790, C.mint, eback(ramp(lt, b[3] + .2, b[3] + .8)), {size: 22});
};

/* ---------- 10. recap ---------- */
SCN.recap = (lt, b, d) => {
  const items = [
    ['a frame is a stream: ours is 8 µs long on the wire', '帧是一串流：我们这一帧在线上长 8 微秒', C.gold],
    ['each slave reads and writes its seats as the bits pass', '每个从站在比特经过时读写自己的座位', C.mint],
    ['the checksum comes last: a bad frame is marked, then dropped', '校验和在最后：坏帧被标记，最后被丢弃', C.coral],
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
  text('YOUR TURN  你来算', 960, 210, {size: 26, font: F.mono, weight: 700, color: C.gold, ls: 6, alpha: fade(lt, .2, b[3])});
  const a1 = fade(lt, b[0] + .2, b[3]);
  if (a1 > 0) {
    wireBar(260, 330, 7, a1, {n: 100}); wireBar(960, 330, 7, a1, {n: 100});
    text('200 bytes on the wire  线上 200 字节', 960, 285, {size: 24, color: C.gold, alpha: a1});
    eq([['head ', C.dim], [`${D.rtt} ns`, C.sky], [' + 200 × 80 ns = ', C.dim], ['?', C.gold, 1 - ramp(lt, b[2], b[2] + .4)]], 960, 470, 56, {alpha: a1, glow: true});
    const a2 = ramp(lt, b[2], b[2] + .8);
    eq([['200 × 80 ns', C.gold], [' = ', C.dim], ['16,000 ns', C.ink]], 960, 580, 48, {alpha: a1 * a2});
    eq([[`${D.rtt}`, C.sky], [' + 16,000 = ', C.dim], ['17,485 ns ≈ 17.5 µs', C.mint]], 960, 670, 48, {alpha: a1 * ramp(lt, b[2] + 1, b[2] + 1.8), glow: true});
  }
  const a3 = fade(lt, b[3]);
  if (a3 > 0) {
    text('Next · 下一集', 960, 330, {size: 26, font: F.mono, weight: 700, color: C.dim, alpha: a3});
    text('What is inside the frame', 960, 430, {size: 64, font: F.disp, weight: 700, alpha: a3});
    text('帧里装了什么：数据报、逻辑地址、工作计数器', 960, 510, {size: 34, font: F.zh, color: C.dim, alpha: a3});
    seatRow(240, 640, 36, a3 * .8);
  }
};

// filled by build.py with every Chinese character in this file (so the font subset loads them)
const EXTRA_ZH = '__AUTO__';
